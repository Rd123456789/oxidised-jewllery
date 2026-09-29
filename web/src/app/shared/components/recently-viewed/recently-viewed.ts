import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecentlyViewedService } from '../../../core/services/recently-viewed.service';
import { formatCurrency } from '../../../core/utils/format';
import { Icon } from '../icon/icon';

/**
 * Horizontal rail of previously viewed products, shared by the home, shop and product
 * pages. Backed by localStorage via `RecentlyViewedService`, so it survives reloads and
 * updates everywhere the moment a product is opened. Renders nothing when the visitor
 * has no history, so callers can drop it in unconditionally without leaving a gap.
 */
@Component({
  selector: 'app-recently-viewed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    @if (items().length > 0) {
      <section class="ox-container ox-section--tight">
        <header class="mb-6">
          <p class="ox-eyebrow">Pick up where you left off</p>
          <h2 class="ox-h2 mt-2 text-ink">Recently viewed</h2>
        </header>
        <div class="ox-stagger flex gap-4 overflow-x-auto pb-2">
          @for (recent of items(); track recent.slug) {
            <a
              [routerLink]="['/product', recent.slug]"
              class="w-40 shrink-0 overflow-hidden rounded-2xl border border-sand-deep/60 bg-paper active:opacity-95"
            >
              @if (recent.image) {
                <img
                  [src]="recent.image"
                  [alt]="recent.name"
                  loading="lazy"
                  class="aspect-square w-full object-cover"
                />
              } @else {
                <div class="flex aspect-square w-full items-center justify-center bg-sand text-sand-deep">
                  <app-icon name="sparkles" [size]="28" />
                </div>
              }
              <div class="p-3">
                <p class="line-clamp-2 text-xs text-ink-soft">{{ recent.name }}</p>
                <p class="mt-1 text-sm font-semibold text-ink">
                  {{ formatCurrency(recent.price, 'INR') }}
                </p>
              </div>
            </a>
          }
        </div>
      </section>
    }
  `,
})
export class RecentlyViewed {
  private readonly service = inject(RecentlyViewedService);

  readonly items = this.service.list;

  readonly formatCurrency = formatCurrency;
}
