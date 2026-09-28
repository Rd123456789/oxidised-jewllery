import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'admin-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './admin-login.page.html',
})
export class AdminLoginPage {
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly textOf = (event: Event): string => (event.target as HTMLInputElement).value;

  constructor() {
    this.seo.set({
      title: 'Admin sign in',
      description: 'Sign in to the OX Admin console.',
      canonicalPath: '/admin/login',
    });

    if (this.session.isAdmin()) {
      void this.router.navigate(['/admin/dashboard']);
    }
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.loading()) {
      return;
    }

    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.error.set('Enter your email and password to continue.');

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const user = await this.session.loginAsAdmin(email, password);
      this.toast.success(`Welcome back, ${user.name}`);
      await this.router.navigate(['/admin/dashboard']);
    } catch (error) {
      this.error.set(error instanceof ApiError ? error.message : 'Unable to sign in right now.');
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
