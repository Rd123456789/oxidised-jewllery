import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  Address,
  ApiMeta,
  CustomerSummary,
  Order,
  UserRole,
} from '../../../core/api/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  formatCurrency,
  formatDate,
  orderStatusTone,
  relativeTime,
  titleCase,
} from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

const ROLES: UserRole[] = ['customer', 'manager', 'admin'];
const PAGE_SIZE = 20;

interface CustomerFilters {
  q: string;
  role: UserRole | 'all';
  active: 'all' | 'active' | 'inactive';
}

interface CustomerDetail {
  customer: CustomerSummary & { addresses: unknown[] };
  stats: { orderCount: number; lifetimeValue: number };
  orders: Order[];
}

interface EditForm {
  name: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  marketingOptIn: boolean;
}

const EMPTY_FILTERS: CustomerFilters = { q: '', role: 'all', active: 'all' };

@Component({
  selector: 'admin-customer-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, StatusBadge, Pagination, EmptyState],
  templateUrl: './customer-list.page.html',
})
export class AdminCustomerListPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly roles = ROLES;

  readonly customers = signal<CustomerSummary[]>([]);
  readonly meta = signal<ApiMeta>({});
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly page = signal(1);
  readonly searchDraft = signal('');
  readonly filters = signal<CustomerFilters>({ ...EMPTY_FILTERS });

  readonly expandedId = signal<string | null>(null);
  readonly detail = signal<CustomerDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly saving = signal(false);
  readonly confirmingId = signal<string | null>(null);
  readonly editForm = signal<EditForm>({
    name: '',
    phone: '',
    role: 'customer',
    isActive: true,
    marketingOptIn: false,
  });

  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly relativeTime = relativeTime;
  readonly titleCase = titleCase;
  readonly orderStatusTone = orderStatusTone;

  readonly currentUserId = computed(() => this.session.user()?.id ?? null);
  readonly totalPages = computed(() => Number(this.meta().totalPages ?? 1) || 1);
  readonly total = computed(() => Number(this.meta().total ?? 0));
  readonly hasFilters = computed(() => {
    const filters = this.filters();

    return filters.q !== '' || filters.role !== 'all' || filters.active !== 'all';
  });

  readonly query = computed<Record<string, unknown>>(() => {
    const filters = this.filters();
    const query: Record<string, unknown> = { page: this.page(), limit: PAGE_SIZE };

    if (filters.q) {
      query['q'] = filters.q;
    }

    if (filters.role !== 'all') {
      query['role'] = filters.role;
    }

    if (filters.active !== 'all') {
      query['isActive'] = filters.active === 'active';
    }

    return query;
  });

  constructor() {
    this.seo.set({ title: 'Customers', description: 'Manage customer accounts.' });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const filters: CustomerFilters = {
        q: params.get('q') ?? '',
        role: (params.get('role') as UserRole | null) ?? 'all',
        active: (params.get('active') as CustomerFilters['active'] | null) ?? 'all',
      };

      this.filters.set(filters);
      this.searchDraft.set(filters.q);
      this.page.set(Math.max(1, Number(params.get('page')) || 1));
      this.collapse();
      void this.load();
    });
  }

  updateFilter(patch: Partial<CustomerFilters> & { page?: number }): void {
    const next = { ...this.filters(), ...patch };
    const nextPage = patch.page ?? 1;
    const params: Record<string, string> = {};

    if (nextPage > 1) {
      params['page'] = String(nextPage);
    }

    if (next.q) {
      params['q'] = next.q;
    }

    if (next.role !== 'all') {
      params['role'] = next.role;
    }

    if (next.active !== 'all') {
      params['active'] = next.active;
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
  }

  canDelete(customer: CustomerSummary): boolean {
    if (customer.role === 'admin' || customer.role === 'manager') {
      return false;
    }

    return customer.id !== this.currentUserId();
  }

  customerAddresses(): Address[] {
    const addresses = this.detail()?.customer.addresses;

    return Array.isArray(addresses) ? (addresses as Address[]) : [];
  }

  async toggleExpand(customer: CustomerSummary): Promise<void> {
    if (this.expandedId() === customer.id) {
      this.collapse();

      return;
    }

    this.expandedId.set(customer.id);
    this.detail.set(null);
    this.detailLoading.set(true);

    try {
      const detail = await this.admin.customer(customer.id);
      this.detail.set(detail);
      this.editForm.set({
        name: detail.customer.name,
        phone: detail.customer.phone ?? '',
        role: detail.customer.role,
        isActive: detail.customer.isActive,
        marketingOptIn: detail.customer.marketingOptIn,
      });
    } catch (error) {
      this.toast.error(error);
      this.expandedId.set(null);
    } finally {
      this.detailLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  collapse(): void {
    this.expandedId.set(null);
    this.detail.set(null);
  }

  patchEdit(patch: Partial<EditForm>): void {
    this.editForm.update((form) => ({ ...form, ...patch }));
  }

  async saveEdit(customer: CustomerSummary): Promise<void> {
    const form = this.editForm();

    this.saving.set(true);

    try {
      await this.admin.updateCustomer(customer.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        isActive: form.isActive,
        marketingOptIn: form.marketingOptIn,
      });
      this.toast.success('Customer updated');
      await this.load();

      if (this.expandedId() === customer.id) {
        const detail = await this.admin.customer(customer.id);
        this.detail.set(detail);
      }
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  async remove(customer: CustomerSummary): Promise<void> {
    try {
      await this.admin.deleteCustomer(customer.id);
      this.toast.success(`${customer.name} deleted`);
      this.confirmingId.set(null);

      if (this.expandedId() === customer.id) {
        this.collapse();
      }

      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      const result = await this.admin.customers(this.query());
      this.customers.set(result.items);
      this.meta.set(result.meta);
    } catch (error) {
      this.failed.set(true);
      this.customers.set([]);
      this.meta.set({});
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
