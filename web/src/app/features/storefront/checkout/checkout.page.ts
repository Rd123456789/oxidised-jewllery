import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError, type ApiFieldError } from '../../../core/api/api-error';
import type {
  Address,
  OrderQuote,
  PaymentMethod,
  PlaceOrderPayload,
} from '../../../core/api/api.models';
import { CartService } from '../../../core/services/cart.service';
import { ContentService } from '../../../core/services/content.service';
import { OrderService } from '../../../core/services/order.service';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';

interface AddressForm {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

const EMPTY_ADDRESS: AddressForm = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
};

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `order-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

@Component({
  selector: 'checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, EmptyState],
  templateUrl: './checkout.page.html',
})
export class CheckoutPage {
  private readonly cart = inject(CartService);
  private readonly content = inject(ContentService);
  private readonly orders = inject(OrderService);
  private readonly session = inject(SessionService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly items = this.cart.items;
  readonly couponCode = this.cart.couponCode;
  readonly isEmpty = this.cart.isEmpty;
  readonly settings = this.content.settings;
  readonly isAuthenticated = this.session.isAuthenticated;
  readonly displayName = this.session.displayName;
  readonly addresses = computed(() => this.session.user()?.addresses ?? []);
  readonly savedAddress = computed(() => this.session.defaultAddress());

  /** Reused across retries of the same submission so a flaky network cannot double-order. */
  private placementKey: string | null = null;

  readonly ready = signal(false);
  readonly email = signal('');
  readonly address = signal<AddressForm>({ ...EMPTY_ADDRESS });
  readonly paymentMethod = signal<PaymentMethod>('cod');
  readonly note = signal('');
  readonly saveAddress = signal(false);

  readonly couponInput = signal('');
  readonly couponBusy = signal(false);
  readonly quote = signal<OrderQuote | null>(null);
  readonly quoteLoading = signal(false);
  readonly submitting = signal(false);
  readonly errors = signal<ApiFieldError[]>([]);

  readonly codEnabled = computed(() => this.settings()?.codEnabled ?? false);
  readonly codFee = computed(() => this.settings()?.codFee ?? 0);
  readonly orderItems = computed(() =>
    this.cart.items().map((item) => ({
      productId: item.product,
      variantSku: item.variantSku,
      quantity: item.quantity,
    })),
  );
  readonly currency = computed(
    () => this.quote()?.currency ?? this.cart.pricing()?.currency ?? this.settings()?.currency ?? 'INR',
  );

  constructor() {
    this.seo.set({
      title: 'Checkout',
      description: 'Secure checkout for your handcrafted oxidised jewellery order.',
      canonicalPath: '/checkout',
    });

    void this.init();
  }

  money(value: number): string {
    return formatCurrency(value, this.currency());
  }

  fieldError(field: string): string | undefined {
    return this.errors().find((entry) => entry.field === field)?.message;
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  setNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  setSaveAddress(event: Event): void {
    this.saveAddress.set((event.target as HTMLInputElement).checked);
  }

  setAddressField(field: keyof AddressForm, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
    this.address.update((current) => ({ ...current, [field]: value }));
  }

  useAddress(address: Address): void {
    this.applyAddress(address);
    this.errors.set([]);
  }

  selectPayment(method: PaymentMethod): void {
    if (method === 'cod' && !this.codEnabled()) {
      return;
    }

    this.paymentMethod.set(method);
    void this.refreshQuote();
  }

  onCouponInput(event: Event): void {
    this.couponInput.set((event.target as HTMLInputElement).value);
  }

  async applyCoupon(): Promise<void> {
    const code = this.couponInput().trim();

    if (!code) {
      return;
    }

    this.couponBusy.set(true);

    try {
      const applied = await this.cart.applyCoupon(code);

      if (applied) {
        this.couponInput.set('');
        await this.refreshQuote();
      }
    } finally {
      this.couponBusy.set(false);
      this.cdr.markForCheck();
    }
  }

  async removeCoupon(): Promise<void> {
    await this.cart.removeCoupon();
    await this.refreshQuote();
    this.cdr.markForCheck();
  }

  private applyAddress(address: Address): void {
    this.address.set({
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? '',
      landmark: address.landmark ?? '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country || 'India',
    });
  }

  private async init(): Promise<void> {
    await Promise.all([this.cart.load(), this.content.loadSettings().catch(() => null)]);

    if (this.session.isAuthenticated()) {
      await this.session.reloadProfile().catch(() => null);
      this.email.set(this.session.user()?.email ?? '');

      const address = this.savedAddress();

      if (address) {
        this.applyAddress(address);
      }
    }

    if (!this.codEnabled() && this.paymentMethod() === 'cod') {
      this.paymentMethod.set('razorpay');
    }

    this.ready.set(true);
    await this.refreshQuote();
    this.cdr.markForCheck();
  }

  private async refreshQuote(): Promise<void> {
    const items = this.orderItems();

    if (items.length === 0) {
      this.quote.set(null);

      return;
    }

    this.quoteLoading.set(true);

    try {
      this.quote.set(
        await this.orders.quote({
          items,
          couponCode: this.couponCode() ?? undefined,
          paymentMethod: this.paymentMethod(),
        }),
      );
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.quoteLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private validate(): ApiFieldError[] {
    const errors: ApiFieldError[] = [];
    const address = this.address();

    if (address.fullName.trim().length < 2) {
      errors.push({ field: 'fullName', message: 'Enter the full name for delivery.' });
    }

    const digits = address.phone.replace(/\D/g, '');

    if (digits.length < 6 || digits.length > 20 || !/^[0-9+\-\s]+$/.test(address.phone.trim())) {
      errors.push({ field: 'phone', message: 'Enter a valid phone number (6-20 digits).' });
    }

    if (address.line1.trim().length < 4) {
      errors.push({ field: 'line1', message: 'Enter the street address.' });
    }

    if (address.city.trim().length < 2) {
      errors.push({ field: 'city', message: 'Enter the city.' });
    }

    if (address.state.trim().length < 2) {
      errors.push({ field: 'state', message: 'Enter the state.' });
    }

    if (!/^[1-9][0-9]{5}$/.test(address.pincode.trim())) {
      errors.push({ field: 'pincode', message: 'Enter a 6-digit pincode.' });
    }

    if (address.country.trim().length < 2) {
      errors.push({ field: 'country', message: 'Enter the country.' });
    }

    return errors;
  }

  private async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    const localErrors = this.validate();
    this.errors.set(localErrors);

    if (localErrors.length > 0) {
      this.toast.error('Please fix the highlighted fields.');
      return;
    }

    const address = this.address();
    const shippingAddress: PlaceOrderPayload['shippingAddress'] = {
      fullName: address.fullName.trim(),
      phone: address.phone.trim(),
      line1: address.line1.trim(),
      line2: address.line2.trim() || undefined,
      landmark: address.landmark.trim() || undefined,
      city: address.city.trim(),
      state: address.state.trim(),
      pincode: address.pincode.trim(),
      country: address.country.trim() || 'India',
    };

    const payload: PlaceOrderPayload = {
      items: this.orderItems(),
      shippingAddress,
      paymentMethod: this.paymentMethod(),
      couponCode: this.couponCode() ?? undefined,
      customerNote: this.note().trim() || undefined,
      // Checkout is behind the auth guard, so there is no guest case left to branch on.
      saveAddress: this.saveAddress(),
    };

    this.submitting.set(true);

    const idempotencyKey = this.placementKey ?? createIdempotencyKey();
    this.placementKey = idempotencyKey;

    try {
      const { order } = await this.orders.place(payload, idempotencyKey);
      this.placementKey = null;
      await this.cart.load();
      this.toast.success('Order placed successfully');
      await this.router.navigate(['/order', order.orderNumber]);
    } catch (error) {
      // Keep the key only for outcomes where the order may still have been created.
      const retryable =
        error instanceof ApiError && (error.status === 0 || error.status >= 500);

      if (!retryable) {
        this.placementKey = null;
      }

      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        this.errors.set(error.fieldErrors);
        this.toast.error('Please fix the highlighted fields.');
      } else {
        this.toast.error(error);
      }
    } finally {
      this.submitting.set(false);
      this.cdr.markForCheck();
    }
  }
}
