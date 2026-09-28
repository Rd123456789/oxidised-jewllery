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

@Component({
  selector: 'login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly session = inject(SessionService);
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  email = '';
  password = '';
  rememberMe = true;

  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly perks = [
    {
      icon: 'refresh' as const,
      title: 'Easy 7-day returns',
      copy: 'Start a return from your account in a couple of taps.',
    },
    {
      icon: 'truck' as const,
      title: 'Live order tracking',
      copy: 'Follow every order from packed all the way to delivered.',
    },
    {
      icon: 'heart' as const,
      title: 'A saved wishlist',
      copy: 'Keep the pieces you love in one place for later.',
    },
  ];

  constructor() {
    this.seo.set({
      title: 'Sign in',
      description: 'Sign in to track orders, manage addresses and keep your wishlist in sync.',
      canonicalPath: '/login',
    });
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.formError.set(null);
    this.fieldErrors.set({});

    const email = this.email.trim();

    if (!email || !this.password) {
      this.formError.set('Enter your email and password to continue.');

      return;
    }

    this.submitting.set(true);

    try {
      await this.session.login(email, this.password);
      await Promise.allSettled([this.cart.mergeGuestCart(), this.wishlist.mergeGuestWishlist()]);
      this.toast.success('Welcome back');
      await this.router.navigateByUrl(this.redirectPath());
    } catch (error) {
      this.applyError(error);
    } finally {
      this.submitting.set(false);
      this.cdr.markForCheck();
    }
  }

  /**
   * Straight into the storefront after signing in, not the account page. A redirect
   * left by a guard (for example /checkout) still wins, and admins land in the panel.
   */
  private redirectPath(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');

    if (redirect && redirect.startsWith('/')) {
      return redirect;
    }

    return this.session.isAdmin() ? '/admin/dashboard' : '/shop';
  }

  private applyError(error: unknown): void {
    if (error instanceof ApiError) {
      const errors: Record<string, string> = {};

      for (const entry of error.fieldErrors) {
        errors[entry.field] = entry.message;
      }

      this.fieldErrors.set(errors);
      this.formError.set(error.message);

      return;
    }

    this.toast.error(error);
  }
}
