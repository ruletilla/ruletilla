import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  concatMap,
  defer,
  from,
  map,
  of,
  scan,
  startWith,
  switchMap,
  timer,
} from 'rxjs';

import { EMAILJS_CONFIG, EMAILJS_ENDPOINT } from '../config/emailjs.config';
import {
  EmailJsSendRequest,
  EmailPayload,
  Pairing,
  Participant,
  SendProgress,
} from '../models/secret-santa.models';
import { MIN_PARTICIPANTS } from './participants-store';

interface SendOutcome {
  readonly ok: boolean;
  readonly gifterName: string;
}

@Injectable({ providedIn: 'root' })
export class SecretSantaService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(EMAILJS_CONFIG);

  /**
   * Sortea y envía en una sola operación: los emparejamientos viven solo dentro
   * de este método, así que ni la plantilla ni la consola pueden filtrarlos.
   * El observable emitido contiene únicamente recuentos de progreso.
   */
  drawAndSend(participants: readonly Participant[]): Observable<SendProgress> {
    return defer(() => {
      // El orden de envío se baraja aparte del ciclo: si se enviaran en el orden
      // del ciclo, ver la secuencia de correos revelaría quién regala a quién.
      const queue = this.shuffle(this.drawClosedCycle(participants));
      const total = queue.length;
      const initial: SendProgress = { total, attempted: 0, succeeded: 0, failed: [], done: false };

      return from(queue).pipe(
        concatMap((pairing, index) =>
          timer(index === 0 ? 0 : this.config.sendDelayMs).pipe(
            switchMap(() => this.sendEmail(toEmailPayload(pairing))),
            map((): SendOutcome => ({ ok: true, gifterName: pairing.gifter.name })),
            catchError(() => of<SendOutcome>({ ok: false, gifterName: pairing.gifter.name })),
          ),
        ),
        scan((progress, outcome) => accumulate(progress, outcome), initial),
        startWith(initial),
      );
    });
  }

  /**
   * Fisher-Yates sobre la lista y encadenado en un único ciclo cerrado:
   * `orden[i]` regala a `orden[i + 1]` y el último al primero.
   * Garantiza que nadie se regale a sí mismo y que no haya subciclos aislados.
   */
  drawClosedCycle(participants: readonly Participant[]): Pairing[] {
    if (participants.length < MIN_PARTICIPANTS) {
      throw new Error(`Hacen falta al menos ${MIN_PARTICIPANTS} participantes para sortear.`);
    }

    const cycle = this.shuffle(participants);

    return cycle.map((gifter, index) => ({
      gifter,
      giftee: cycle[(index + 1) % cycle.length],
    }));
  }

  private sendEmail(payload: EmailPayload): Observable<void> {
    const body: EmailJsSendRequest = {
      service_id: this.config.serviceId,
      template_id: this.config.templateId,
      user_id: this.config.publicKey,
      template_params: payload,
    };

    // EmailJS responde con el texto plano «OK», no con JSON.
    return this.http.post(EMAILJS_ENDPOINT, body, { responseType: 'text' }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse) => {
        throw new Error(describeEmailJsError(error));
      }),
    );
  }

  private shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];

    for (let i = result.length - 1; i > 0; i--) {
      const j = randomBelow(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }
}

function accumulate(progress: SendProgress, outcome: SendOutcome): SendProgress {
  const attempted = progress.attempted + 1;

  return {
    total: progress.total,
    attempted,
    succeeded: progress.succeeded + (outcome.ok ? 1 : 0),
    // Se ordena alfabéticamente para que la lista de fallos tampoco deje
    // entrever el orden en que se enviaron los correos.
    failed: outcome.ok
      ? progress.failed
      : [...progress.failed, outcome.gifterName].sort((a, b) => a.localeCompare(b, 'es')),
    done: attempted === progress.total,
  };
}

function toEmailPayload(pairing: Pairing): EmailPayload {
  return {
    to_name: pairing.gifter.name,
    to_email: pairing.gifter.email,
    giftee_name: pairing.giftee.name,
    giftee_size: pairing.giftee.size,
    giftee_comment: pairing.giftee.comment || 'Sin preferencias concretas, sorpréndele.',
  };
}

/** Entero uniforme en [0, maxExclusive) sin el sesgo del módulo. */
function randomBelow(maxExclusive: number): number {
  const range = 2 ** 32;
  const limit = Math.floor(range / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value: number;

  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return value % maxExclusive;
}

function describeEmailJsError(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'No se pudo contactar con EmailJS (red o dominio no autorizado).';
  }

  const detail = typeof error.error === 'string' ? error.error.trim() : '';
  return detail
    ? `EmailJS ${error.status}: ${detail}`
    : `EmailJS devolvió un error ${error.status}.`;
}
