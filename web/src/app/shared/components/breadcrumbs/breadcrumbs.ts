import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icon/icon';

export interface BreadcrumbItem {
  label: string;
  link?: string | readonly unknown[];
  queryParams?: Record<string, unknown>;
}

@Component({
  selector: 'app-breadcrumbs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <nav aria-label="Breadcrumb">
      <ol class="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        @for (crumb of items(); track $index; let last = $last) {
          <li class="flex items-center gap-1.5">
            @if (!last && crumb.link) {
              <a
                [routerLink]="crumb.link"
                [queryParams]="crumb.queryParams ?? {}"
                class="hover:text-brass"
              >
                {{ crumb.label }}
              </a>
            } @else {
              <span class="text-ink-soft" [attr.aria-current]="last ? 'page' : null">
                {{ crumb.label }}
              </span>
            }
            @if (!last) {
              <app-icon name="chevron-right" [size]="12" />
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class Breadcrumbs {
  readonly items = input.required<BreadcrumbItem[]>();
}
