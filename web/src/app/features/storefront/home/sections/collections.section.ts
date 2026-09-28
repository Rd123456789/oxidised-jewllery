import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Collection } from '../../../../core/api/api.models';
import { CatalogService } from '../../../../core/services/catalog.service';
import { Icon } from '../../../../shared/components/icon/icon';

@Component({
  selector: 'app-collections-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: { class: 'block ox-reveal' },
  templateUrl: './collections.section.html',
})
export class CollectionsSection {
  private readonly catalog = inject(CatalogService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly collections = signal<Collection[]>([]);
  readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const collections = await this.catalog.getCollections();
      this.collections.set(collections.filter((collection) => collection.isFeatured).slice(0, 4));
    } catch {
      this.collections.set([]);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
