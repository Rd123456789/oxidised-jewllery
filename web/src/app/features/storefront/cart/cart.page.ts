import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductSummary } from '../../../core/api/api.models';
import { CartService } from '../../../core/services/cart.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ContentService } from '../../../core/services/content.service';
import { SeoService } from '../../../core/services/seo.service';
import { formatCurrency } from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { PriceTag } from '../../../shared/components/price/price';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { QuantityStepper } from '../../../shared/components/quantity-stepper/quantity-stepper';

const MAX_QUANTITY = 10;

@Component({
  selector: 'cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PriceTag, QuantityStepper, EmptyState, ProductCard],
  templateUrl: './cart.page.html',
})
export class CartPage {
  private readonly cart = inject(CartService);
  private readonly catalog = inject(CatalogService);
  private readonly content = inject(ContentService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly items = this.cart.items;
  readonly pricing = this.cart.pricing;
  readonly couponCode = this.cart.couponCode;
  readonly isEmpty = this.cart.isEmpty;
  readonly loading = this.cart.loading;
  readonly settings = this.content.settings;

  readonly maxQuantity = MAX_QUANTITY;
  readonly confirmingId = signal<string | null>(null);
  readonly couponInput = signal('');
  readonly applyingCoupon = signal(false);

  readonly recommended = signal<ProductSummary[]>([]);
  readonly recommendedLoading = signal(true);

  readonly currency = computed(
    () => this.pricing()?.currency ?? this.settings()?.currency ?? 'INR',
  );

  readonly freeShippingRemaining = computed(() => {
    const threshold = this.settings()?.freeShippingThreshold ?? 0;
    const summary = this.pricing();

    if (threshold <= 0 || !summary || summary.freeShipping) {
      return 0;
    }

    return Math.max(0, threshold - summary.subtotal);
  });

  constructor() {
    this.seo.set({
      title: 'Your bag',
      description: 'Review the handcrafted pieces in your bag and check out securely.',
      canonicalPath: '/cart',
    });

    void this.init();
  }

  money(value: number): string {
    return formatCurrency(value, this.currency());
  }

  async changeQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1 || quantity > MAX_QUANTITY) {
      return;
    }

    await this.cart.updateQuantity(itemId, quantity);
    this.cdr.markForCheck();
  }

  requestRemove(itemId: string): void {
    this.confirmingId.set(itemId);
  }

  cancelRemove(): void {
    this.confirmingId.set(null);
  }

  async remove(itemId: string): Promise<void> {
    this.confirmingId.set(null);
    await this.cart.remove(itemId);
    this.cdr.markForCheck();
  }

  onCouponInput(event: Event): void {
    this.couponInput.set((event.target as HTMLInputElement).value);
  }

  async applyCoupon(): Promise<void> {
    const code = this.couponInput().trim();

    if (!code) {
      return;
    }

    this.applyingCoupon.set(true);

    try {
      const applied = await this.cart.applyCoupon(code);

      if (applied) {
        this.couponInput.set('');
      }
    } finally {
      this.applyingCoupon.set(false);
      this.cdr.markForCheck();
    }
  }

  async removeCoupon(): Promise<void> {
    await this.cart.removeCoupon();
    this.cdr.markForCheck();
  }

  private async init(): Promise<void> {
    await Promise.all([this.cart.load(), this.content.loadSettings().catch(() => null)]);
    await this.loadRecommended();
    this.cdr.markForCheck();
  }

  private async loadRecommended(): Promise<void> {
    try {
      const result = await this.catalog.listProducts({ featured: true, limit: 4 });
      this.recommended.set(result.items);
    } catch {
      this.recommended.set([]);
    } finally {
      this.recommendedLoading.set(false);
      this.cdr.markForCheck();
    }
  }
}
