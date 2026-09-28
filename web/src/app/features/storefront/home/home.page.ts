import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Banner } from '../../../core/api/api.models';
import { CatalogService } from '../../../core/services/catalog.service';
import { ContentService } from '../../../core/services/content.service';
import { SeoService } from '../../../core/services/seo.service';
import { Icon } from '../../../shared/components/icon/icon';
import { RecentlyViewed } from '../../../shared/components/recently-viewed/recently-viewed';
import { CategoryStripSection } from './sections/category-strip.section';
import { CollectionsSection } from './sections/collections.section';
import { FeaturedProductsSection } from './sections/featured-products.section';
import { NewArrivalsSection } from './sections/new-arrivals.section';

const SLIDE_INTERVAL_MS = 6500;

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Icon,
    FeaturedProductsSection,
    CategoryStripSection,
    CollectionsSection,
    NewArrivalsSection,
    RecentlyViewed,
  ],
  templateUrl: './home.page.html',
})
export class HomePage {
  private readonly catalog = inject(CatalogService);
  private readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly banners = signal<Banner[]>([]);
  readonly activeIndex = signal(0);
  readonly loaded = signal(false);
  readonly hidden = signal(false);

  /** Single-element array keyed by banner id, so `@for` rebuilds the copy and replays the animation. */
  readonly activeBanners = computed(() => {
    const banner = this.banners()[this.activeIndex()];

    return banner ? [banner] : [];
  });

  readonly settings = this.content.settings;

  readonly trustPoints = [
    { icon: 'shield' as const, title: 'Nickel-free alloys', copy: 'Safe for sensitive skin' },
    { icon: 'truck' as const, title: 'Free shipping over ₹999', copy: 'Dispatched in 2 days' },
    { icon: 'refresh' as const, title: '7-day easy returns', copy: 'No questions asked' },
    { icon: 'sparkles' as const, title: 'Hand-finished', copy: 'Small batch, artisan made' },
  ];

  constructor() {
    this.seo.set({
      title: 'Handcrafted oxidised jewellery',
      description:
        'Shop handcrafted oxidised silver earrings, chokers, bangles and bridal sets. Nickel-free, artisan made, free shipping over ₹999.',
      canonicalPath: '/',
    });

    void this.load();
    this.startAutoplay();
  }

  setSlide(index: number): void {
    this.activeIndex.set(index);
  }

  next(): void {
    const total = this.banners().length;

    if (total === 0) {
      return;
    }

    this.activeIndex.update((index) => (index + 1) % total);
  }

  previous(): void {
    const total = this.banners().length;

    if (total === 0) {
      return;
    }

    this.activeIndex.update((index) => (index - 1 + total) % total);
  }

  private startAutoplay(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // A backgrounded tab keeps the interval throttled anyway; skipping the advance also
    // stops the slider from jumping several slides when the tab is restored.
    const onVisibilityChange = () => this.hidden.set(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const handle = setInterval(() => {
      if (!this.hidden() && this.banners().length > 1) {
        this.next();
      }
    }, SLIDE_INTERVAL_MS);

    this.destroyRef.onDestroy(() => {
      clearInterval(handle);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }

  private async load(): Promise<void> {
    try {
      const banners = await this.catalog.getBanners('hero');
      this.banners.set(banners);
    } catch {
      this.banners.set([]);
    } finally {
      this.loaded.set(true);
      this.cdr.markForCheck();
    }
  }
}
