import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import type { CartView } from '../api/api.models';
import { readCartSessionId } from '../auth/session.store';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  private readonly cartSignal = signal<CartView | null>(null);
  private readonly loadingSignal = signal(false);

  readonly cart = this.cartSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly items = computed(() => this.cartSignal()?.items ?? []);
  readonly itemCount = computed(() => this.cartSignal()?.itemCount ?? 0);
  readonly pricing = computed(() => this.cartSignal()?.pricing ?? null);
  readonly couponCode = computed(() => this.cartSignal()?.couponCode ?? null);
  readonly isEmpty = computed(() => (this.cartSignal()?.items.length ?? 0) === 0);

  setCart(cart: CartView): void {
    this.cartSignal.set(cart);
  }

  async load(): Promise<void> {
    this.loadingSignal.set(true);

    try {
      const cart = await this.api.get<CartView>('/cart');
      this.cartSignal.set(cart);
    } catch {
      this.cartSignal.set(null);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async add(productId: string, quantity = 1, variantSku?: string): Promise<boolean> {
    this.loadingSignal.set(true);

    try {
      const cart = await this.api.post<CartView>('/cart/items', {
        productId,
        quantity,
        variantSku,
      });

      this.cartSignal.set(cart);
      this.toast.success('Added to your bag');

      return true;
    } catch (error) {
      this.toast.error(error);

      return false;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async updateQuantity(itemId: string, quantity: number): Promise<void> {
    try {
      const cart = await this.api.patch<CartView>(`/cart/items/${itemId}`, { quantity });
      this.cartSignal.set(cart);
    } catch (error) {
      this.toast.error(error);
    }
  }

  async remove(itemId: string): Promise<void> {
    try {
      const cart = await this.api.delete<CartView>(`/cart/items/${itemId}`);
      this.cartSignal.set(cart);
      this.toast.info('Removed from your bag');
    } catch (error) {
      this.toast.error(error);
    }
  }

  async clear(): Promise<void> {
    try {
      const cart = await this.api.delete<CartView>('/cart');
      this.cartSignal.set(cart);
    } catch (error) {
      this.toast.error(error);
    }
  }

  async applyCoupon(code: string): Promise<boolean> {
    try {
      const cart = await this.api.post<CartView>('/cart/coupon', { code });
      this.cartSignal.set(cart);

      if (!cart.couponCode) {
        this.toast.error('That coupon could not be applied');

        return false;
      }

      this.toast.success(`Coupon ${cart.couponCode} applied`);

      return true;
    } catch (error) {
      this.toast.error(error);

      return false;
    }
  }

  async removeCoupon(): Promise<void> {
    try {
      const cart = await this.api.delete<CartView>('/cart/coupon');
      this.cartSignal.set(cart);
    } catch (error) {
      this.toast.error(error);
    }
  }

  /** Called right after sign-in so a guest bag is not lost. */
  async mergeGuestCart(): Promise<void> {
    const sessionId = readCartSessionId();

    if (!sessionId) {
      await this.load();

      return;
    }

    try {
      const cart = await this.api.post<CartView>('/cart/merge', { sessionId });
      this.cartSignal.set(cart);
    } catch {
      await this.load();
    }
  }

  reset(): void {
    this.cartSignal.set(null);
  }
}
