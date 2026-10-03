import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { EMAILJS_CONFIG, EMAILJS_ENDPOINT, EmailJsConfig } from '../config/emailjs.config';
import { EmailJsSendRequest, Participant } from '../models/secret-santa.models';
import { SecretSantaService } from './secret-santa.service';

const testConfig: EmailJsConfig = {
  serviceId: 'service_test',
  templateId: 'template_test',
  publicKey: 'public_test',
  sendDelayMs: 0,
};

function makeParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `id-${index}`,
    name: `Amigo ${index}`,
    email: `amigo${index}@ejemplo.com`,
    size: 'M' as const,
    comment: '',
    createdAt: index,
  }));
}

describe('SecretSantaService', () => {
  let service: SecretSantaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EMAILJS_CONFIG, useValue: testConfig },
      ],
    });

    service = TestBed.inject(SecretSantaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('rechaza sorteos con menos de 3 participantes', () => {
    expect(() => service.drawClosedCycle(makeParticipants(2))).toThrow();
  });

  it('asigna un regalo a cada participante exactamente una vez', () => {
    const participants = makeParticipants(8);
    const pairings = service.drawClosedCycle(participants);

    expect(pairings).toHaveLength(8);
    expect(new Set(pairings.map((p) => p.gifter.id)).size).toBe(8);
    expect(new Set(pairings.map((p) => p.giftee.id)).size).toBe(8);
  });

  it('nunca empareja a alguien consigo mismo', () => {
    for (let run = 0; run < 200; run++) {
      const pairings = service.drawClosedCycle(makeParticipants(5));
      expect(pairings.every((p) => p.gifter.id !== p.giftee.id)).toBe(true);
    }
  });

  it('genera un único ciclo cerrado sin subciclos aislados', () => {
    for (let run = 0; run < 100; run++) {
      const participants = makeParticipants(6);
      const pairings = service.drawClosedCycle(participants);
      const next = new Map(pairings.map((p) => [p.gifter.id, p.giftee.id]));

      let current = participants[0].id;
      const visited = new Set<string>();

      while (!visited.has(current)) {
        visited.add(current);
        current = next.get(current)!;
      }

      // Recorrer la cadena desde cualquiera debe pasar por todos y volver al origen.
      expect(visited.size).toBe(participants.length);
      expect(current).toBe(participants[0].id);
    }
  });

  it('envía un correo por participante con las variables de la plantilla', async () => {
    const participants = makeParticipants(3);
    const emitted = service.drawAndSend(participants);
    const bodies: EmailJsSendRequest[] = [];

    const finished = new Promise<void>((resolve) => {
      emitted.subscribe({ complete: () => resolve() });
    });

    for (let i = 0; i < participants.length; i++) {
      // El envío se encadena con `timer`, así que hay que dejar correr una macrotarea.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const request = httpMock.expectOne(EMAILJS_ENDPOINT);
      bodies.push(request.request.body as EmailJsSendRequest);
      request.flush('OK');
    }

    await finished;
    httpMock.verify();

    expect(bodies).toHaveLength(3);
    for (const body of bodies) {
      expect(body.service_id).toBe(testConfig.serviceId);
      expect(body.template_id).toBe(testConfig.templateId);
      expect(body.user_id).toBe(testConfig.publicKey);
      expect(body.template_params.to_email).toMatch(/@ejemplo\.com$/);
      expect(body.template_params.giftee_name).not.toBe(body.template_params.to_name);
      expect(body.template_params.giftee_size).toBe('M');
      expect(body.template_params.giftee_comment).not.toBe('');
    }
  });
});
