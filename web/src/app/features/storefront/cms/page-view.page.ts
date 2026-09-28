import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject, input, signal } from '@angular/core';
import { ApiError } from '../../../core/api/api-error';
import type { CmsPage } from '../../../core/api/api.models';
import { ContentService } from '../../../core/services/content.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate } from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({
  selector: 'page-view-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState],
  templateUrl: './page-view.page.html',
})
export class PageViewPage {
  private readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly slug = input.required<string>();

  readonly page = signal<CmsPage | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly formatDate = formatDate;

  constructor() {
    effect(() => {
      const slug = this.slug();
      void this.load(slug);
    });
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    this.page.set(null);

    try {
      const page = await this.content.getPage(slug);
      this.page.set(page);
      this.seo.set({
        title: page.title,
        description: page.excerpt,
        type: 'article',
        canonicalPath: `/pages/${page.slug}`,
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
