import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import type { OrderStatus, TrackedOrder } from '../../../core/api/api.models';
import { ContentService } from '../../../core/services/content.service';
import { OrderService } from '../../../core/services/order.service';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import {
  ORDER_STATUS_FLOW,
  formatCurrency,
  formatDate,
  orderStatusTone,
  statusProgressIndex,
  titleCase,
} from '../../../core/utils/format';
import { Icon } from '../../../shared/components/icon/icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type StepState = 'done' | 'current' | 'upcoming';

@Component({
  selector: 'track-order-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StatusBadge],
  templateUrl: './track-order.page.html',
})
export class TrackOrderPage {
  private readonly orders = inject(OrderService);
  private readonly content = inject(ContentService);
  private readonly session = inject(SessionService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly settings = this.content.settings;
  readonly isAuthenticated = this.session.isAuthenticated;
  readonly flow = ORDER_STATUS_FLOW;

  readonly orderNumber = signal('');
  readonly phone = signal('');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly tracked = signal<TrackedOrder | null>(null);

  readonly statusLabel = computed(() => {
    const value = this.tracked()?.status;

    return value ? titleCase(value) : '';
  });
  readonly statusTone = computed(() => {
    const value = this.tracked()?.status;

    return value ? orderStatusTone(value) : 'neutral';
  });
  readonly currency = computed(
    () => this.tracked()?.pricing.currency ?? this.settings()?.currency ?? 'INR',
  );

  constructor() {
    this.seo.set({
      title: 'Track your order',
      description: 'Enter your order number to see the latest delivery status.',
      canonicalPath: '/track-order',
    });

    void this.content
      .loadSettings()
      .catch(() => null)
      .finally(() => this.cdr.markForCheck());
  }

  money(value: number): string {
    return formatCurrency(value, this.currency());
  }

  label(value: string): string {
    return titleCase(value);
  }

  date(value: string | undefined): string {
    return formatDate(value);
  }

  setOrderNumber(event: Event): void {
    this.orderNumber.set((event.target as HTMLInputElement).value);
  }

  setPhone(event: Event): void {
    this.phone.set((event.target as HTMLInputElement).value);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  async submit(): Promise<void> {
    const orderNumber = this.orderNumber().trim();

    if (!orderNumber) {
      this.errorMessage.set('Enter your order number to continue.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.tracked.set(null);

    try {
      this.tracked.set(await this.orders.track(orderNumber, this.phone().trim() || undefined));
    } catch (error) {
      this.errorMessage.set(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  stepState(step: OrderStatus): StepState {
    const current = this.tracked()?.status;

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
}
