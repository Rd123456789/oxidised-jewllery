import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  ApiMeta,
  Order,
  OrderStats,
  OrderStatus,
  PaymentMethod,
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
} from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Pagination } from '../../../shared/components/pagination/pagination';
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

const PAYMENT_METHODS: PaymentMethod[] = ['cod', 'razorpay', 'upi', 'manual'];

const PAGE_SIZE = 20;

interface OrderFilters {
  q: string;
  status: OrderStatus | 'all';
  paymentStatus: PaymentStatus | 'all';
  paymentMethod: PaymentMethod | 'all';
  from: string;
  to: string;
}

const EMPTY_FILTERS: OrderFilters = {
  q: '',
  status: 'all',
  paymentStatus: 'all',
  paymentMethod: 'all',
  from: '',
  to: '',
};

@Component({
  selector: 'admin-order-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, StatusBadge, Pagination, EmptyState],
  templateUrl: './order-list.page.html',
})
export class AdminOrderListPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly statuses = ORDER_STATUSES;
  readonly paymentStatuses = PAYMENT_STATUSES;
  readonly paymentMethods = PAYMENT_METHODS;

  readonly orders = signal<Order[]>([]);
  readonly meta = signal<ApiMeta>({});
  readonly stats = signal<OrderStats | null>(null);
  readonly loading = signal(false);
  readonly statsLoading = signal(false);
  readonly failed = signal(false);
  readonly page = signal(1);
  readonly advancingId = signal<string | null>(null);
  readonly searchDraft = signal('');
  readonly filters = signal<OrderFilters>({ ...EMPTY_FILTERS });

  readonly formatCurrency = formatCurrency;
  readonly formatDateTime = formatDateTime;
  readonly titleCase = titleCase;
  readonly orderStatusTone = orderStatusTone;
  readonly paymentStatusTone = paymentStatusTone;
  readonly nextOrderStatuses = nextOrderStatuses;

  readonly totalPages = computed(() => Number(this.meta().totalPages ?? 1) || 1);
  readonly total = computed(() => Number(this.meta().total ?? 0));

  readonly hasFilters = computed(() => {
    const filters = this.filters();

    return (
      filters.q !== '' ||
      filters.status !== 'all' ||
      filters.paymentStatus !== 'all' ||
      filters.paymentMethod !== 'all' ||
      filters.from !== '' ||
      filters.to !== ''
    );
  });

  readonly query = computed<Record<string, unknown>>(() => {
    const filters = this.filters();
    const query: Record<string, unknown> = { page: this.page(), limit: PAGE_SIZE };

    if (filters.q) {
      query['q'] = filters.q;
    }

    if (filters.status !== 'all') {
      query['status'] = filters.status;
    }

    if (filters.paymentStatus !== 'all') {
      query['paymentStatus'] = filters.paymentStatus;
    }

    if (filters.paymentMethod !== 'all') {
      query['paymentMethod'] = filters.paymentMethod;
    }

    if (filters.from) {
      query['from'] = filters.from;
    }

    if (filters.to) {
      query['to'] = filters.to;
    }

    return query;
  });

  readonly exportUrl = computed(() => this.admin.orderExportUrl(this.query()));

  constructor() {
    this.seo.set({ title: 'Orders', description: 'Manage storefront orders.' });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const filters: OrderFilters = {
        q: params.get('q') ?? '',
        status: (params.get('status') as OrderStatus | null) ?? 'all',
        paymentStatus: (params.get('paymentStatus') as PaymentStatus | null) ?? 'all',
        paymentMethod: (params.get('paymentMethod') as PaymentMethod | null) ?? 'all',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
      };

      this.filters.set(filters);
      this.searchDraft.set(filters.q);
      this.page.set(Math.max(1, Number(params.get('page')) || 1));
      void this.load();
    });

    void this.loadStats();
  }

  updateFilter(patch: Partial<OrderFilters> & { page?: number }): void {
    const next = { ...this.filters(), ...patch };
    const nextPage = patch.page ?? 1;
    const params: Record<string, string> = {};

    if (nextPage > 1) {
      params['page'] = String(nextPage);
    }

    if (next.q) {
      params['q'] = next.q;
    }

    if (next.status !== 'all') {
      params['status'] = next.status;
    }

    if (next.paymentStatus !== 'all') {
      params['paymentStatus'] = next.paymentStatus;
    }

    if (next.paymentMethod !== 'all') {
      params['paymentMethod'] = next.paymentMethod;
    }

    if (next.from) {
      params['from'] = next.from;
    }

    if (next.to) {
      params['to'] = next.to;
    }

    void this.router.navigate([], { relativeTo: this.route, queryParams: params });
  }

  applySearch(): void {
    this.updateFilter({ q: this.searchDraft().trim() });
  }

  clearFilters(): void {
    this.searchDraft.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  goToPage(page: number): void {
    this.updateFilter({ page });
  }

  reload(): void {
    void this.load();
    void this.loadStats();
  }

  async advance(order: Order, status: string): Promise<void> {
    if (!status) {
      return;
    }

    this.advancingId.set(order.id);

    try {
      await this.admin.updateOrderStatus(order.orderNumber, { status: status as OrderStatus });
      this.toast.success(`Order ${order.orderNumber} moved to ${titleCase(status)}`);
      await this.load();
      await this.loadStats();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.advancingId.set(null);
      this.cdr.markForCheck();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      const result = await this.admin.orders(this.query());
      this.orders.set(result.items);
      this.meta.set(result.meta);
    } catch (error) {
      this.failed.set(true);
      this.orders.set([]);
      this.meta.set({});
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadStats(): Promise<void> {
    this.statsLoading.set(true);

    try {
      this.stats.set(await this.admin.orderStats());
    } catch {
      this.stats.set(null);
    } finally {
      this.statsLoading.set(false);
      this.cdr.markForCheck();
    }
  }
}
