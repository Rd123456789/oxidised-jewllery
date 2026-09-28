import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (totalPages() > 1) {
      <nav class="flex items-center justify-center gap-2" aria-label="Pagination">
        <button
          type="button"
          class="ox-btn ox-btn--outline ox-btn--sm"
          [disabled]="page() <= 1"
          (click)="go(page() - 1)"
        >
          <app-icon name="chevron-left" [size]="14" />
          Prev
        </button>

        <span class="px-2 text-sm text-ink-soft">
          Page <strong class="text-ink">{{ page() }}</strong> of {{ totalPages() }}
        </span>

        <button
          type="button"
          class="ox-btn ox-btn--outline ox-btn--sm"
          [disabled]="page() >= totalPages()"
          (click)="go(page() + 1)"
        >
          Next
          <app-icon name="chevron-right" [size]="14" />
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input<number>(0);

  readonly pageChange = output<number>();

  readonly label = computed(() => `Page ${this.page()} of ${this.totalPages()}`);

  go(next: number): void {
    if (next >= 1 && next <= this.totalPages() && next !== this.page()) {
      this.pageChange.emit(next);
    }
  }
}
