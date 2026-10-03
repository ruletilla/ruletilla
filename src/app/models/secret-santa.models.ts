/** Tallas admitidas para las camisetas del viaje. */
export const SHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;

export type ShirtSize = (typeof SHIRT_SIZES)[number];

/** Un amigo apuntado al sorteo. */
export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly size: ShirtSize;
  readonly comment: string;
  readonly createdAt: number;
}

/**
 * Asignación del sorteo: `gifter` compra la camiseta para `giftee`.
 * Nunca debe salir del servicio ni llegar a la plantilla.
 */
export interface Pairing {
  readonly gifter: Participant;
  readonly giftee: Participant;
}

/** Variables que recibe la plantilla de EmailJS, con los nombres exactos del panel. */
export interface EmailPayload {
  readonly to_name: string;
  readonly to_email: string;
  readonly giftee_name: string;
  readonly giftee_size: ShirtSize;
  readonly giftee_comment: string;
}

/** Cuerpo que espera la API REST de EmailJS. */
export interface EmailJsSendRequest {
  readonly service_id: string;
  readonly template_id: string;
  readonly user_id: string;
  readonly template_params: EmailPayload;
}

/**
 * Estado del envío masivo. Expone solo recuentos y nombres de remitentes:
 * nunca quién le ha tocado a quién.
 */
export interface SendProgress {
  readonly total: number;
  /** Correos cuyo envío ya ha terminado, con éxito o no. */
  readonly attempted: number;
  readonly succeeded: number;
  /** Nombres (ordenados alfabéticamente) de los amigos cuyo correo falló. */
  readonly failed: readonly string[];
  readonly done: boolean;
}
