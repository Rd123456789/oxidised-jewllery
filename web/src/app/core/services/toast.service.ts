import { Injectable, computed, signal } from '@angular/core';
import { ApiError } from '../api/api-error';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** Total lifetime, used by the toast's progress bar. */
  duration: number;
}

/** Beyond this many the oldest toast is retired so the stack never covers the page. */
const MAX_VISIBLE = 4;

interface ToastTimer {
  /** Absent while the toast is paused. */
  handle?: ReturnType<typeof setTimeout>;
  startedAt: number;
  remaining: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private sequence = 0;
  private readonly timers = new Map<number, ToastTimer>();

  readonly toasts = signal<Toast[]>([]);
  readonly hasToasts = computed(() => this.toasts().length > 0);

  show(message: string, tone: ToastTone = 'info', duration = 4000): number {
    const id = (this.sequence += 1);

    this.toasts.update((toasts) => {
      const next = [...toasts, { id, tone, message, duration }];

      // Retire the oldest beyond the cap, timers included.
      while (next.length > MAX_VISIBLE) {
        const oldest = next.shift();

        if (oldest) {
          this.clearTimer(oldest.id);
        }
      }

      return next;
    });

    this.startTimer(id, duration);

    return id;
  }

  success(message: string): void {
    this.show(message, 'success', 3500);
  }

  info(message: string): void {
    this.show(message, 'info', 3500);
  }

  /** Errors stay up longer: they carry information worth reading twice. */
  error(error: unknown): void {
    this.show(this.describe(error), 'error', 7000);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  /** Called while the pointer rests on a toast, so it cannot vanish mid-read. */
  pause(id: number): void {
    const timer = this.timers.get(id);

    if (!timer?.handle) {
      return;
    }

    clearTimeout(timer.handle);
    timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    timer.handle = undefined;
  }

  resume(id: number): void {
    const timer = this.timers.get(id);

    if (!timer || timer.handle) {
      return;
    }

    this.startTimer(id, timer.remaining);
  }

  private startTimer(id: number, duration: number): void {
    const handle = setTimeout(() => this.dismiss(id), duration);

    this.timers.set(id, { handle, startedAt: Date.now(), remaining: duration });
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);

    if (timer?.handle) {
      clearTimeout(timer.handle);
    }

    this.timers.delete(id);
  }

  private describe(error: unknown): string {
    if (error instanceof ApiError) {
      const fields = error.fieldErrors;

      if (fields.length > 0) {
        return fields.map((field) => field.message).join(' · ');
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Something went wrong. Please try again.';
  }
}
