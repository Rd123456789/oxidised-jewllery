import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '../../../core/api/api.models';
import { CatalogService } from '../../../core/services/catalog.service';
import { SeoService } from '../../../core/services/seo.service';
import { Icon } from '../../../shared/components/icon/icon';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { SkeletonGrid } from '../../../shared/components/skeleton-grid/skeleton-grid';

@Component({
  selector: 'not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductCard, SkeletonGrid],
  templateUrl: './not-found.page.html',
})
export class NotFoundPage {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly products = signal<ProductSummary[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.seo.set({
      title: 'Page not found',
      description: 'The page you were looking for does not exist. Browse our handcrafted jewellery instead.',
      canonicalPath: '/404',
    });

    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const result = await this.catalog.listProducts({ featured: true, limit: 4 });
      this.products.set(result.items);
    } catch {
      this.products.set([]);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
