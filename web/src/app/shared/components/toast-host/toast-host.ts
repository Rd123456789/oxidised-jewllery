import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ToastService, type ToastTone } from '../../../core/services/toast.service';
import { Icon, type IconName } from '../icon/icon';

const TONE_ICONS: Record<ToastTone, IconName> = {
  success: 'check',
  error: 'alert',
  info: 'info',
};

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div
      class="ox-toast-host"
      role="region"
      aria-label="Notifications"
      [attr.aria-live]="liveMode()"
      aria-atomic="false"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          class="ox-toast"
          [class]="'ox-toast--' + toast.tone"
          [attr.role]="toast.tone === 'error' ? 'alert' : null"
          (mouseenter)="pause(toast.id)"
          (mouseleave)="resume(toast.id)"
        >
          <span class="ox-toast__icon">
            <app-icon [name]="iconFor(toast.tone)" [size]="15" />
          </span>

          <p class="ox-toast__message">{{ toast.message }}</p>

          <button
            type="button"
            class="ox-toast__close"
            aria-label="Dismiss notification"
            (click)="dismiss(toast.id)"
          >
            <app-icon name="close" [size]="14" />
          </button>

          <span
            class="ox-toast__bar"
            aria-hidden="true"
            [style.animation-duration.ms]="toast.duration"
          ></span>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  private readonly service = inject(ToastService);

  readonly toasts = this.service.toasts;

  /** Errors interrupt; everything else waits its turn. */
  readonly liveMode = computed(() =>
    this.toasts().some((toast) => toast.tone === 'error') ? 'assertive' : 'polite',
  );

  iconFor(tone: ToastTone): IconName {
    return TONE_ICONS[tone];
  }

  dismiss(id: number): void {
    this.service.dismiss(id);
  }

  pause(id: number): void {
    this.service.pause(id);
  }

  resume(id: number): void {
    this.service.resume(id);
  }
}
