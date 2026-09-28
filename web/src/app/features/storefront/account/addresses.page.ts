import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Address } from '../../../core/api/api.models';
import { ApiError } from '../../../core/api/api-error';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';

interface AddressForm {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

function emptyForm(isDefault: boolean): AddressForm {
  return {
    label: '',
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    isDefault,
  };
}

@Component({
  selector: 'account-addresses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, EmptyState],
  templateUrl: './addresses.page.html',
})
export class AccountAddressesPage {
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly addresses = computed(() => this.session.user()?.addresses ?? []);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly confirmingDelete = signal<string | null>(null);
  readonly formErrors = signal<Record<string, string>>({});
  readonly form = signal<AddressForm>(emptyForm(true));

  constructor() {
    this.seo.set({
      title: 'Addresses',
      description: 'Manage your saved delivery addresses.',
      canonicalPath: '/account/addresses',
    });
  }

  update<K extends keyof AddressForm>(key: K, value: AddressForm[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  startAdd(): void {
    this.form.set(emptyForm(this.addresses().length === 0));
    this.editingId.set(null);
    this.formErrors.set({});
    this.showForm.set(true);
  }

  startEdit(address: Address): void {
    this.form.set({
      label: address.label ?? '',
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? '',
      landmark: address.landmark ?? '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
      isDefault: Boolean(address.isDefault),
    });
    this.editingId.set(address.id ?? null);
    this.formErrors.set({});
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.formErrors.set({});
  }

  async save(): Promise<void> {
    if (this.saving()) {
      return;
    }

    const errors = this.validate();

    if (Object.keys(errors).length > 0) {
      this.formErrors.set(errors);

      return;
    }

    this.formErrors.set({});
    this.saving.set(true);

    const value = this.form();
    const payload: Address = {
      label: value.label.trim() || undefined,
      fullName: value.fullName.trim(),
      phone: value.phone.trim(),
      line1: value.line1.trim(),
      line2: value.line2.trim() || undefined,
      landmark: value.landmark.trim() || undefined,
      city: value.city.trim(),
      state: value.state.trim(),
      pincode: value.pincode.trim(),
      country: value.country.trim(),
      isDefault: value.isDefault,
    };

    try {
      const id = this.editingId();

      if (id) {
        await this.session.updateAddress(id, payload);
        this.toast.success('Address updated');
      } else {
        await this.session.addAddress(payload);
        this.toast.success('Address added');
      }

      this.cancelForm();
    } catch (error) {
      this.applyErrors(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  requestDelete(id: string): void {
    this.confirmingDelete.set(id);
  }

  dismissDelete(): void {
    this.confirmingDelete.set(null);
  }

  async confirmDelete(id: string): Promise<void> {
    try {
      await this.session.removeAddress(id);
      this.confirmingDelete.set(null);
      this.toast.success('Address removed');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async setDefault(id: string): Promise<void> {
    try {
      await this.session.setDefaultAddress(id);
      this.toast.success('Default address updated');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private validate(): Record<string, string> {
    const value = this.form();
    const errors: Record<string, string> = {};

    if (value.fullName.trim().length < 3) {
      errors['fullName'] = 'Enter the full name (at least 3 characters).';
    }

    if (!/^[0-9+\-\s]{6,20}$/.test(value.phone.trim())) {
      errors['phone'] = 'Enter a valid phone number.';
    }

    if (value.line1.trim().length < 3) {
      errors['line1'] = 'Enter the street address (at least 3 characters).';
    }

    if (value.city.trim().length < 2) {
      errors['city'] = 'Enter the city.';
    }

    if (value.state.trim().length < 2) {
      errors['state'] = 'Enter the state.';
    }

    if (!/^[1-9][0-9]{5}$/.test(value.pincode.trim())) {
      errors['pincode'] = 'Enter a 6-digit pincode.';
    }

    if (value.country.trim().length < 2) {
      errors['country'] = 'Enter the country.';
    }

    return errors;
  }

  private applyErrors(error: unknown): void {
    if (error instanceof ApiError) {
      const errors: Record<string, string> = {};

      for (const entry of error.fieldErrors) {
        errors[entry.field] = entry.message;
      }

      this.formErrors.set(errors);

      if (Object.keys(errors).length === 0) {
        this.toast.error(error);
      }

      return;
    }

    this.toast.error(error);
  }
}
