import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import type { Order, OrderStatus, PaymentStatus, TrackedOrder } from '../../../core/api/api.models';
import { OrderService } from '../../../core/services/order.service';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  ORDER_STATUS_FLOW,
  formatCurrency,
  formatDate,
  orderStatusTone,
  paymentStatusTone,
  statusProgressIndex,
  titleCase,
  trackingUrlFor,
} from '../../../core/utils/format';
import { Icon } from '../../../shared/components/icon/icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type StepState = 'done' | 'current' | 'upcoming';

@Component({
  selector: 'order-success-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StatusBadge],
  templateUrl: './order-success.page.html',
})
export class OrderSuccessPage implements OnInit {
  private readonly orders = inject(OrderService);
  private readonly session = inject(SessionService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly orderNumber = input.required<string>();

  readonly order = signal<Order | null>(null);
  readonly tracked = signal<TrackedOrder | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly flow = ORDER_STATUS_FLOW;

  readonly items = computed(() => this.order()?.items ?? this.tracked()?.items ?? []);
  readonly pricing = computed(() => this.order()?.pricing ?? this.tracked()?.pricing ?? null);
  readonly tracking = computed(() => this.order()?.tracking ?? this.tracked()?.tracking ?? null);
  readonly history = computed(() => this.order()?.statusHistory ?? this.tracked()?.statusHistory ?? []);
  readonly status = computed<OrderStatus | null>(() => this.order()?.status ?? this.tracked()?.status ?? null);
  readonly placedAt = computed(() => this.order()?.placedAt ?? this.tracked()?.placedAt ?? null);
  readonly customerName = computed(() => this.order()?.customerName ?? this.tracked()?.customerName ?? '');
  readonly paymentStatus = computed<PaymentStatus | null>(() => this.order()?.payment.status ?? null);
  readonly currency = computed(() => this.pricing()?.currency ?? 'INR');

  readonly statusLabel = computed(() => {
    const value = this.status();

    return value ? titleCase(value) : '—';
  });
  readonly statusTone = computed(() => {
    const value = this.status();

    return value ? orderStatusTone(value) : 'neutral';
  });
  readonly paymentLabel = computed(() => {
    const value = this.paymentStatus();

    return value ? titleCase(value) : '';
  });
  readonly paymentTone = computed(() => {
    const value = this.paymentStatus();

    return value ? paymentStatusTone(value) : 'neutral';
  });
  readonly trackingLink = computed(() => {
    const info = this.tracking();

    return info ? trackingUrlFor(info.carrier, info.trackingNumber) : null;
  });

  constructor() {
    this.seo.set({
      title: 'Order confirmed',
      description: 'Your order confirmation, items and delivery details.',
    });
  }

  async ngOnInit(): Promise<void> {
    const orderNumber = this.orderNumber();

    this.seo.set({
      title: `Order ${orderNumber}`,
      description: `Confirmation and delivery status for order ${orderNumber}.`,
    });

    try {
      if (this.session.isAuthenticated()) {
        this.order.set(await this.orders.myOrder(orderNumber));
      } else {
        this.tracked.set(await this.orders.track(orderNumber));
      }
    } catch (error) {
      this.notFound.set(true);

      if (!(error instanceof ApiError && error.isNotFound)) {
        this.toast.error(error);
      }
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  money(value: number): string {
    return formatCurrency(value, this.currency());
  }

  date(value: string | null | undefined): string {
    return formatDate(value);
  }

  label(value: string): string {
    return titleCase(value);
  }

  stepState(step: OrderStatus): StepState {
    const current = this.status();

    if (!current) {
      return 'upcoming';
    }

    const currentIndex = statusProgressIndex(current);

    if (currentIndex < 0) {
      return 'upcoming';
    }

    const stepIndex = statusProgressIndex(step);

    if (stepIndex < currentIndex) {
      return 'done';
    }

    if (stepIndex === currentIndex) {
      return 'current';
    }

    return 'upcoming';
  }

  historyNote(status: OrderStatus): string | undefined {
    return this.history().find((entry) => entry.status === status)?.note;
  }

  historyDate(status: OrderStatus): string | undefined {
    const entry = this.history().find((entry) => entry.status === status);

    return entry ? formatDate(entry.changedAt) : undefined;
  }
}
