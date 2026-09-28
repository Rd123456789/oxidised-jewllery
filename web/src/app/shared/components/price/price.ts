import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatCurrency } from '../../../core/utils/format';

@Component({
  selector: 'app-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span [class]="priceClass()">{{ formattedPrice() }}</span>
      @if (showMrp() && mrp()) {
        <span class="text-xs text-ink-muted line-through">{{ formattedMrp() }}</span>
      }
      @if (showDiscount() && discountPercent() > 0) {
        <span class="ox-badge ox-badge--cut">{{ discountPercent() }}% off</span>
      }
      @if (showSave() && savings() > 0) {
        <span class="text-xs font-semibold text-rose">Save {{ formattedSavings() }}</span>
      }
    </span>
  `,
})
export class PriceTag {
  readonly amount = input.required<number>();
  readonly mrp = input<number | undefined>(undefined);
  readonly currency = input<string>('INR');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showMrp = input(true);
  readonly showDiscount = input(false);
  readonly showSave = input(false);

  readonly formattedPrice = computed(() => formatCurrency(this.amount(), this.currency()));

  readonly formattedMrp = computed(() => formatCurrency(this.mrp() ?? 0, this.currency()));

  readonly savings = computed(() => {
    const mrp = this.mrp();

    return mrp && mrp > this.amount() ? mrp - this.amount() : 0;
  });

  readonly formattedSavings = computed(() => formatCurrency(this.savings(), this.currency()));

  readonly discountPercent = computed(() => {
    const mrp = this.mrp();

    if (!mrp || mrp <= this.amount()) {
      return 0;
    }

    return Math.round(((mrp - this.amount()) / mrp) * 100);
  });

  readonly priceClass = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'text-sm font-semibold text-ink';
      case 'lg':
        return 'font-display text-2xl font-semibold text-ink';
      default:
        return 'text-base font-semibold text-ink';
    }
  });
}
