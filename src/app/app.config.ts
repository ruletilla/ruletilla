import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

import { EMAILJS_CONFIG, emailJsConfig } from './config/emailjs.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    { provide: EMAILJS_CONFIG, useValue: emailJsConfig },
  ],
};
