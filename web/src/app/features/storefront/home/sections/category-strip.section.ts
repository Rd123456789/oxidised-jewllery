import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../../../core/services/catalog.service';
import { Icon } from '../../../../shared/components/icon/icon';
import { SectionHeader } from '../../../../shared/components/section-header/section-header';

@Component({
  selector: 'app-category-strip-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, SectionHeader],
  host: { class: 'block ox-reveal' },
  templateUrl: './category-strip.section.html',
})
export class CategoryStripSection {
  private readonly catalog = inject(CatalogService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly categories = this.catalog.categories;
  readonly loading = signal(true);
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  constructor() {
    void this.catalog
      .getCategories()
      .catch(() => [])
      .finally(() => {
        this.loading.set(false);
        this.cdr.markForCheck();
      });
  }
}
