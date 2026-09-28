import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ApiMeta, Category, ProductSummary } from '../../../core/api/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate } from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { PriceTag } from '../../../shared/components/price/price';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type StatusFilter = 'all' | 'active' | 'draft' | 'out_of_stock';

interface AdminProductRow extends ProductSummary {
  isActive?: boolean;
  isFeatured?: boolean;
  lowStockThreshold?: number;
}

interface ProductListQuery {
  q: string;
  status: StatusFilter;
  category: string;
  sort: string;
  page: number;
}

@Component({
  selector: 'admin-product-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StatusBadge, Pagination, PriceTag, EmptyState],
  templateUrl: './product-list.page.html',
})
export class AdminProductListPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly items = signal<AdminProductRow[]>([]);
  readonly meta = signal<ApiMeta>({});
  readonly categories = signal<Category[]>([]);
  readonly thresholds = signal<Map<string, number>>(new Map());
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly query = signal<ProductListQuery>({
    q: '',
    status: 'all',
    category: '',
    sort: '-createdAt',
    page: 1,
  });

  readonly searchDraft = signal('');
  readonly editingStockId = signal<string | null>(null);
  readonly stockDraft = signal(0);
  readonly confirmingId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  readonly formatDate = formatDate;

  readonly sortOptions = [
    { value: '-createdAt', label: 'Newest first' },
    { value: 'createdAt', label: 'Oldest first' },
    { value: 'name', label: 'Name A–Z' },
    { value: 'price', label: 'Price: low to high' },
    { value: '-price', label: 'Price: high to low' },
  ] as const;

  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'out_of_stock', label: 'Out of stock' },
  ];

  readonly total = computed(() => this.meta().total ?? this.items().length);
  readonly totalPages = computed(() => this.meta().totalPages ?? 1);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly textOf = (event: Event): string => (event.target as HTMLInputElement).value;
  readonly checkedOf = (event: Event): boolean => (event.target as HTMLInputElement).checked;

  constructor() {
    this.seo.set({
      title: 'Products',
      description: 'Manage the storeroom catalogue.',
      canonicalPath: '/admin/products',
    });

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const next: ProductListQuery = {
        q: params.get('q') ?? '',
        status: this.normalizeStatus(params.get('status')),
        category: params.get('category') ?? '',
        sort: params.get('sort') ?? '-createdAt',
        page: this.parsePage(params.get('page')),
      };

      this.query.set(next);
      this.searchDraft.set(next.q);
      void this.load();
    });

    void this.loadOptions();
  }

  async load(): Promise<void> {
    const { q, status, category, sort, page } = this.query();

    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.admin.products({
        page,
        limit: 12,
        sort,
        q: q || undefined,
        category: category || undefined,
        status,
      });

      this.items.set(result.items);
      this.meta.set(result.meta);
    } catch (error) {
      this.error.set('We could not load the products. Please try again.');
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  onSearch(event: Event): void {
    const value = this.textOf(event);
    this.searchDraft.set(value);

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.updateQuery({ q: value.length > 0 ? value : null, page: 1 });
    }, 350);
  }

  onFilterChange(key: 'status' | 'category' | 'sort', event: Event): void {
    const value = this.textOf(event);
    const params: Record<string, string | number | null> = { page: 1 };
    params[key] = value.length > 0 ? value : null;
    this.updateQuery(params);
  }

  onPageChange(page: number): void {
    this.updateQuery({ page });
  }

  isLowStock(item: AdminProductRow): boolean {
    const threshold = item.lowStockThreshold ?? this.thresholdFor(item.id);

    return item.stock > 0 && item.stock <= threshold;
  }

  isOutOfStock(item: AdminProductRow): boolean {
    return item.stock <= 0;
  }

  startStockEdit(item: AdminProductRow): void {
    this.editingStockId.set(item.id);
    this.stockDraft.set(item.stock);
  }

  cancelStockEdit(): void {
    this.editingStockId.set(null);
  }

  onStockInput(event: Event): void {
    this.stockDraft.set(Number(this.textOf(event)));
  }

  async saveStock(item: AdminProductRow): Promise<void> {
    const value = Math.max(0, Math.trunc(this.stockDraft() || 0));

    this.busyId.set(item.id);

    try {
      await this.admin.updateStock(item.id, value);
      this.items.update((list) =>
        list.map((product) =>
          product.id === item.id ? { ...product, stock: value, inStock: value > 0 } : product,
        ),
      );
      this.toast.success(`${item.name} stock updated`);
      this.editingStockId.set(null);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  async toggleFlag(
    item: AdminProductRow,
    key: 'isActive' | 'isFeatured',
    value: boolean,
  ): Promise<void> {
    if (this.busyId()) {
      return;
    }

    const previous = this.items();
    this.busyId.set(item.id);
    this.items.update((list) =>
      list.map((product) =>
        product.id === item.id
          ? key === 'isFeatured'
            ? { ...product, isFeatured: value }
            : { ...product, isActive: value }
          : product,
      ),
    );

    try {
      await this.admin.updateProductFlags(
        item.id,
        key === 'isFeatured' ? { isFeatured: value } : { isActive: value },
      );
      this.toast.success(
        key === 'isFeatured'
          ? value
            ? 'Marked as featured'
            : 'Removed from featured'
          : value
            ? 'Product published'
            : 'Product moved to draft',
      );
    } catch (error) {
      this.items.set(previous);
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  async duplicate(item: AdminProductRow): Promise<void> {
    this.busyId.set(item.id);

    try {
      await this.admin.duplicateProduct(item.id);
      this.toast.success(`${item.name} duplicated`);
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  askDelete(id: string): void {
    this.confirmingId.set(id);
  }

  cancelDelete(): void {
    this.confirmingId.set(null);
  }

  async confirmDelete(item: AdminProductRow): Promise<void> {
    this.busyId.set(item.id);

    try {
      await this.admin.deleteProduct(item.id);
      this.toast.success(`${item.name} deleted`);
      this.confirmingId.set(null);
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  private thresholdFor(id: string): number {
    return this.thresholds().get(id) ?? 0;
  }

  private async loadOptions(): Promise<void> {
    try {
      const [categories, inventory] = await Promise.all([
        this.admin.categories(),
        this.admin.inventory(),
      ]);

      this.categories.set(categories);
      this.thresholds.set(new Map(inventory.map((row) => [row.id, row.lowStockThreshold])));
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private updateQuery(params: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }

  private normalizeStatus(value: string | null): StatusFilter {
    if (value === 'active' || value === 'draft' || value === 'out_of_stock') {
      return value;
    }

    return 'all';
  }

  private parsePage(value: string | null): number {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
  }
}
