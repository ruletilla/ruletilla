# Amigo invisible de camisetas

Aplicación Angular 22 100 % serverless para sortear el amigo invisible antes de un viaje y avisar
a cada participante por correo. No hay backend: el sorteo se ejecuta en el navegador y los correos
salen directamente contra la API REST de EmailJS.

**El resultado del sorteo nunca se muestra.** Los emparejamientos solo existen dentro de
`SecretSantaService.drawAndSend()`; la interfaz recibe únicamente recuentos de progreso, y el orden
de envío se baraja aparte del ciclo de regalos para que la secuencia de correos tampoco lo delate.

## Puesta en marcha

```bash
npm install
npm start          # http://localhost:4200
npm test           # algoritmo de sorteo y payload de EmailJS
npm run build
```

## Cómo funciona el sorteo

1. Fisher-Yates (con `crypto.getRandomValues` y rechazo por muestreo, sin el sesgo del módulo)
   baraja la lista de participantes.
2. El resultado se encadena en un **único ciclo cerrado**: `orden[i]` regala a `orden[i + 1]` y el
   último al primero.

Así nadie se regala a sí mismo y no pueden aparecer subciclos aislados (p. ej. dos parejas
regalándose entre sí mientras el resto queda fuera). Hace falta un mínimo de 3 participantes.

## Configurar EmailJS en 4 pasos

### 1. Crea la cuenta y conecta tu correo

Regístrate gratis en [emailjs.com](https://www.emailjs.com) (el plan gratuito incluye 200 correos
al mes). En **Email Services → Add New Service** elige tu proveedor (Gmail, Outlook…), autoriza la
cuenta y anota el **Service ID** que aparece en la lista (tiene la forma `service_xxxxxxx`).

### 2. Crea la plantilla con las variables exactas

En **Email Templates → Create New Template**, configura:

| Campo    | Valor                                 |
| -------- | ------------------------------------- |
| To Email | `{{to_email}}`                        |
| To Name  | `{{to_name}}`                         |
| Subject  | `Tu amigo invisible para el viaje 🎁` |

Y en el cuerpo del mensaje usa estas cinco variables, escritas tal cual:

```
¡Hola {{to_name}}!

Te ha tocado regalarle la camiseta a: {{giftee_name}}

Talla: {{giftee_size}}
Sus preferencias: {{giftee_comment}}

No se lo cuentes a nadie 🤫
```

Guarda y anota el **Template ID** (`template_xxxxxxx`).

> Importante: en **Account → Security**, deja desactivada la opción _Use Private Key_ (API keys en
> modo estricto). Una SPA pública no puede guardar secretos, así que la app solo envía la Public
> Key. Para limitar el abuso, añade `ruletilla.github.io` en la lista de dominios permitidos.

### 3. Copia tu Public Key

Está en **Account → General → Public Key** (una cadena corta tipo `AbCdEf123456`).

### 4. Pega las tres credenciales en el código

Edita `src/app/config/emailjs.config.ts` y sustituye los valores de ejemplo:

```ts
export const emailJsConfig: EmailJsConfig = {
  serviceId: 'service_xxxxxxx', // paso 1
  templateId: 'template_xxxxxxx', // paso 2
  publicKey: 'AbCdEf123456', // paso 3
  sendDelayMs: 1200, // pausa entre correos para no superar el rate-limit
};
```

Mientras sigan los valores `TU_...`, la app muestra un aviso y mantiene el botón de sorteo
desactivado.

## Despliegue en GitHub Pages

`.github/workflows/deploy.yml` compila y publica en cada push a `main`. Solo hay que activarlo una
vez: en **Settings → Pages → Build and deployment**, selecciona **GitHub Actions** como origen.

Como el repositorio se llama `ruletilla.github.io`, el sitio se sirve en la raíz del dominio y el
`--base-href` es `/`. Si mueves el proyecto a un repositorio normal, cambia esa bandera en el
workflow por `/<nombre-del-repo>/`.

## Estructura

```
src/app/
├── config/emailjs.config.ts          # credenciales + InjectionToken
├── models/secret-santa.models.ts     # Participant, Pairing, EmailPayload, SendProgress
├── services/
│   ├── participants-store.ts         # signals sincronizadas con localStorage
│   └── secret-santa.service.ts       # ciclo cerrado + envío con concatMap
├── app.ts / app.html                 # formulario, lista y botón de sorteo
└── app.config.ts                     # provideHttpClient + EMAILJS_CONFIG
```
