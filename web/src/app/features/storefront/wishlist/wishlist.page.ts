import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { SkeletonGrid } from '../../../shared/components/skeleton-grid/skeleton-grid';

@Component({
  selector: 'wishlist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ProductCard, SkeletonGrid, EmptyState],
  templateUrl: './wishlist.page.html',
})
export class WishlistPage {
  private readonly wishlist = inject(WishlistService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly items = this.wishlist.items;
  readonly loading = signal(true);
  readonly moving = signal(false);

  constructor() {
    void this.load();
  }

  async moveAllToBag(): Promise<void> {
    const items = this.items();

    if (items.length === 0 || this.moving()) {
      return;
    }

    this.moving.set(true);

    try {
      for (const item of items) {
        await this.cart.add(item.id, 1);
      }

      await this.cart.load();
      await this.wishlist.clear();
      this.toast.success('Your wishlist is on its way to the bag');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.moving.set(false);
      this.cdr.markForCheck();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);

    try {
      await this.wishlist.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
