import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-rating-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <span class="inline-flex items-center gap-1.5" [attr.aria-label]="label()">
      <span class="flex items-center gap-0.5 text-brass-soft">
        @for (star of stars(); track $index) {
          <span [class]="star <= fullStars() ? 'text-brass' : 'text-sand-deep'">
            <app-icon name="star" [size]="size()" [strokeWidth]="star <= fullStars() ? 2 : 1.4" />
          </span>
        }
      </span>
      @if (showCount() && count() > 0) {
        <span class="text-xs text-ink-muted">({{ count() }})</span>
      }
    </span>
  `,
})
export class RatingStars {
  readonly rating = input.required<number>();
  readonly count = input<number>(0);
  readonly size = input<number>(14);
  readonly showCount = input(true);

  readonly stars = computed(() => [1, 2, 3, 4, 5]);

  readonly fullStars = computed(() => Math.round(this.rating()));

  readonly label = computed(() => `Rated ${this.rating().toFixed(1)} out of 5`);
}
