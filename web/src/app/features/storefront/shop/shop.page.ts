import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import type {
  ApiMeta,
  Category,
  ProductFacets,
  ProductQuery,
  ProductSummary,
} from '../../../core/api/api.models';
import { CatalogService } from '../../../core/services/catalog.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { RecentlyViewed } from '../../../shared/components/recently-viewed/recently-viewed';
import { SkeletonGrid } from '../../../shared/components/skeleton-grid/skeleton-grid';

const PAGE_SIZE = 12;

type FacetKey = 'colors' | 'materials' | 'stones' | 'occasions' | 'tags';

interface ShopFilters {
  category: string | null;
  collection: string | null;
  q: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  colors: string[];
  materials: string[];
  stones: string[];
  occasions: string[];
  tags: string[];
  inStock: boolean;
  onSale: boolean;
  sort: string;
  page: number;
}

type QueryPatch = Record<string, string | number | boolean | string[] | null>;

@Component({
  selector: 'shop-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductCard, SkeletonGrid, EmptyState, Pagination, RecentlyViewed],
  templateUrl: './shop.page.html',
})
export class ShopPage {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly filters = signal<ShopFilters>(this.parseFilters(this.route.snapshot.queryParamMap));
  readonly categories = signal<Category[]>([]);
  readonly facets = signal<ProductFacets | null>(null);
  readonly items = signal<ProductSummary[]>([]);
  readonly meta = signal<ApiMeta>({});
  readonly suggestions = signal<ProductSummary[]>([]);
  readonly loading = signal(true);
  readonly filtersOpen = signal(false);

  readonly minPriceInput = signal<number | null>(null);
  readonly maxPriceInput = signal<number | null>(null);

  readonly sortOptions = [
    { value: 'featured', label: 'Featured' },
    { value: '-createdAt', label: 'Newest' },
    { value: 'price', label: 'Price: low to high' },
    { value: '-price', label: 'Price: high to low' },
    { value: '-ratingsAverage', label: 'Top rated' },
    { value: '-soldCount', label: 'Best selling' },
  ];

  readonly activeCategory = computed(() => {
    const slug = this.filters().category;

    return slug ? (this.categories().find((category) => category.slug === slug) ?? null) : null;
  });

  readonly totalPages = computed(() => {
    const meta = this.meta();

    return meta.totalPages ?? Math.max(1, Math.ceil((meta.total ?? 0) / PAGE_SIZE));
  });

  readonly activeFilterCount = computed(() => {
    const filters = this.filters();

    let count = filters.colors.length + filters.materials.length + filters.stones.length;
    count += filters.occasions.length + filters.tags.length;

    if (filters.category) {
      count += 1;
    }

    if (filters.collection) {
      count += 1;
    }

    if (filters.q) {
      count += 1;
    }

    if (filters.minPrice !== null || filters.maxPrice !== null) {
      count += 1;
    }

    if (filters.inStock) {
      count += 1;
    }

    if (filters.onSale) {
      count += 1;
    }

    return count;
  });

  private facetCategory: string | null | undefined = undefined;

  private readonly swatches: Record<string, string> = {
    gold: '#c9a227',
    silver: '#b9bcc0',
    rose: '#c98a86',
    'rose gold': '#c98a86',
    black: '#1f1a17',
    white: '#f8f5f0',
    red: '#a8463f',
    maroon: '#7c2f2a',
    green: '#4f6f52',
    emerald: '#2f6f52',
    blue: '#2f6fb0',
    navy: '#27406b',
    pink: '#d78fa6',
    purple: '#6b4f8a',
    orange: '#c47a2f',
    brown: '#6f4a2b',
    beige: '#ded0bd',
    ivory: '#faf7f2',
    grey: '#8b7d72',
    gray: '#8b7d72',
    yellow: '#c9a227',
    multicolour: 'linear-gradient(135deg, #c9a227, #a8463f, #2f6fb0)',
    multicolor: 'linear-gradient(135deg, #c9a227, #a8463f, #2f6fb0)',
  };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const filters = this.parseFilters(params);
      this.filters.set(filters);
      this.minPriceInput.set(filters.minPrice);
      this.maxPriceInput.set(filters.maxPrice);
      this.syncFacets(filters.category);
      this.updateSeo();
      void this.loadProducts();
    });

    void this.loadCategories();
    void this.loadSuggestions();
  }

  selectCategory(slug: string | null): void {
    this.applyQuery({ category: slug });
  }

  selectCollection(slug: string | null): void {
    this.applyQuery({ collection: slug });
  }

  toggleFacet(key: FacetKey, value: string): void {
    const current = this.filters()[key];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];

    this.applyQuery({ [key]: next.length > 0 ? next : null });
  }

  isSelected(key: FacetKey, value: string): boolean {
    return this.filters()[key].includes(value);
  }

  onMinPrice(event: Event): void {
    this.minPriceInput.set(this.readNumber(event));
  }

  onMaxPrice(event: Event): void {
    this.maxPriceInput.set(this.readNumber(event));
  }

  applyPrice(): void {
    this.applyQuery({ minPrice: this.minPriceInput(), maxPrice: this.maxPriceInput() });
  }

  toggleInStock(): void {
    this.applyQuery({ inStock: this.filters().inStock ? null : true });
  }

  toggleOnSale(): void {
    this.applyQuery({ onSale: this.filters().onSale ? null : true });
  }

  onSort(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.applyQuery({ sort: value === 'featured' ? null : value });
  }

  goToPage(page: number): void {
    this.applyQuery({ page: page > 1 ? page : null }, false);
  }

  clearAll(): void {
    this.filtersOpen.set(false);
    void this.router.navigate(['/shop']);
  }

  swatchColor(color: string): string {
    return this.swatches[color.toLowerCase()] ?? '#ded0bd';
  }

  private applyQuery(patch: QueryPatch, resetPage = true): void {
    const queryParams: QueryPatch = resetPage ? { ...patch, page: null } : patch;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private async loadProducts(): Promise<void> {
    this.loading.set(true);

    try {
      const result = await this.catalog.listProducts(this.buildQuery(this.filters()));
      this.items.set(result.items);
      this.meta.set(result.meta);
    } catch (error) {
      this.items.set([]);
      this.meta.set({});
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.catalog.getCategories());
      this.updateSeo();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async loadSuggestions(): Promise<void> {
    try {
      const result = await this.catalog.listProducts({ featured: true, limit: 4 });
      this.suggestions.set(result.items);
    } catch {
      this.suggestions.set([]);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private syncFacets(category: string | null): void {
    if (this.facetCategory === category) {
      return;
    }

    this.facetCategory = category;
    void this.loadFacets(category ?? undefined);
  }

  private async loadFacets(category?: string): Promise<void> {
    try {
      this.facets.set(await this.catalog.getFacets(category));
    } catch {
      this.facets.set(null);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private updateSeo(): void {
    const filters = this.filters();
    const category = this.activeCategory();
    const title = filters.q
      ? `Search: ${filters.q}`
      : (category?.name ?? 'Shop all jewellery');

    this.seo.set({
      title,
      description:
        category?.description ??
        category?.shortDescription ??
        'Browse handcrafted oxidised silver earrings, chokers, bangles and bridal sets.',
      canonicalPath: filters.category ? `/shop?category=${filters.category}` : '/shop',
    });
  }

  private buildQuery(filters: ShopFilters): ProductQuery {
    return {
      page: filters.page,
      limit: PAGE_SIZE,
      sort: filters.sort === 'featured' ? undefined : filters.sort,
      q: filters.q ?? undefined,
      category: filters.category ?? undefined,
      collection: filters.collection ?? undefined,
      minPrice: filters.minPrice ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      colors: filters.colors.length > 0 ? filters.colors : undefined,
      materials: filters.materials.length > 0 ? filters.materials : undefined,
      stones: filters.stones.length > 0 ? filters.stones : undefined,
      occasions: filters.occasions.length > 0 ? filters.occasions : undefined,
      tags: filters.tags.length > 0 ? filters.tags : undefined,
      inStock: filters.inStock || undefined,
      onSale: filters.onSale || undefined,
    };
  }

  private parseFilters(params: ParamMap): ShopFilters {
    return {
      category: params.get('category'),
      collection: params.get('collection'),
      q: params.get('q'),
      minPrice: this.parseNumber(params.get('minPrice')),
      maxPrice: this.parseNumber(params.get('maxPrice')),
      colors: params.getAll('colors'),
      materials: params.getAll('materials'),
      stones: params.getAll('stones'),
      occasions: params.getAll('occasions'),
      tags: params.getAll('tags'),
      inStock: params.get('inStock') === 'true',
      onSale: params.get('onSale') === 'true',
      sort: params.get('sort') ?? 'featured',
      page: this.parseNumber(params.get('page')) ?? 1,
    };
  }

  private parseNumber(value: string | null): number | null {
    if (value === null || value.trim() === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private readNumber(event: Event): number | null {
    return this.parseNumber((event.target as HTMLInputElement).value);
  }
}
