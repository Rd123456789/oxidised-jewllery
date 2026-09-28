import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-5" [class]="gridClass()">
      @for (item of placeholders(); track $index) {
        <div class="ox-card overflow-hidden">
          <div class="ox-skeleton aspect-[4/5] w-full rounded-none"></div>
          <div class="space-y-2 p-4">
            <div class="ox-skeleton h-3 w-2/3"></div>
            <div class="ox-skeleton h-3 w-1/3"></div>
            <div class="ox-skeleton h-8 w-full"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SkeletonGrid {
  readonly count = input(8);
  readonly columns = input<2 | 3 | 4>(4);

  readonly placeholders = computed(() => Array.from({ length: this.count() }, (_, index) => index));

  readonly gridClass = computed(() => {
    switch (this.columns()) {
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2 lg:grid-cols-3';
      default:
        return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
  });
}
