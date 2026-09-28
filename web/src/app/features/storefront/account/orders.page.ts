import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { Order } from '../../../core/api/api.models';
import { OrderService } from '../../../core/services/order.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  formatCurrency,
  formatDate,
  nextOrderStatuses,
  orderStatusTone,
  paymentStatusTone,
  titleCase,
} from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'account-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, StatusBadge, EmptyState, Pagination],
  templateUrl: './orders.page.html',
})
export class AccountOrdersPage {
  private readonly orders = inject(OrderService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly statusOptions = [
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

  readonly ordersList = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly total = signal(0);
  readonly confirmingCancel = signal<string | null>(null);
  readonly cancelling = signal<string | null>(null);

  status = '';

  constructor() {
    this.seo.set({
      title: 'My orders',
      description: 'View and track all of your orders.',
      canonicalPath: '/account/orders',
    });

    void this.load();
  }

  orderTone = orderStatusTone;
  paymentTone = paymentStatusTone;
  formatDate = formatDate;
  formatCurrency = formatCurrency;
  titleCase = titleCase;

  canCancel(order: Order): boolean {
    return nextOrderStatuses(order.status).includes('cancelled');
  }

  changeStatus(value: string): void {
    this.status = value;
    this.page.set(1);
    void this.load();
  }

  changePage(next: number): void {
    this.page.set(next);
    void this.load();
  }

  requestCancel(orderNumber: string): void {
    this.confirmingCancel.set(orderNumber);
  }

  dismissCancel(): void {
    this.confirmingCancel.set(null);
  }

  async confirmCancel(orderNumber: string): Promise<void> {
    this.cancelling.set(orderNumber);

    try {
      await this.orders.cancel(orderNumber, 'Cancelled from account');
      this.toast.success('Order cancelled');
      this.confirmingCancel.set(null);
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cancelling.set(null);
      this.cdr.markForCheck();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      const result = await this.orders.myOrders({
        page: this.page(),
        limit: 10,
        status: this.status || undefined,
      });

      this.ordersList.set(result.orders);
      this.total.set(result.meta.total ?? result.orders.length);
      this.totalPages.set(result.meta.totalPages ?? 1);
    } catch (error) {
      this.ordersList.set([]);
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
