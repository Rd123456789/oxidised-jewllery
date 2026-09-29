import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ApiError } from '../../../core/api/api-error';
import type {
  Product,
  ProductReview,
  ProductSummary,
  ReviewSummary,
} from '../../../core/api/api.models';
import { CartService } from '../../../core/services/cart.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { RecentlyViewedService } from '../../../core/services/recently-viewed.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { formatCurrency, formatDate } from '../../../core/utils/format';
import { Breadcrumbs, type BreadcrumbItem } from '../../../shared/components/breadcrumbs/breadcrumbs';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon, type IconName } from '../../../shared/components/icon/icon';
import { PriceTag } from '../../../shared/components/price/price';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { QuantityStepper } from '../../../shared/components/quantity-stepper/quantity-stepper';
import { RatingStars } from '../../../shared/components/rating-stars/rating-stars';
import { RecentlyViewed } from '../../../shared/components/recently-viewed/recently-viewed';

type ProductTab = 'description' | 'specifications' | 'care';

function toWishlistSummary(product: Product): ProductSummary {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price,
    mrp: product.mrp,
    discountPercent: product.discountPercent,
    currency: product.currency,
    image: product.primaryImage?.url ?? product.images[0]?.url,
    inStock: product.inStock,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    rating: product.ratingsAverage,
    ratingCount: product.ratingsCount,
    badges: product.badges,
    colors: product.colors,
    occasions: product.occasions,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    isBestSeller: product.isBestSeller,
    category: product.category,
  };
}

function pathFor(crumb: BreadcrumbItem): string {
  const path = typeof crumb.link === 'string' ? crumb.link : '';
  const params = crumb.queryParams as Record<string, string> | undefined;

  if (!params || Object.keys(params).length === 0) {
    return path;
  }

  return `${path}?${new URLSearchParams(params).toString()}`;
}

@Component({
  selector: 'product-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Icon,
    PriceTag,
    RatingStars,
    QuantityStepper,
    ProductCard,
    EmptyState,
    Breadcrumbs,
    RecentlyViewed,
  ],
  templateUrl: './product.page.html',
})
export class ProductPage {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly recent = inject(RecentlyViewedService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly wishlist = inject(WishlistService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly slug = input.required<string>();

  readonly product = signal<Product | null>(null);
  readonly related = signal<ProductSummary[]>([]);
  readonly reviews = signal<ProductReview[]>([]);
  readonly reviewSummary = signal<ReviewSummary | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly activeImage = signal(0);
  readonly selectedVariantSku = signal<string | null>(null);
  readonly quantity = signal(1);
  readonly adding = signal(false);
  readonly activeTab = signal<ProductTab>('description');

  readonly inWishlist = computed(() => {
    const product = this.product();

    return product ? this.wishlist.has(product.id) : false;
  });

  readonly wishlistButtonClass = computed(() =>
    this.inWishlist()
      ? 'ox-btn ox-btn--lg border-rose bg-rose text-ivory'
      : 'ox-btn ox-btn--outline ox-btn--lg',
  );

  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const product = this.product();

    if (!product) {
      return [];
    }

    return [
      { label: 'Home', link: '/' },
      { label: 'Shop', link: '/shop' },
      {
        label: product.category.name,
        link: '/shop',
        queryParams: { category: product.category.slug },
      },
      { label: product.name },
    ];
  });

  readonly formatDate = formatDate;
  readonly formatCurrency = formatCurrency;

  readonly tabs: { id: ProductTab; label: string }[] = [
    { id: 'description', label: 'Description' },
    { id: 'specifications', label: 'Specifications' },
    { id: 'care', label: 'Care instructions' },
  ];

  readonly trustPoints: { icon: IconName; label: string }[] = [
    { icon: 'truck', label: 'Free shipping over ₹999' },
    { icon: 'shield', label: 'Nickel-free alloy' },
    { icon: 'refresh', label: '7-day easy returns' },
  ];

  readonly images = computed(() => {
    const product = this.product();

    if (!product) {
      return [];
    }

    return [...product.images].sort((left, right) => {
      const primary = Number(right.isPrimary ?? false) - Number(left.isPrimary ?? false);

      if (primary !== 0) {
        return primary;
      }

      return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    });
  });

  readonly activeImageUrl = computed(() => {
    const images = this.images();

    return images[this.activeImage()]?.url ?? this.product()?.primaryImage?.url ?? null;
  });

  readonly selectedVariant = computed(() => {
    const sku = this.selectedVariantSku();

    return sku ? (this.product()?.variants.find((variant) => variant.sku === sku) ?? null) : null;
  });

  readonly resolvedPrice = computed(
    () => this.selectedVariant()?.price ?? this.product()?.price ?? 0,
  );

  readonly resolvedMrp = computed(() => this.selectedVariant()?.mrp ?? this.product()?.mrp);

  readonly resolvedStock = computed(
    () => this.selectedVariant()?.stock ?? this.product()?.stock ?? 0,
  );

  readonly lowStock = computed(() => {
    const stock = this.resolvedStock();
    const threshold = this.product()?.lowStockThreshold ?? 0;

    return stock > 0 && stock <= threshold;
  });

  readonly ratingBars = computed(() => {
    const summary = this.reviewSummary();
    const total = summary?.count ?? 0;

    return [5, 4, 3, 2, 1].map((stars) => {
      const count = summary?.breakdown?.[String(stars)] ?? 0;

      return {
        stars,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  });

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
    multicolour: 'linear-gradient(135deg, #c9a227, #a8463f, #2f6fb0)',
    multicolor: 'linear-gradient(135deg, #c9a227, #a8463f, #2f6fb0)',
  };

  constructor() {
    effect(() => {
      const slug = this.slug();
      void this.load(slug);
    });

    this.destroyRef.onDestroy(() => {
      this.seo.clearJsonLd('product');
      this.seo.clearJsonLd('breadcrumb');
    });
  }

  swatchColor(color: string): string {
    return this.swatches[color.toLowerCase()] ?? '#ded0bd';
  }

  selectVariant(sku: string): void {
    this.selectedVariantSku.set(this.selectedVariantSku() === sku ? null : sku);
    this.quantity.set(1);
    this.cdr.markForCheck();
  }

  selectImage(index: number): void {
    this.activeImage.set(index);
    this.cdr.markForCheck();
  }

  variantDelta(amount: number): string {
    return this.formatCurrency(amount, this.product()?.currency ?? 'INR');
  }

  async addToBag(): Promise<void> {
    const product = this.product();

    if (!product || !product.inStock || this.resolvedStock() <= 0) {
      return;
    }

    this.adding.set(true);

    try {
      await this.cart.add(product.id, this.quantity(), this.selectedVariantSku() ?? undefined);
    } finally {
      this.adding.set(false);
      this.cdr.markForCheck();
    }
  }

  async toggleWishlist(): Promise<void> {
    const product = this.product();

    if (!product) {
      return;
    }

    try {
      const result = await this.wishlist.toggle(toWishlistSummary(product));
      this.toast.success(result.inWishlist ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    this.product.set(null);
    this.related.set([]);
    this.reviews.set([]);
    this.reviewSummary.set(null);
    this.selectedVariantSku.set(null);
    this.quantity.set(1);
    this.activeImage.set(0);

    try {
      const product = await this.catalog.getProduct(slug);
      this.product.set(product);
      this.updateSeo(product);
      this.remember(product);
      void this.loadRelated(slug);
      void this.loadReviews(slug);
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) {
        this.notFound.set(true);
      } else {
        this.toast.error(error);
      }
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadRelated(slug: string): Promise<void> {
    try {
      this.related.set(await this.catalog.getRelated(slug, 4));
    } catch (error) {
      this.related.set([]);
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async loadReviews(slug: string): Promise<void> {
    try {
      const response = await this.catalog.getReviews(slug);
      this.reviews.set(response.reviews);
      this.reviewSummary.set(response.summary);
    } catch (error) {
      this.reviews.set([]);
      this.reviewSummary.set(null);
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private updateSeo(product: Product): void {
    const image = product.primaryImage?.url ?? this.images()[0]?.url;

    this.seo.set({
      title: product.metaTitle ?? product.name,
      description: product.metaDescription ?? product.shortDescription,
      image,
      type: 'product',
      canonicalPath: `/product/${product.slug}`,
    });

    this.seo.setJsonLd('product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.shortDescription ?? product.description,
      image: this.images().map((asset) => asset.url),
      sku: product.sku,
      brand: { '@type': 'Brand', name: 'Oxidised Jewellery' },
      offers: {
        '@type': 'Offer',
        priceCurrency: product.currency,
        price: product.price,
        availability: product.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        url: `/product/${product.slug}`,
      },
      aggregateRating:
        product.ratingsCount > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: product.ratingsAverage,
              reviewCount: product.ratingsCount,
            }
          : undefined,
    });

    const breadcrumbs = this.breadcrumbs();

    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label,
        item: crumb.link ? this.seo.absoluteUrl(pathFor(crumb)) : undefined,
      })),
    });
  }

  private remember(product: Product): void {
    this.recent.record({
      name: product.name,
      slug: product.slug,
      image: product.primaryImage?.url,
      price: product.price,
    });
  }
}
