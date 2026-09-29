import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icon/icon';

/**
 * One section header for every storefront band: quiet eyebrow, display heading and an
 * optional "view all" text link. Storefront pages previously hand-rolled four variants.
 */
@Component({
  selector: 'app-section-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div class="min-w-0">
        <p class="ox-eyebrow">{{ eyebrow() }}</p>
        <h2 class="ox-h2 mt-2 text-ink">{{ title() }}</h2>
        @if (description()) {
          <p class="mt-3 max-w-[42rem] text-sm leading-relaxed text-ink-soft">{{ description() }}</p>
        }
      </div>

      @if (linkLabel(); as label) {
        <a
          [routerLink]="linkRoute()"
          [queryParams]="linkQueryParams()"
          class="ox-link-arrow shrink-0 self-start sm:self-auto"
        >
          {{ label }}
          <app-icon name="arrow-right" [size]="14" />
        </a>
      }
    </header>
  `,
})
export class SectionHeader {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input('');
  readonly linkLabel = input<string | null>(null);
  readonly linkRoute = input<string>('/shop');
  readonly linkQueryParams = input<Record<string, string | number | boolean>>({});
}
