/**
 * The storefront talks to the API through a relative prefix so the same build
 * works in development (via `web/proxy.conf.json`) and in production (where the
 * Node server serves the compiled Angular app from the same origin).
 */
export const API_PREFIX = '/api/v1';

/** Header used to keep a guest cart alive before the shopper signs in. */
export const CART_SESSION_HEADER = 'x-cart-session';

/** localStorage keys. */
export const STORAGE_KEYS = {
  auth: 'ox.auth',
  cartSession: 'ox.cart-session',
  recentlyViewed: 'ox.recently-viewed',
  recentSearches: 'ox.recent-searches',
  wishlist: 'ox.wishlist',
} as const;

/** Header used to make retryable mutations safe to submit twice. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
