import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Product, ProductSummary } from '../../../../core/api/api.models';
import { CartService } from '../../../../core/services/cart.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PriceTag } from '../../../../shared/components/price/price';
import { ProductCard } from '../../../../shared/components/product-card/product-card';
import { ScrollRail } from '../../../../shared/components/scroll-rail/scroll-rail';
import { SectionHeader } from '../../../../shared/components/section-header/section-header';

@Component({
  selector: 'app-featured-products-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductCard, ScrollRail, SectionHeader],
  host: { class: 'block ox-reveal' },
  templateUrl: './featured-products.section.html',
})
export class FeaturedProductsSection {
  private readonly catalog = inject(CatalogService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly eyebrow = input('Handpicked');
  readonly title = input('Most loved this season');
  readonly limit = input(8);

  readonly products = signal<ProductSummary[]>([]);
  readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const result = await this.catalog.listProducts({ featured: true, limit: this.limit() });
      this.products.set(result.items);
    } catch {
      this.products.set([]);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
