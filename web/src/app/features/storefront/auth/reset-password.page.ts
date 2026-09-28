import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiClient } from '../../../core/api/api-client';
import { ApiError } from '../../../core/api/api-error';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'reset-password-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './reset-password.page.html',
})
export class ResetPasswordPage {
  private readonly api = inject(ApiClient);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly token = signal(this.route.snapshot.queryParamMap.get('token') ?? '');

  password = '';
  confirmPassword = '';

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly done = signal(false);
  readonly formError = signal<string | null>(null);
  readonly serverErrors = signal<Record<string, string>>({});

  constructor() {
    this.seo.set({
      title: 'Reset password',
      description: 'Choose a new password for your account.',
      canonicalPath: '/reset-password',
    });
  }

  errorFor(field: string): string | undefined {
    const server = this.serverErrors()[field];

    if (server) {
      return server;
    }

    if (!this.submitted()) {
      return undefined;
    }

    return this.clientErrors()[field];
  }

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.submitted.set(true);
    this.formError.set(null);
    this.serverErrors.set({});

    if (Object.keys(this.clientErrors()).length > 0) {
      return;
    }

    this.submitting.set(true);

    try {
      await this.api.post('/auth/reset-password', {
        token: this.token(),
        password: this.password,
      });

      this.done.set(true);
      this.toast.success('Password updated');
    } catch (error) {
      this.applyError(error);
    } finally {
      this.submitting.set(false);
      this.cdr.markForCheck();
    }
  }

  private clientErrors(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (
      this.password.length < 8 ||
      !/[A-Za-z]/.test(this.password) ||
      !/[0-9]/.test(this.password)
    ) {
      errors['password'] = 'Use at least 8 characters with a letter and a number.';
    }

    if (!this.confirmPassword || this.confirmPassword !== this.password) {
      errors['confirmPassword'] = 'Passwords do not match.';
    }

    return errors;
  }

  private applyError(error: unknown): void {
    if (error instanceof ApiError) {
      const errors: Record<string, string> = {};

      for (const entry of error.fieldErrors) {
        errors[entry.field] = entry.message;
      }

      this.serverErrors.set(errors);
      this.formError.set(error.message);

      return;
    }

    this.toast.error(error);
  }
}
