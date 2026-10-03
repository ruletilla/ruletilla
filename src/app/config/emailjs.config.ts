import { InjectionToken } from '@angular/core';

export interface EmailJsConfig {
  readonly serviceId: string;
  readonly templateId: string;
  readonly publicKey: string;
  /** Pausa entre correos consecutivos para no chocar con el rate-limit del plan gratuito. */
  readonly sendDelayMs: number;
}

export const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

export const EMAILJS_CONFIG = new InjectionToken<EmailJsConfig>('EMAILJS_CONFIG');

/**
 * 👇 PEGA AQUÍ TUS TRES CREDENCIALES DE EMAILJS.
 * Las encuentras en https://dashboard.emailjs.com (ver guía del README).
 * La «Private Key» NO se usa: en una SPA pública sería visible para cualquiera.
 */
export const emailJsConfig: EmailJsConfig = {
  serviceId: 'service_jzdw5n7',
  templateId: 'template_cfi9zmx',
  publicKey: '6ACOH6cBGpsr2ypu3',
  sendDelayMs: 1200,
};

/** `true` mientras sigan los valores de ejemplo, para avisar en la interfaz. */
export function isEmailJsConfigured(config: EmailJsConfig): boolean {
  return [config.serviceId, config.templateId, config.publicKey].every(
    (value) => value.length > 0 && !value.startsWith('TU_'),
  );
}
