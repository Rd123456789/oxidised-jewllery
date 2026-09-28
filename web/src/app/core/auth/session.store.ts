import { CART_SESSION_HEADER, STORAGE_KEYS } from '../api/api.config';
import type { AuthUser } from '../api/api.models';

/**
 * Deliberately dependency-injection free: the HTTP interceptor reads and writes
 * this module so it never has to inject a service that itself uses HttpClient
 * (which would create a DI cycle).
 */

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function registerRefreshHandler(handler: () => Promise<string | null>): void {
  refreshHandler = handler;
}

export function registerSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export async function runTokenRefresh(): Promise<string | null> {
  if (!refreshHandler) {
    return null;
  }

  try {
    return await refreshHandler();
  } catch {
    return null;
  }
}

export function notifySessionExpired(): void {
  accessToken = null;
  sessionExpiredHandler?.();
}

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { user?: AuthUser };

    return parsed.user ?? null;
  } catch {
    return null;
  }
}

export function persistUser(user: AuthUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEYS.auth);

      return;
    }

    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify({ user }));
  } catch {
    /* storage can be unavailable in private mode — the session still works in memory */
  }
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `sess-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function ensureCartSessionId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.cartSession);

    if (existing) {
      return existing;
    }

    const created = createSessionId();
    localStorage.setItem(STORAGE_KEYS.cartSession, created);

    return created;
  } catch {
    return createSessionId();
  }
}

export function readCartSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.cartSession);
  } catch {
    return null;
  }
}

export function clearCartSessionId(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.cartSession);
  } catch {
    /* ignore */
  }
}

export const CART_SESSION_HEADER_NAME = CART_SESSION_HEADER;

export interface RecentlyViewedEntry {
  slug: string;
  name: string;
  image?: string;
  price: number;
  viewedAt: number;
}

/** Key used by the original product-page-only strip; migrated on first read. */
const LEGACY_RECENTLY_VIEWED_KEY = 'ox-recently-viewed';

function normalizeRecentlyViewed(value: unknown, index: number): RecentlyViewedEntry | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate['slug'] !== 'string' || typeof candidate['name'] !== 'string') {
    return null;
  }

  return {
    slug: candidate['slug'],
    name: candidate['name'],
    image: typeof candidate['image'] === 'string' ? candidate['image'] : undefined,
    price: typeof candidate['price'] === 'number' ? candidate['price'] : 0,
    viewedAt: typeof candidate['viewedAt'] === 'number' ? candidate['viewedAt'] : Date.now() - index,
  };
}

export function readRecentlyViewed(): RecentlyViewedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentlyViewed);

    if (raw) {
      const parsed: unknown = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed
          .map((entry, index) => normalizeRecentlyViewed(entry, index))
          .filter((entry): entry is RecentlyViewedEntry => entry !== null);
      }
    }

    const legacy = localStorage.getItem(LEGACY_RECENTLY_VIEWED_KEY);

    if (!legacy) {
      return [];
    }

    const parsedLegacy: unknown = JSON.parse(legacy);
    const migrated = Array.isArray(parsedLegacy)
      ? parsedLegacy
          .map((entry, index) => normalizeRecentlyViewed(entry, index))
          .filter((entry): entry is RecentlyViewedEntry => entry !== null)
          .slice(0, 8)
      : [];

    if (migrated.length > 0) {
      localStorage.setItem(STORAGE_KEYS.recentlyViewed, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_RECENTLY_VIEWED_KEY);
    }

    return migrated;
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(entry: Omit<RecentlyViewedEntry, 'viewedAt'>): RecentlyViewedEntry[] {
  const existing = readRecentlyViewed().filter((item) => item.slug !== entry.slug);
  const next = [{ ...entry, viewedAt: Date.now() }, ...existing].slice(0, 8);

  try {
    localStorage.setItem(STORAGE_KEYS.recentlyViewed, JSON.stringify(next));
  } catch {
    /* ignore */
  }

  return next;
}

export function clearRecentlyViewed(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.recentlyViewed);
  } catch {
    /* ignore */
  }
}

const MAX_RECENT_SEARCHES = 5;

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentSearches);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function pushRecentSearch(term: string): string[] {
  const trimmed = term.trim();

  if (!trimmed) {
    return readRecentSearches();
  }

  const next = [
    trimmed,
    ...readRecentSearches().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);

  try {
    localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(next));
  } catch {
    /* ignore */
  }

  return next;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.recentSearches);
  } catch {
    /* ignore */
  }
}
