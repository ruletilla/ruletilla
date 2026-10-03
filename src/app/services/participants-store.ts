import { Injectable, computed, effect, signal } from '@angular/core';

import { Participant } from '../models/secret-santa.models';

const STORAGE_KEY = 'amigo-invisible.participants.v1';

/** Mínimo para que el ciclo cerrado tenga gracia (con 2 el regalo sería mutuo y evidente). */
export const MIN_PARTICIPANTS = 3;

@Injectable({ providedIn: 'root' })
export class ParticipantsStore {
  private readonly state = signal<Participant[]>(readFromStorage());

  readonly participants = this.state.asReadonly();
  readonly count = computed(() => this.state().length);
  readonly canDraw = computed(() => this.count() >= MIN_PARTICIPANTS);
  readonly missingToDraw = computed(() => Math.max(0, MIN_PARTICIPANTS - this.count()));

  constructor() {
    effect(() => writeToStorage(this.state()));
  }

  add(participant: Omit<Participant, 'id' | 'createdAt'>): void {
    this.state.update((current) => [
      ...current,
      { ...participant, id: crypto.randomUUID(), createdAt: Date.now() },
    ]);
  }

  remove(id: string): void {
    this.state.update((current) => current.filter((participant) => participant.id !== id));
  }

  clear(): void {
    this.state.set([]);
  }

  hasEmail(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return this.state().some((participant) => participant.email.toLowerCase() === normalized);
  }
}

function readFromStorage(): Participant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Participant[]) : [];
  } catch {
    return [];
  }
}

function writeToStorage(participants: readonly Participant[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
  } catch {
    // Modo privado o cuota llena: la app sigue funcionando en memoria.
  }
}
