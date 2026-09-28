import { Injectable, signal } from '@angular/core';
import {
  clearRecentlyViewed,
  pushRecentlyViewed,
  readRecentlyViewed,
  type RecentlyViewedEntry,
} from '../auth/session.store';

/**
 * Single source of truth for "recently viewed". The list lives in localStorage (so it
 * survives reloads and is shared across the storefront) and is exposed as a signal so
 * every rail on the site updates the moment a product is viewed.
 */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly entries = signal<RecentlyViewedEntry[]>([]);

  readonly list = this.entries.asReadonly();

  constructor() {
    this.entries.set(readRecentlyViewed());
  }

  record(entry: Omit<RecentlyViewedEntry, 'viewedAt'>): void {
    this.entries.set(pushRecentlyViewed(entry));
  }

  clear(): void {
    clearRecentlyViewed();
    this.entries.set([]);
  }
}
