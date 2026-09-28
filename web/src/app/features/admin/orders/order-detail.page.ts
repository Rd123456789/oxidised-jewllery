import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  Address,
  CustomerSummary,
  Order,
  OrderStatus,
  PaymentStatus,
} from '../../../core/api/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  formatCurrency,
  formatDateTime,
  nextOrderStatuses,
  orderStatusTone,
  paymentStatusTone,
  titleCase,
  trackingUrlFor,
} from '../../../core/utils/format';
import { Icon } from '../../../shared/components/icon/icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
];

interface CustomerHistory {
  customer: CustomerSummary & { addresses: unknown[] };
  stats: { orderCount: number; lifetimeValue: number };
  orders: Order[];
}

type StatusPayload = Parameters<AdminService['updateOrderStatus']>[1];

interface StatusForm {
  status: OrderStatus;
  note: string;
  paymentStatus: PaymentStatus;
  cancelReason: string;
}

interface TrackingForm {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}

@Component({
  selector: 'admin-order-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, StatusBadge],
  templateUrl: './order-detail.page.html',
})
export class AdminOrderDetailPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly orderNumber = input.required<string>();

  readonly order = signal<Order | null>(null);
  readonly history = signal<CustomerHistory | null>(null);
  readonly historyLoading = signal(false);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly saving = signal(false);
  readonly savingTracking = signal(false);
  readonly savingNote = signal(false);

  readonly statuses = ORDER_STATUSES;
  readonly paymentStatuses = PAYMENT_STATUSES;

  readonly formatCurrency = formatCurrency;
  readonly formatDateTime = formatDateTime;
  readonly titleCase = titleCase;
  readonly orderStatusTone = orderStatusTone;
  readonly paymentStatusTone = paymentStatusTone;

  readonly statusForm = signal<StatusForm>({
    status: 'pending',
    note: '',
    paymentStatus: 'pending',
    cancelReason: '',
  });

  readonly trackingForm = signal<TrackingForm>({
    carrier: '',
    trackingNumber: '',
    trackingUrl: '',
  });

  readonly adminNote = signal('');

  readonly customerUser = computed(() => {
    const user = this.order()?.user;

    return typeof user === 'object' && user !== null ? user : null;
  });

  readonly userId = computed(() => this.customerUser()?.id ?? null);

  readonly customerEmail = computed(
    () => this.customerUser()?.email ?? this.order()?.guestEmail ?? '—',
  );

  readonly allowedNext = computed(() => {
    const order = this.order();

    return order ? nextOrderStatuses(order.status) : [];
  });

  readonly showBilling = computed(() => {
    const order = this.order();

    if (!order?.billingAddress) {
      return false;
    }

    return JSON.stringify(order.billingAddress) !== JSON.stringify(order.shippingAddress);
  });

  readonly trackingLink = computed(() => {
    const form = this.trackingForm();

    return form.trackingUrl.trim() || trackingUrlFor(form.carrier, form.trackingNumber) || null;
  });

  constructor() {
    effect(() => {
      const number = this.orderNumber();

      if (number) {
        void this.loadOrder(number);
      }
    });
  }

  isStatusAllowed(status: OrderStatus): boolean {
    const order = this.order();

    if (!order) {
      return false;
    }

    return status === order.status || this.allowedNext().includes(status);
  }

  patchStatus(patch: Partial<StatusForm>): void {
    this.statusForm.update((form) => ({ ...form, ...patch }));
  }

  patchTracking(patch: Partial<TrackingForm>): void {
    this.trackingForm.update((form) => ({ ...form, ...patch }));
  }

  print(): void {
    window.print();
  }

  async saveStatus(): Promise<void> {
    const order = this.order();

    if (!order) {
      return;
    }

    const form = this.statusForm();
    const payload: StatusPayload = { status: form.status };

    if (form.note.trim()) {
      payload.note = form.note.trim();
    }

    if (form.paymentStatus !== order.payment.status) {
      payload.paymentStatus = form.paymentStatus;
    }

    if (form.status === 'cancelled' && form.cancelReason.trim()) {
      payload.cancelReason = form.cancelReason.trim();
    }

    this.saving.set(true);

    try {
      await this.admin.updateOrderStatus(order.orderNumber, payload);
      this.toast.success('Order status updated');
      await this.loadOrder(order.orderNumber);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  async saveTracking(): Promise<void> {
    const order = this.order();

    if (!order) {
      return;
    }

    const form = this.trackingForm();
    const canShip = this.allowedNext().includes('shipped');
    const payload: StatusPayload = {
      status: canShip ? 'shipped' : order.status,
      tracking: {
        carrier: form.carrier.trim() || undefined,
        trackingNumber: form.trackingNumber.trim() || undefined,
        trackingUrl: form.trackingUrl.trim() || undefined,
      },
    };

    this.savingTracking.set(true);

    try {
      await this.admin.updateOrderStatus(order.orderNumber, payload);
      this.toast.success(canShip ? 'Order marked as shipped' : 'Tracking details saved');
      await this.loadOrder(order.orderNumber);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.savingTracking.set(false);
      this.cdr.markForCheck();
    }
  }

  async saveAdminNote(): Promise<void> {
    const order = this.order();

    if (!order) {
      return;
    }

    this.savingNote.set(true);

    try {
      await this.admin.updateOrderStatus(order.orderNumber, {
        status: order.status,
        adminNote: this.adminNote(),
      });
      this.toast.success('Admin note saved');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.savingNote.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadOrder(number: string): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      const order = await this.admin.order(number);
      this.order.set(order);
      this.statusForm.set({
        status: order.status,
        note: '',
        paymentStatus: order.payment.status,
        cancelReason: order.cancelReason ?? '',
      });
      this.trackingForm.set({
        carrier: order.tracking.carrier ?? '',
        trackingNumber: order.tracking.trackingNumber ?? '',
        trackingUrl: order.tracking.trackingUrl ?? '',
      });
      this.adminNote.set(order.adminNote ?? '');
      this.seo.set({ title: `Order ${order.orderNumber}` });
      void this.loadHistory();
    } catch (error) {
      this.failed.set(true);
      this.order.set(null);
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadHistory(): Promise<void> {
    const userId = this.userId();

    if (!userId) {
      this.history.set(null);

      return;
    }

    this.historyLoading.set(true);

    try {
      this.history.set(await this.admin.customer(userId));
    } catch {
      this.history.set(null);
    } finally {
      this.historyLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  addressLines(address: Address | undefined): string[] {
    if (!address) {
      return [];
    }

    return [
      address.line1,
      address.line2,
      address.landmark,
      `${address.city}, ${address.state} ${address.pincode}`,
      address.country,
    ].filter((line): line is string => !!line && line.trim() !== '');
  }
}
