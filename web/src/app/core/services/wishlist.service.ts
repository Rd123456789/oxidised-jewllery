import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiClient } from '../api/api-client';
import type { ProductSummary } from '../api/api.models';
import { STORAGE_KEYS } from '../api/api.config';
import { SessionService } from './session.service';

const MAX_GUEST_ITEMS = 60;

/**
 * One wishlist for the whole app.
 *
 * Guests get a localStorage list so the heart works before sign-in; `mergeGuestWishlist()`
 * pushes those pieces to the account on the next login, mirroring how the guest bag is merged.
 */
@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly api = inject(ApiClient);
  private readonly session = inject(SessionService);

  private readonly itemsSignal = signal<ProductSummary[]>([]);
  private readonly readySignal = signal(false);

  readonly items = this.itemsSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly count = computed(() => this.itemsSignal().length);

  private readonly idSet = computed(() => new Set(this.itemsSignal().map((item) => item.id)));

  has(productId: string): boolean {
    return this.idSet().has(productId);
  }

  async load(): Promise<void> {
    if (!this.session.isAuthenticated()) {
      this.itemsSignal.set(readGuestWishlist());
      this.readySignal.set(true);

      return;
    }

    try {
      this.itemsSignal.set(await this.api.get<ProductSummary[]>('/wishlist'));
    } catch {
      this.itemsSignal.set([]);
    } finally {
      this.readySignal.set(true);
    }
  }

  async toggle(product: ProductSummary): Promise<{ inWishlist: boolean }> {
    if (!this.session.isAuthenticated()) {
      const inWishlist = !this.has(product.id);
      const next = inWishlist
        ? [product, ...this.itemsSignal().filter((item) => item.id !== product.id)]
        : this.itemsSignal().filter((item) => item.id !== product.id);

      this.itemsSignal.set(next.slice(0, MAX_GUEST_ITEMS));
      writeGuestWishlist(this.itemsSignal());

      return { inWishlist };
    }

    const result = await this.api.post<{ inWishlist: boolean; count: number }>('/wishlist/toggle', {
      productId: product.id,
    });

    if (result.inWishlist) {
      if (!this.has(product.id)) {
        this.itemsSignal.update((items) => [product, ...items]);
      }
    } else {
      this.itemsSignal.update((items) => items.filter((item) => item.id !== product.id));
    }

    return { inWishlist: result.inWishlist };
  }

  /** Empties the wishlist, e.g. after every saved piece has been moved to the bag. */
  async clear(): Promise<void> {
    if (!this.session.isAuthenticated()) {
      this.itemsSignal.set([]);
      writeGuestWishlist([]);

      return;
    }

    await this.api.delete<{ cleared: boolean }>('/wishlist');
    this.itemsSignal.set([]);
  }

  reset(): void {
    this.itemsSignal.set([]);
  }

  /** Called right after sign-in so pieces saved as a guest are not lost. */
  async mergeGuestWishlist(): Promise<void> {
    const guest = readGuestWishlist();

    if (guest.length === 0) {
      await this.load();

      return;
    }

    try {
      const server = await this.api.get<ProductSummary[]>('/wishlist');
      const serverIds = new Set(server.map((item) => item.id));

      for (const product of guest.filter((item) => !serverIds.has(item.id))) {
        try {
          await this.api.post('/wishlist/toggle', { productId: product.id });
        } catch {
          /* keep the rest of the merge going if one piece is gone */
        }
      }

      writeGuestWishlist([]);
    } catch {
      /* fall through to a plain reload */
    }

    await this.load();
  }
}

function readGuestWishlist(): ProductSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.wishlist);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is ProductSummary =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as ProductSummary).id === 'string' &&
        typeof (entry as ProductSummary).slug === 'string',
    );
  } catch {
    return [];
  }
}

function writeGuestWishlist(items: ProductSummary[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.wishlist, JSON.stringify(items));
  } catch {
    /* storage can be unavailable in private mode */
  }
}
