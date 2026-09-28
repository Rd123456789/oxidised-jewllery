import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-quantity-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div
      class="inline-flex items-center rounded-full border border-sand-deep bg-paper"
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-l-full text-ink-soft transition hover:bg-sand/60 disabled:opacity-40"
        [disabled]="value() <= min()"
        aria-label="Decrease quantity"
        (click)="step(-1)"
      >
        <app-icon name="minus" [size]="14" />
      </button>
      <input
        class="w-10 border-0 bg-transparent text-center text-sm font-semibold text-ink focus:outline-none"
        type="number"
        [value]="value()"
        [min]="min()"
        [max]="max()"
        aria-label="Quantity value"
        (change)="onInput($event)"
      />
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-r-full text-ink-soft transition hover:bg-sand/60 disabled:opacity-40"
        [disabled]="value() >= max()"
        aria-label="Increase quantity"
        (click)="step(1)"
      >
        <app-icon name="plus" [size]="14" />
      </button>
    </div>
  `,
})
export class QuantityStepper {
  readonly value = input.required<number>();
  readonly min = input(1);
  readonly max = input(10);

  readonly valueChange = output<number>();

  step(delta: number): void {
    const next = Math.min(this.max(), Math.max(this.min(), this.value() + delta));

    if (next !== this.value()) {
      this.valueChange.emit(next);
    }
  }

  onInput(event: Event): void {
    const parsed = Number((event.target as HTMLInputElement).value);

    if (!Number.isFinite(parsed)) {
      return;
    }

    this.valueChange.emit(Math.min(this.max(), Math.max(this.min(), Math.floor(parsed))));
  }
}
