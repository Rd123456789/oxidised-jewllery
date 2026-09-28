import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import { CartService } from '../../../core/services/cart.service';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { Icon } from '../../../shared/components/icon/icon';

interface RegisterForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  marketingOptIn: boolean;
  terms: boolean;
}

@Component({
  selector: 'register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly session = inject(SessionService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly form = signal<RegisterForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    marketingOptIn: true,
    terms: false,
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly formError = signal<string | null>(null);
  readonly serverErrors = signal<Record<string, string>>({});

  constructor() {
    this.seo.set({
      title: 'Create an account',
      description: 'Create an account for faster checkout, order tracking and a saved wishlist.',
      canonicalPath: '/register',
    });
  }

  update<K extends keyof RegisterForm>(key: K, value: RegisterForm[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
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

    const value = this.form();
    this.submitting.set(true);

    try {
      await this.session.register({
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
        phone: value.phone.trim() || undefined,
        marketingOptIn: value.marketingOptIn,
      });
      await Promise.allSettled([this.cart.mergeGuestCart(), this.wishlist.mergeGuestWishlist()]);
      this.toast.success('Welcome to the family');
      await this.router.navigateByUrl(this.redirectPath());
    } catch (error) {
      this.applyError(error);
    } finally {
      this.submitting.set(false);
      this.cdr.markForCheck();
    }
  }

  private clientErrors(): Record<string, string> {
    const value = this.form();
    const errors: Record<string, string> = {};

    if (value.name.trim().length < 2) {
      errors['name'] = 'Name must be at least 2 characters.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) {
      errors['email'] = 'Enter a valid email address.';
    }

    const phone = value.phone.trim();

    if (phone && !/^[0-9+\-\s]{6,20}$/.test(phone)) {
      errors['phone'] = 'Enter a valid phone number.';
    }

    if (
      value.password.length < 8 ||
      !/[A-Za-z]/.test(value.password) ||
      !/[0-9]/.test(value.password)
    ) {
      errors['password'] = 'Use at least 8 characters with a letter and a number.';
    }

    if (!value.confirmPassword || value.confirmPassword !== value.password) {
      errors['confirmPassword'] = 'Passwords do not match.';
    }

    if (!value.terms) {
      errors['terms'] = 'Please accept the terms to continue.';
    }

    return errors;
  }

  /** New accounts start shopping rather than landing on the account page. */
  private redirectPath(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');

    return redirect && redirect.startsWith('/') ? redirect : '/shop';
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
