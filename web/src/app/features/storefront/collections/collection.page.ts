import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api/api-error';
import type { Collection, ProductSummary } from '../../../core/api/api.models';
import { CatalogService } from '../../../core/services/catalog.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { SkeletonGrid } from '../../../shared/components/skeleton-grid/skeleton-grid';

@Component({
  selector: 'collection-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductCard, SkeletonGrid, EmptyState],
  templateUrl: './collection.page.html',
})
export class CollectionPage {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly slug = input.required<string>();

  readonly collection = signal<Collection | null>(null);
  readonly products = signal<ProductSummary[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  constructor() {
    effect(() => {
      const slug = this.slug();
      void this.load(slug);
    });
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    this.collection.set(null);
    this.products.set([]);

    try {
      const response = await this.catalog.getCollection(slug);
      this.collection.set(response.collection);
      this.products.set(response.products);
      this.seo.set({
        title: response.collection.name,
        description: response.collection.description ?? response.collection.tagline,
        image:
          response.collection.heroImage?.url ?? response.collection.thumbnail?.url,
        canonicalPath: `/collections/${response.collection.slug}`,
      });
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
}
