import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '../../../core/api/api.models';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { Icon } from '../icon/icon';
import { PriceTag } from '../price/price';
import { RatingStars } from '../rating-stars/rating-stars';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PriceTag, RatingStars],
  template: `
    <article class="ox-card flex h-full flex-col overflow-hidden">
      <div class="relative bg-sand/40">
        <a
          [routerLink]="['/product', product().slug]"
          class="block overflow-hidden"
          [attr.aria-label]="product().name"
        >
          @if (product().image; as image) {
            <img
              [src]="image"
              [alt]="product().name"
              loading="lazy"
              decoding="async"
              class="aspect-[4/5] w-full object-cover"
            />
          } @else {
            <div class="flex aspect-[4/5] w-full items-center justify-center text-sand-deep">
              <app-icon name="sparkles" [size]="34" />
            </div>
          }
        </a>

        <div class="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
          @if (product().discountPercent > 0) {
            <span class="ox-badge ox-badge--cut">{{ product().discountPercent }}% off</span>
          }
          @if (!product().inStock) {
            <span class="ox-badge ox-badge--sold">Sold out</span>
          } @else if (product().badges.length > 0) {
            <span class="ox-badge ox-badge--tag">{{ product().badges[0] }}</span>
          }
        </div>

        <button
          type="button"
          [class]="wishlistButtonClass()"
          [attr.aria-label]="inWishlist() ? 'Remove from wishlist' : 'Add to wishlist'"
          [attr.aria-pressed]="inWishlist()"
          (click)="toggleWishlist()"
        >
          <app-icon name="heart" [size]="15" />
        </button>
      </div>

      <div class="flex flex-1 flex-col gap-2 p-4">
        @if (product().category; as category) {
          <p class="text-[0.6875rem] uppercase tracking-[0.16em] text-ink-muted">
            {{ category.name }}
          </p>
        }

        <h3 class="font-display text-base leading-snug text-ink">
          <a [routerLink]="['/product', product().slug]" class="active:text-brass">
            {{ product().name }}
          </a>
        </h3>

        <!-- Fixed-height row so cards keep an identical rhythm whether or not a piece is rated. -->
        <div class="flex min-h-5 items-center">
          @if (product().ratingCount > 0) {
            <app-rating-stars [rating]="product().rating" [count]="product().ratingCount" />
          }
        </div>

        <div class="mt-auto space-y-3 pt-1">
          <app-price
            [amount]="product().price"
            [mrp]="product().mrp"
            [currency]="product().currency"
            [showSave]="true"
          />

          <button
            type="button"
            class="ox-btn ox-btn--primary ox-btn--sm ox-btn--block"
            [disabled]="!product().inStock || adding()"
            (click)="addToBag()"
          >
            @if (adding()) {
              <span class="ox-spinner"></span>
              Adding…
            } @else {
              <app-icon name="bag" [size]="15" />
              {{ product().inStock ? 'Add to bag' : 'Sold out' }}
            }
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  private readonly cart = inject(CartService);
  private readonly wishlist = inject(WishlistService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly product = input.required<ProductSummary>();

  readonly adding = signal(false);
  readonly inWishlist = computed(() => this.wishlist.has(this.product().id));

  readonly wishlistButtonClass = computed(() =>
    this.inWishlist()
      ? 'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose text-ivory shadow-sm backdrop-blur transition duration-150 active:scale-95'
      : 'absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-paper/90 text-ink-soft shadow-sm backdrop-blur transition duration-150 active:scale-95',
  );

  async addToBag(): Promise<void> {
    if (!this.product().inStock) {
      return;
    }

    this.adding.set(true);

    try {
      await this.cart.add(this.product().id, 1);
    } finally {
      this.adding.set(false);
      this.cdr.markForCheck();
    }
  }

  async toggleWishlist(): Promise<void> {
    try {
      const result = await this.wishlist.toggle(this.product());
      this.toast.success(result.inWishlist ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }
}
