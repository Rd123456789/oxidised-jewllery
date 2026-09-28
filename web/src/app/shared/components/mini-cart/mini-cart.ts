import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { ContentService } from '../../../core/services/content.service';
import { focusFirst, trapTabKey } from '../../../core/utils/focus-trap';
import { formatCurrency } from '../../../core/utils/format';
import { Icon } from '../icon/icon';
import { QuantityStepper } from '../quantity-stepper/quantity-stepper';

const MAX_QUANTITY = 10;

@Component({
  selector: 'app-mini-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, QuantityStepper],
  template: `
    <div
      class="fixed inset-0 z-50"
      [class.pointer-events-none]="!open()"
      [attr.aria-hidden]="!open()"
      [attr.inert]="open() ? null : ''"
    >
      <div
        class="absolute inset-0 bg-ink/45 backdrop-blur-sm transition-opacity duration-300 ease-out"
        [style.opacity]="open() ? '1' : '0'"
        [style.pointer-events]="open() ? 'auto' : 'none'"
        (click)="closed.emit()"
      ></div>

      <aside
        #panel
        class="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-ivory shadow-2xl transition-transform duration-300 ease-out"
        [style.transform]="open() ? 'translateX(0)' : 'translateX(100%)'"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
        (keydown)="onKeydown($event)"
      >
        <header class="flex h-16 shrink-0 items-center justify-between border-b border-sand-deep/70 px-4">
          <h2 class="ox-display text-lg text-ink">
            Your bag
            @if (cart.itemCount() > 0) {
              <span class="text-sm font-normal text-ink-muted">({{ cart.itemCount() }})</span>
            }
          </h2>
          <button
            type="button"
            class="rounded-full p-2 text-ink-soft active:bg-sand"
            aria-label="Close bag"
            (click)="closed.emit()"
          >
            <app-icon name="close" [size]="20" />
          </button>
        </header>

        @if (cart.itemCount() > 0) {
          <div class="shrink-0 border-b border-sand-deep/70 bg-paper px-4 py-3">
            @if (remaining() > 0) {
              <p class="text-xs text-ink-soft">
                Add <strong class="text-ink">{{ money(remaining()) }}</strong> more for free shipping
              </p>
            } @else {
              <p class="flex items-center gap-1.5 text-xs font-semibold text-olive">
                <app-icon name="check" [size]="14" /> You have unlocked free shipping
              </p>
            }
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
              <div class="h-full rounded-full bg-brass transition-all duration-300" [style.width.%]="progress()"></div>
            </div>
          </div>
        }

        <div class="flex-1 overflow-y-auto px-4 py-4">
          @if (cart.itemCount() === 0) {
            <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-full bg-sand text-brass">
                <app-icon name="bag" [size]="24" />
              </span>
              <p class="text-sm text-ink-soft">Your bag is empty.</p>
              <a routerLink="/shop" class="ox-btn ox-btn--primary ox-btn--sm" (click)="closed.emit()">
                Start shopping
              </a>
            </div>
          } @else {
            <ul class="space-y-3">
              @for (item of cart.items(); track item.id) {
                <li class="flex gap-3">
                  @if (item.image) {
                    <img
                      [src]="item.image"
                      [alt]="item.name"
                      class="h-20 w-16 shrink-0 rounded-lg object-cover"
                    />
                  } @else {
                    <span class="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-sand text-sand-deep">
                      <app-icon name="sparkles" [size]="18" />
                    </span>
                  }

                  <div class="flex min-w-0 flex-1 flex-col gap-1">
                    <a
                      [routerLink]="['/product', item.slug]"
                      class="truncate text-sm font-medium text-ink hover:text-brass"
                      (click)="closed.emit()"
                    >
                      {{ item.name }}
                    </a>
                    @if (item.variantSku) {
                      <p class="text-xs text-ink-muted">{{ item.variantSku }}</p>
                    }
                    <div class="flex items-center justify-between gap-2">
                      <app-quantity-stepper
                        [value]="item.quantity"
                        [min]="1"
                        [max]="MAX_QUANTITY"
                        (valueChange)="changeQuantity(item.id, $event)"
                      />
                      <span class="text-sm font-semibold text-ink">{{ money(item.lineTotal) }}</span>
                    </div>
                    <button
                      type="button"
                      class="mt-0.5 inline-flex w-fit items-center gap-1 text-xs text-ink-muted hover:text-rose"
                      (click)="cart.remove(item.id)"
                    >
                      <app-icon name="trash" [size]="12" /> Remove
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>

        @if (cart.itemCount() > 0) {
          <footer class="shrink-0 border-t border-sand-deep/70 bg-paper px-4 py-4">
            <dl class="space-y-1 text-sm">
              <div class="flex items-center justify-between">
                <dt class="text-ink-soft">Subtotal</dt>
                <dd class="font-semibold text-ink">{{ money(cart.pricing()?.subtotal ?? 0) }}</dd>
              </div>
              <p class="text-xs text-ink-muted">Shipping and taxes are calculated at checkout.</p>
            </dl>

            <div class="mt-3 grid gap-2">
              <a routerLink="/checkout" class="ox-btn ox-btn--primary ox-btn--block" (click)="closed.emit()">
                Checkout
                <app-icon name="arrow-right" [size]="15" />
              </a>
              <a routerLink="/cart" class="ox-btn ox-btn--outline ox-btn--block" (click)="closed.emit()">
                View bag
              </a>
            </div>
          </footer>
        }
      </aside>
    </div>
  `,
})
export class MiniCart {
  readonly cart = inject(CartService);
  private readonly content = inject(ContentService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  private previouslyFocused: HTMLElement | null = null;

  readonly open = input(false);
  readonly closed = output<void>();

  readonly MAX_QUANTITY = MAX_QUANTITY;

  private readonly threshold = computed(() => this.content.settings()?.freeShippingThreshold ?? 999);
  private readonly subtotal = computed(() => this.cart.pricing()?.subtotal ?? 0);

  readonly remaining = computed(() => Math.max(0, this.threshold() - this.subtotal()));

  readonly progress = computed(() => {
    const threshold = this.threshold();

    if (threshold <= 0) {
      return 100;
    }

    return Math.min(100, Math.round((this.subtotal() / threshold) * 100));
  });

  constructor() {
    effect(() => {
      const open = this.open();

      if (typeof document === 'undefined') {
        return;
      }

      if (open) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;

        queueMicrotask(() => {
          const panel = this.panel()?.nativeElement;

          if (panel) {
            focusFirst(panel);
          }
        });

        return;
      }

      if (this.previouslyFocused) {
        this.previouslyFocused.focus?.();
        this.previouslyFocused = null;
      }
    });
  }

  money(amount: number): string {
    return formatCurrency(amount, this.content.settings()?.currency ?? 'INR');
  }

  async changeQuantity(itemId: string, quantity: number): Promise<void> {
    await this.cart.updateQuantity(itemId, quantity);
  }

  onKeydown(event: KeyboardEvent): void {
    const panel = this.panel()?.nativeElement;

    if (!panel) {
      return;
    }

    if (event.key === 'Escape') {
      this.closed.emit();

      return;
    }

    trapTabKey(event, panel);
  }
}
