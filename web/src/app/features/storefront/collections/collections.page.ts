import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Collection } from '../../../core/api/api.models';
import { CatalogService } from '../../../core/services/catalog.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';

@Component({
  selector: 'collections-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, EmptyState],
  templateUrl: './collections.page.html',
})
export class CollectionsPage {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly collections = signal<Collection[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.seo.set({
      title: 'Collections',
      description:
        'Curated edits of handcrafted oxidised silver jewellery — bridal sets, everyday studs and festive favourites.',
      canonicalPath: '/collections',
    });

    void this.load();
  }

  productCount(collection: Collection): number {
    return collection.productCount ?? collection.products?.length ?? 0;
  }

  private async load(): Promise<void> {
    try {
      const collections = await this.catalog.getCollections();
      this.collections.set(collections.filter((collection) => collection.isActive));
    } catch (error) {
      this.collections.set([]);
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
