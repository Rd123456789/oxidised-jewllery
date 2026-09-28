import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../../core/api/api-client';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon/icon';

interface ForgotPasswordResponse {
  resetToken?: string;
  message?: string;
}

@Component({
  selector: 'forgot-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './forgot-password.page.html',
})
export class ForgotPasswordPage {
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  email = '';

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly resetToken = signal<string | null>(null);
  readonly fieldError = signal<string | null>(null);

  constructor() {
    this.seo.set({
      title: 'Forgot password',
      description: 'Reset your account password with a secure link sent to your email.',
      canonicalPath: '/forgot-password',
    });
  }

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    const email = this.email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.fieldError.set('Enter a valid email address.');

      return;
    }

    this.fieldError.set(null);
    this.submitting.set(true);

    try {
      const response = await this.api.post<ForgotPasswordResponse>('/auth/forgot-password', {
        email,
      });

      this.resetToken.set(response?.resetToken ?? null);
      this.sent.set(true);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.submitting.set(false);
      this.cdr.markForCheck();
    }
  }
}
