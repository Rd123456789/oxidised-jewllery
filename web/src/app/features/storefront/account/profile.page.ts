import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDateTime, titleCase } from '../../../core/utils/format';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'account-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, StatusBadge],
  templateUrl: './profile.page.html',
})
export class AccountProfilePage {
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly user = this.session.user;
  readonly role = computed(() => titleCase(this.session.user()?.role));
  readonly lastLogin = computed(() => formatDateTime(this.session.user()?.lastLoginAt));

  name = this.session.user()?.name ?? '';
  phone = this.session.user()?.phone ?? '';
  marketingOptIn = this.session.user()?.marketingOptIn ?? false;

  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  readonly savingProfile = signal(false);
  readonly profileErrors = signal<Record<string, string>>({});
  readonly changingPassword = signal(false);
  readonly passwordErrors = signal<Record<string, string>>({});

  constructor() {
    this.seo.set({
      title: 'Profile',
      description: 'Update your personal details and password.',
      canonicalPath: '/account',
    });
  }

  async saveProfile(): Promise<void> {
    if (this.savingProfile()) {
      return;
    }

    const errors: Record<string, string> = {};

    if (this.name.trim().length < 2) {
      errors['name'] = 'Name must be at least 2 characters.';
    }

    const phone = this.phone.trim();

    if (phone && !/^[0-9+\-\s]{6,20}$/.test(phone)) {
      errors['phone'] = 'Enter a valid phone number.';
    }

    if (Object.keys(errors).length > 0) {
      this.profileErrors.set(errors);

      return;
    }

    this.profileErrors.set({});
    this.savingProfile.set(true);

    try {
      await this.session.updateProfile({
        name: this.name.trim(),
        phone: phone || undefined,
        marketingOptIn: this.marketingOptIn,
      });
      this.toast.success('Profile updated');
    } catch (error) {
      this.applyErrors(error, this.profileErrors);
    } finally {
      this.savingProfile.set(false);
      this.cdr.markForCheck();
    }
  }

  async changePassword(): Promise<void> {
    if (this.changingPassword()) {
      return;
    }

    const errors: Record<string, string> = {};

    if (!this.currentPassword) {
      errors['currentPassword'] = 'Enter your current password.';
    }

    if (
      this.newPassword.length < 8 ||
      !/[A-Za-z]/.test(this.newPassword) ||
      !/[0-9]/.test(this.newPassword)
    ) {
      errors['newPassword'] = 'Use at least 8 characters with a letter and a number.';
    }

    if (!this.confirmPassword || this.confirmPassword !== this.newPassword) {
      errors['confirmPassword'] = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      this.passwordErrors.set(errors);

      return;
    }

    this.passwordErrors.set({});
    this.changingPassword.set(true);

    try {
      await this.session.changePassword(this.currentPassword, this.newPassword);
      this.toast.success('Password changed. Please sign in again.');
      await this.router.navigate(['/login']);
    } catch (error) {
      this.applyErrors(error, this.passwordErrors);
    } finally {
      this.changingPassword.set(false);
      this.cdr.markForCheck();
    }
  }

  private applyErrors(
    error: unknown,
    target: WritableSignal<Record<string, string>>,
  ): void {
    if (error instanceof ApiError) {
      const errors: Record<string, string> = {};

      for (const entry of error.fieldErrors) {
        errors[entry.field] = entry.message;
      }

      target.set(errors);

      if (Object.keys(errors).length === 0) {
        this.toast.error(error);
      }

      return;
    }

    this.toast.error(error);
  }
}
