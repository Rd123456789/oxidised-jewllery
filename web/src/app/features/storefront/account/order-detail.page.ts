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
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import type { Order, OrderStatus } from '../../../core/api/api.models';
import { ContentService } from '../../../core/services/content.service';
import { OrderService } from '../../../core/services/order.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ORDER_STATUS_FLOW,
  formatCurrency,
  formatDate,
  formatDateTime,
  nextOrderStatuses,
  orderStatusTone,
  paymentStatusTone,
  statusProgressIndex,
  titleCase,
  trackingUrlFor,
} from '../../../core/utils/format';
import { Icon } from '../../../shared/components/icon/icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

interface TimelineStep {
  status: OrderStatus;
  label: string;
  note?: string;
  changedAt?: string;
  completed: boolean;
}

@Component({
  selector: 'account-order-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StatusBadge],
  templateUrl: './order-detail.page.html',
})
export class AccountOrderDetailPage {
  private readonly orders = inject(OrderService);
  private readonly content = inject(ContentService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly orderNumber = input.required<string>();

  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly confirmingCancel = signal(false);
  readonly cancelling = signal(false);

  readonly settings = this.content.settings;

  readonly timeline = computed<TimelineStep[]>(() => {
    const order = this.order();

    if (!order) {
      return [];
    }

    const currentIndex = statusProgressIndex(order.status);

    return ORDER_STATUS_FLOW.map((status, index) => {
      const entry = order.statusHistory.find((item) => item.status === status);

      return {
        status,
        label: titleCase(status),
        note: entry?.note,
        changedAt: entry?.changedAt,
        completed: Boolean(entry) || currentIndex >= index,
      };
    });
  });

  /**
   * The API omits `tracking` entirely until an admin records it, so it is read through a fallback
   * rather than dereferenced directly. `computed` re-runs on every change detection pass, so a bare
   * `order.tracking.carrier` threw on the very first render for every order that had not shipped
   * yet and took the whole page down with it.
   */
  readonly trackingLink = computed(() => {
    const order = this.order();

    if (!order) {
      return null;
    }

    const tracking = order.tracking;

    return tracking
      ? trackingUrlFor(tracking.carrier, tracking.trackingNumber)
      : null;
  });

  readonly canCancel = computed(() => {
    const order = this.order();

    return order ? nextOrderStatuses(order.status).includes('cancelled') : false;
  });

  readonly mailtoHref = computed(() => {
    const email = this.settings()?.supportEmail;

    if (!email) {
      return null;
    }

    const order = this.order();
    const subject = order ? `Help with order ${order.orderNumber}` : 'Order help';

    return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  });

  titleCase = titleCase;
  formatDate = formatDate;
  formatDateTime = formatDateTime;
  formatCurrency = formatCurrency;
  orderTone = orderStatusTone;
  paymentTone = paymentStatusTone;

  constructor() {
    effect(() => {
      const number = this.orderNumber();

      if (number) {
        void this.load(number);
      }
    });
  }

  requestCancel(): void {
    this.confirmingCancel.set(true);
  }

  dismissCancel(): void {
    this.confirmingCancel.set(false);
  }

  async confirmCancel(): Promise<void> {
    const order = this.order();

    if (!order || this.cancelling()) {
      return;
    }

    this.cancelling.set(true);

    try {
      const updated = await this.orders.cancel(order.orderNumber, 'Cancelled from order details');
      this.order.set(updated);
      this.confirmingCancel.set(false);
      this.toast.success('Order cancelled');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cancelling.set(false);
      this.cdr.markForCheck();
    }
  }

  private async load(orderNumber: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    this.order.set(null);

    try {
      const order = await this.orders.myOrder(orderNumber);
      this.order.set(order);
      this.seo.set({
        title: `Order ${order.orderNumber}`,
        canonicalPath: `/account/orders/${order.orderNumber}`,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || !error.isNotFound) {
        this.toast.error(error);
      }

      this.notFound.set(true);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
