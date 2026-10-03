import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { EMAILJS_CONFIG, isEmailJsConfigured } from './config/emailjs.config';
import { SHIRT_SIZES, SendProgress, ShirtSize } from './models/secret-santa.models';
import { MIN_PARTICIPANTS, ParticipantsStore } from './services/participants-store';
import { SecretSantaService } from './services/secret-santa.service';

type DrawStatus = 'idle' | 'confirming' | 'sending' | 'finished';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly secretSanta = inject(SecretSantaService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly store = inject(ParticipantsStore);
  protected readonly sizes = SHIRT_SIZES;
  protected readonly minParticipants = MIN_PARTICIPANTS;
  protected readonly emailJsReady = isEmailJsConfigured(inject(EMAILJS_CONFIG));

  protected readonly status = signal<DrawStatus>('idle');
  protected readonly progress = signal<SendProgress | null>(null);
  protected readonly fatalError = signal<string | null>(null);
  protected readonly duplicateEmail = signal(false);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    size: ['M' as ShirtSize, [Validators.required]],
    comment: [''],
  });

  protected readonly isSending = computed(() => this.status() === 'sending');

  /** Número de correo que se está enviando ahora mismo, acotado al total. */
  protected readonly currentIndex = computed(() => {
    const progress = this.progress();
    return progress ? Math.min(progress.attempted + 1, progress.total) : 1;
  });

  protected readonly percent = computed(() => {
    const progress = this.progress();
    return progress && progress.total > 0
      ? Math.round((progress.attempted / progress.total) * 100)
      : 0;
  });

  protected readonly canSubmitDraw = computed(
    () => this.store.canDraw() && this.emailJsReady && !this.isSending(),
  );

  protected addParticipant(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, size, comment } = this.form.getRawValue();

    if (this.store.hasEmail(email)) {
      this.duplicateEmail.set(true);
      return;
    }

    this.duplicateEmail.set(false);
    this.store.add({
      name: name.trim(),
      email: email.trim(),
      size,
      comment: comment.trim(),
    });

    this.form.reset({ name: '', email: '', size: 'M', comment: '' });
  }

  protected removeParticipant(id: string): void {
    this.store.remove(id);
  }

  protected clearAll(): void {
    this.store.clear();
    this.reset();
  }

  protected askConfirmation(): void {
    this.status.set('confirming');
  }

  protected cancelConfirmation(): void {
    this.status.set('idle');
  }

  protected reset(): void {
    this.status.set('idle');
    this.progress.set(null);
    this.fatalError.set(null);
  }

  /**
   * El servicio sortea y envía internamente: aquí solo llegan recuentos,
   * de modo que el secreto no se filtra ni a la plantilla ni a la consola.
   */
  protected drawAndSend(): void {
    this.status.set('sending');
    this.fatalError.set(null);
    this.progress.set(null);

    this.secretSanta
      .drawAndSend(this.store.participants())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progress) => this.progress.set(progress),
        error: (error: Error) => {
          this.fatalError.set(error.message);
          this.status.set('idle');
        },
        complete: () => this.status.set('finished'),
      });
  }
}
