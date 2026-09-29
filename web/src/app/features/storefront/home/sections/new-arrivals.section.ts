import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import type { ProductSummary } from '../../../../core/api/api.models';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ProductCard } from '../../../../shared/components/product-card/product-card';
import { SectionHeader } from '../../../../shared/components/section-header/section-header';

@Component({
  selector: 'app-new-arrivals-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCard, SectionHeader],
  host: { class: 'block ox-reveal' },
  templateUrl: './new-arrivals.section.html',
})
export class NewArrivalsSection {
  private readonly catalog = inject(CatalogService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly products = signal<ProductSummary[]>([]);
  readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const result = await this.catalog.listProducts({ newArrival: true, limit: 4 });
      this.products.set(result.items);
    } catch {
      this.products.set([]);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
