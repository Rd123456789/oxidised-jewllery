# Oxidised Jewellery — Improvement Plan

> Audited 2026-09-26 against `web/` (Angular 21 zoneless standalone + Tailwind 4) and `server/` (Express 5 ESM + Mongoose 9 + Zod). This plan keeps the warm artisan brand intact while bringing UX, performance, and API hygiene to 2026 standards. Every item maps to a file or pattern already in the repo.

---

## 0. Principles

- **Brand first:** `ivory/paper/sand/ink/brass/oxide` palette and `ox-*` system (`web/src/styles.css:8-828`) stay. Prefer tokens over ad-hoc colors.
- **Structure over drift:** admin pages use `ox-page / ox-page-header / ox-page-title` (`styles.css:492-518`); modifiers never without base class; `ox-*` stays in `components` layer so Tailwind utilities win.
- **Layering:** `routes → controllers → services → models`, `validate({body,query,params}) → req.validatedQuery/Params` (`middleware/validate.ts:27`), `sendSuccess/sendPaginated` + `ApiError` (`utils/http.ts`, `middleware/error.ts`). Keep it.
- **Verification before done:** `npm --prefix server run typecheck` clean, `npm --prefix web exec -- ng build` clean (template check), `npm test` green — per `AGENTS.md`.

---

## 1. What Is Already Strong (Do Not Regress)

- Strict standalone + zoneless + `OnPush` everywhere + signals/computed/linkedSignal + `inject()` + `@if/@for` control flow.
- Lazy `loadComponent` for 32 routes, `@defer(on viewport)` on home/admin (`web/src/app/features/storefront/home/home.page.html:132`), `withViewTransitions()` (`app.config.ts:27`) + reduced-motion guard.
- Design system with motion vocabulary (`ox-reveal/stagger/hero-copy/slide-down/pop/ken-burns`, `styles.css:389-437`), toast with progress bar, `ox-skeleton`.
- SEO service with canonical + `og:` + `twitter:` + JSON-LD `Product/Offer/AggregateRating` on product page (`features/storefront/product/product.page.ts:286-322`).
- Guest cart via `x-cart-session` + merge on login (`services/cart.service.ts:297`), `RecentlyViewedService` single `ox.recently-viewed` key, free-shipping tracker, order tracking, coupon centralisation (`services/coupon.service.ts`), pricing as single source of truth (`services/pricing.service.ts`).
- Auth: rotating refresh in httpOnly `refreshToken` cookie (`controllers/auth.controller.ts:10-26`), SHA-256 hash persisted, `authenticate/optionalAuthenticate/requireAdmin` (`middleware/auth.ts`), Zod at import-time (`config/env.ts`), helmet + CORS whitelist + compression.

---

## 2. Storefront UI/UX — Gaps and Fixes

### 2.1 Search (highest ROI)

**Now:** plain form `submitSearch() → /shop?q=` (`layouts/storefront-layout/storefront-layout.ts:60-69`), no debounce, no autocomplete, no suggestions. Header search hidden on mobile until drawer.
**Target:**
- Debounced typeahead (250 ms) with keyboard-navigable dropdown: product thumbnails, categories, collections, recent searches (localStorage), trending terms.
- Backend `GET /api/v1/search/suggest?q=` — Atlas Search or fallback `$text` with prefix regex, capped 8 results, `Cache-Control: public, max-age=60`.
- Empty state with popular searches + recent. Analytics hook on select.
- Keep `q` AND semantics (`services/catalog.service.ts:32-39` `toTextSearch`) — autocomplete should quote terms the same way.

Files: `layouts/storefront-layout/*`, new `shared/components/search-autocomplete/*`, `services/catalog.service.ts`, `routes/catalog.routes.ts`.

### 2.2 Images & LCP

**Now:** `loading=lazy` on cards (`shared/components/product-card/product-card.ts:37`) but no `NgOptimizedImage`, no `srcset/sizes`, hero is plain `<img>` without `priority` (`features/storefront/home/home.page.html:12`), `web/src/assets/oxidised/*.png` not in `angular.json:22-25` assets. Several sources are WebP bytes with `.png` extension.
**Target:**
- Adopt `NgOptimizedImage` (`ngSrc`, `priority` for hero LCP, `fill` + `sizes` for cards, automatic `srcset`). Add `fetchpriority="high"` to hero.
- Responsive `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"` for grids.
- Cloudinary transforms (`f_auto,q_auto,w_...`) when `cloudinaryEnabled`, local fallback serves pre-cropped derivatives from `server/uploads/catalog/manifest.json` (`seed/catalog.ts`). Fix `angular.json` assets vs `public/` drift — document that `src/assets` is build-excluded intentionally.
- Preload hero image, `aspect-[4/5]` placeholder already good — keep shimmer.

Files: `web/src/app/shared/components/product-card/*`, `features/storefront/home/*`, `features/storefront/product/*`, `web/angular.json`, `server/seed/catalog.ts`.

### 2.3 Product Page

**Now:** detail, related, reviews read-only, variant by SKU, quantity, ATC, JSON-LD. No zoom, no share, no delivery estimate, no write-review, no Q&A.
**Target:**
- Gallery: click-to-zoom/lightbox, swipe on mobile, thumbnails, video if present.
- Variant swatches (color chips) + stock/price live update (already `computed` `resolvedPrice/Mrp/Stock` at `product.page.ts:117-132` — wire to swatch UI).
- Trust row: COD fee disclosure (`pricing.service.ts:68-72`), free-shipping threshold, 7-day return, secure payment icons.
- Delivery estimator by pincode (calls `POST /orders/quote` preview already in checkout `checkout.page.ts:77` — reuse).
- Social share (Web Share API + fallback copy link).
- Write a review (auth-gated, image upload, `helpful` votes) — admin moderation already exists (`features/admin/reviews`).
- Breadcrumbs `Home / Shop / Category / Product` + structured `BreadcrumbList` JSON-LD.
- Recently viewed rail already shared — keep single service, do not re-implement per page.

Files: `features/storefront/product/*`, `shared/components/rating-stars/*`, `core/services/*`, `server/validators/*`, `server/services/order.service.ts`.

### 2.4 Shop / Filters / Listing

**Now:** rich facets (`colors/materials/stones/occasions/tags + price + inStock/onSale + 6 sorts + pagination 12`, `shop.page.ts:1-356`), URL-synced, facet counts via `getProductFacets` (6× `distinct` + price aggregation, `catalog.service.ts:289-309`). No mobile drawer, no skeleton count matching, no empty-state CTA.
**Target:**
- Sticky filter sidebar (desktop) + bottom-sheet drawer (mobile) with `activeFilterCount` badge (`shop.page.ts:90-121`) and `Clear all`.
- Facet chips with counts, collapsible sections, price histogram.
- Sort as segmented control, URL stays canonical (already `buildQuery/parseFilters` `shop.page.ts:304-341`).
- Pagination component already accessible (`shared/pagination/pagination.ts:10` `aria-label`) — add `aria-current="page"` and `rel=prev/next`.
- Empty state with “Clear filters” + featured fallback (pattern already in cart `recommended` `cart.page.ts:127-136`).

Files: `features/storefront/shop/*`, `shared/components/pagination/*`, `shared/components/skeleton-grid/*`.

### 2.5 Cart & Checkout

**Now:** quantity stepper `MAX_QUANTITY 10` (`cart.page.ts:15`), coupon input, free-shipping remaining (`cart.page.ts:48-57`), guest email, COD toggle, `validate()` phone/pincode (`checkout.page.ts:241-280`). No mini-cart, no save-for-later.
**Target:**
- Mini-cart drawer (slide-over) opened from header bag icon — reuses `CartService` signals, shows `freeShippingRemaining` progress.
- Save for later / move to wishlist from cart line.
- Sticky order summary on checkout, explicit COD surcharge line (already in `computePricing` `pricing.service.ts:63-72`).
- Address autocomplete (pincode → city/state fill) + address book reuse (`auth.service` addresses `routes/auth.routes.ts:41-68`).
- Payment: keep COD, wire Razorpay/Stripe behind `paymentMethod` enum (`validators/order.validator.ts:33`) with real signature verification in `order.service.ts:351-369` (`markPaymentSucceeded` stub note `:361-362`). Add `Idempotency-Key` header on `POST /orders`.
- Post-order: confetti + “What’s next” + tracking CTA.

Files: `features/storefront/cart/*`, `features/storefront/checkout/*`, `shared/components/quantity-stepper/*`, `layouts/storefront-layout/*`, `server/services/order.service.ts`, `server/services/pricing.service.ts`.

### 2.6 Wishlist, Compare, Recently Viewed

**Now:** wishlist auth-only with `moveAllToBag` loop (`wishlist.page.ts:30-53`), heart `linkedSignal` on card (`product-card.ts:130-136`). No guest wishlist, no compare, recently viewed is correct single-key.
**Target:**
- Guest wishlist (localStorage) merged on login like cart (`cart.service.ts:297` pattern).
- Compare (up to 4) — new `CompareService` (signals, localStorage), `/compare` page with spec table (price, materials, stones, rating, stock).
- Keep `RecentlyViewedService` (`ox.recently-viewed`) and `session.store.ts` migration — never duplicate.

### 2.7 Navigation & Wayfinding

**Now:** sticky header with blur + view-transition name, categories dropdown `ox-slide-down`, mobile drawer with `inert` + body `overflow-hidden` effect (`storefront-layout.ts:51-57`). Footer 4-col with newsletter.
**Target:**
- Breadcrumb component + schema.
- Skip-to-content link, focus trap for drawer (currently only `Escape` via `host: (document:keydown.escape)`), `aria-current` on active nav, `aria-describedby` for field errors (checkout `fieldError()` `checkout.page.ts:109`).
- Mega-menu for categories on desktop (optional) — already have 7 categories, 18 products.

### 2.8 Accessibility (a11y) — Quick Wins

- Add `<a href="#main" class="sr-only focus:not-sr-only">` skip link; ensure `lang="en"` and `dir` in `index.html:2`.
- Drawer focus trap (e.g. `cdkTrapFocus` or small utility), restore focus on close, `aria-modal`.
- Associate errors: `aria-describedby="field-error-{{name}}"` + `role="alert"`.
- Color contrast audit on `brass`/`ink`/`rose` tokens — `rose #b03a33` on `paper #fff` passes, verify `brass-soft` on `ink`.
- Keep `prefers-reduced-motion` disabling all motion (`styles.css:808-828`).

### 2.9 PWA & Offline

**Now:** no `manifest.webmanifest`, no `ngsw-config.json`, no `@angular/service-worker`.
**Target:**
- Add `manifest.webmanifest` (name, icons from `public/`) + `provideServiceWorker` with `ngsw-config.json` caching `GET /api/v1/products*`, `facets`, `settings/public` as `performance` and `freshness` strategies.
- Offline fallback for shell + “You’re offline” toast.

---

## 3. Admin UI — Polish

- Tables: sortable headers, bulk actions (publish/unpublish, delete), column visibility, `EmptyState` already used — unify.
- Product form: `ImageUploader` currently defers deletes until save (intentional orphan note in `AGENTS.md`) — add save-time diff/cleanup job + preview `srcset`.
- Dashboard: charts for revenue/orders (Chart.js or `chart` tool pattern), date range, export parity (`GET /admin/orders/export` already exists).
- Settings: live preview of `freeShippingThreshold/shippingFlatRate/taxPercent/codFee` (from `services/settings.service.ts`).

---

## 4. Frontend Engineering

| Area | Action | Effort |
|---|---|---|
| **NgOptimizedImage** | Replace `<img>` with `NgOptimizedImage` in `product-card`, `home` hero, `product` gallery; add `priority` to LCP | S |
| **Search autocomplete** | New component + `catalog.service.suggest()` + `api-client` method with abort handling | M |
| **Compare** | `core/services/compare.service.ts` + `/compare` page | S |
| **Guest wishlist** | Mirror `CartService.mergeGuestCart` for wishlist | S |
| **Breadcrumbs** | `shared/components/breadcrumbs/*` + route data | S |
| **Mini-cart** | `shared/components/mini-cart/*` drawer | M |
| **PWA** | `ng add @angular/pwa` wired to `angular.json` budgets + `ngsw-config.json` | M |
| **a11y** | Skip link, focus trap, `aria-current/describedby`, audit | S |
| **Error UX** | Keep `ToastService.error(error)` + `ApiError.fieldErrors` — add inline banner for 500s | S |
| **Signals** | Already good — keep `linkedSignal` for optimistic wishlist, `computed` for pricing | — |
| **Testing** | Add Vitest + Testing Library for `CartService`, `Shop` filters, `Checkout` validation | M |
| **Bundles** | Analyze with `ng build --stats-json` + `esbuild-visualizer`, lazy heavy admin routes already | S |

---

## 5. Backend / API — Modern Standards

### 5.1 Documentation & Contracts

- Generate OpenAPI 3.1 from Zod with `zod-to-openapi` + `swagger-ui-express` (or Scalar) at `GET /api/v1/docs`. Keep Zod as source of truth (`validators/*.ts`). Version header `Accept: application/vnd.oxidised.v1+json`.

### 5.2 Validation Strictness

- Add `.strict()` to body schemas (`validators/*.ts`) so typos on `PATCH /admin/products/:id/flags` fail instead of silently stripping.
- Unknown query keys already stripped — document it; add `meta.warnings` in dev for stripped keys.

### 5.3 Search

- Add `GET /api/v1/search/suggest` and consider Atlas Search index (`autocomplete` + `compound`) for typo tolerance; keep `toTextSearch` AND-quoting as fallback. Add `GET /api/v1/products/facets` caching (see 5.5).

### 5.4 Payments & Orders

- Wire Razorpay `validateWebhookSignature` / Stripe `constructEvent` in `services/order.service.ts:351-369`; store `providerOrderId/paymentId/signature`, add `POST /api/v1/orders/webhook` with idempotency.
- Add `Idempotency-Key` (Redis 24 h) on `POST /orders`, `POST /cart/items`, `POST /orders/verify-payment`.
- Reservation TTL: add `reservationExpiresAt` to `Order` (indexed TTL) + cron that `releaseStock` for `status pending` past 20 min; prevents `reserveStock` holding stock forever (`order.service.ts:134-186`).
- Refund endpoints: `POST /admin/orders/:orderNumber/refund`.

### 5.5 Caching & Performance

- Redis for `GET /products`, `facets`, `collections`, `settings/public`, `banners` (`Cache-Control` + `ETag`/`If-None-Match`). Server-side `compression` already on (`app.ts:47`).
- Cursor pagination for `soldCount` feeds; keep offset `skip/limit` (`utils/query.ts:21-41`, `MAX_LIMIT 100`) for shop but document deep-page cost.
- Add `GET /health` already (`routes/index.ts:12-22`) — extend with `checks: {db, redis, cloudinary}`.

### 5.6 Rate Limiting & Security

- Swap in-memory `express-rate-limit` (`middleware/rateLimit.ts:10-41`) for `rate-limit-redis` for multi-instance. Add limiter to `POST /refresh` and `POST /orders`.
- Consider `hpp` for query pollution, keep intentional `!sanitizeFilter` (`config/db.ts:36-40`) — Zod + `escapeRegex` (`utils/query.ts:76`) already covers NoSQL injection.
- CSP: tighten `helmet` in prod (`app.ts:39-44`) — start with `defaultSrc 'self'`, `imgSrc 'self' data: https://res.cloudinary.com`, `scriptSrc 'self'`.
- Cookies: add `sameSite None + secure` option when `CORS_ORIGINS` is cross-site; document `COOKIE_DOMAIN`.
- Auth hardening: per-email `forgotPassword` throttle, device-aware refresh (`refreshTokens[]` with `jti`) instead of single `refreshTokenHash` (`models/user.model.ts:93`), optional 2FA for admin.

### 5.7 Observability

- Request ID middleware (`x-request-id` echo), structured `pino` logger (replace `utils/logger.ts` + `morgan` `app.ts:52-60` with `pino-http`), `prom-client` `/metrics`, Sentry for errors. Keep `databaseStatus()` (`config/db.ts`).

### 5.8 Data & Files

- Cron for orphan `server/uploads` GC and `cart: converted` purge; keep `persistLocally` sanitization (`middleware/upload.ts:33`) and `destroyImage invalidate:true` note on CDN eventual consistency.
- Transactions: where replica set is available, wrap `Order.create + Coupon increment + Cart converted + finalizeStock` in `withTransaction`; fallback to current atomic `findOneAndUpdate` + compensating `releaseStock` on standalone (already deliberate, `services/order.service.ts:181`).

### 5.9 Testing & CI

- Add `mongodb-memory-server` integration tests for `placeOrder` concurrency, `validateCoupon` windows, `reserveStock` race, `computePricing` edge cases. Existing `__tests__/api-shell.test.ts:1-52` is smoke only.
- GitHub Actions: `typecheck:server`, `ng build`, `vitest run`, `seed --dry-run` + Atlas ephemeral.

---

## 6. Security Checklist (Delta)

- [ ] Rate-limit `POST /auth/refresh` per IP + per user
- [ ] `Idempotency-Key` on order/cart/payment
- [ ] Reservation TTL + cron
- [ ] Real payment signature verification + webhook HMAC
- [ ] `.strict()` on mutating validators
- [ ] CSP + HSTS + `trust proxy 1` already
- [ ] Audit log for admin mutations (`dashboard`, `catalog.admin`, `order.admin`)

---

## 7. Performance & SEO Targets

| Metric | Now | Target | How |
|---|---|---|---|
| LCP (home) | unmeasured, plain hero | < 2.0 s | `NgOptimizedImage priority` + preload + Cloudinary `f_auto` |
| CLS | stable (aspect ratios) | < 0.1 | Keep `aspect-[4/5]`, skeleton placeholders |
| INP | zoneless helps | < 200 ms | `OnPush` already, defer heavy sections |
| TTFB (listing) | DB every hit | p95 < 250 ms | Redis cache + lean + `select` trimming |
| SEO | good (title/canonical/JSON-LD) | + breadcrumbs + `BreadcrumbList` + sitemap.xml + robots.txt | `seo.service.ts:1-81` extension |
| a11y | 85-90 | 95+ Lighthouse | Skip link, focus trap, aria, contrast |

Add `public/sitemap.xml` (generated from `products/categories/collections/pages`), `public/robots.txt`, `src/app/seo` `TitleStrategy`.

---

## 8. DevOps & DX

- Add `Dockerfile` (multi-stage: `node:24-alpine` build server + web) + `docker-compose` (API + Mongo + Redis).
- Keep `proxy.conf.json` (`/api` + `/uploads` → 5000, `cookiePathRewrite`).
- Keep `legacy-peer-deps=true` in both `.npmrc` (Vitest 4 peers).
- Add `.nvmrc` / `engines` alignment (`>=24.0.0` already in root + server).
- Document `MONGODB_URI` + `CLOUDINARY_*` in `server/.env.example:53` and `README.md:336` together.

---

## 9. Roadmap

### Phase 1 — Quick Wins (1–2 days, no breaking changes)
- `NgOptimizedImage` + hero `priority` + card `sizes`
- Breadcrumbs + `aria-current/describedby` + skip link + drawer focus trap
- `.strict()` on admin/body validators + `Idempotency-Key` on `POST /orders`
- `GET /search/suggest` stub + frontend debounce (fallback to `$text`)
- Mini-cart drawer + guest wishlist merge
- `sitemap.xml` + `robots.txt` + `BreadcrumbList` JSON-LD

Accept: `ng build` + `server typecheck` + `npm test` green; Lighthouse LCP −30% on home; a11y axe 0 violations on header/shop/product/cart/checkout.

### Phase 2 — Conversion & Trust (3–5 days)
- Product gallery zoom/lightbox + swatches + share + delivery estimator
- Write review + helpful votes + Q&A
- Compare page, save-for-later
- Checkout pincode autofill, sticky summary, COD fee line
- Redis cache for listings/facets/collections/settings + `ETag`
- Reservation TTL + cron + real payment verify + webhook

Accept: conversion funnel E2E (add → cart → quote → place → webhook → confirmed) covered by `mongodb-memory-server` integration test; p95 listing < 250 ms cached.

### Phase 3 — Hardening & Observability (2–3 days)
- OpenAPI + `/docs`, `pino` + `x-request-id` + `/metrics` + Sentry
- `rate-limit-redis`, per-email `forgotPassword` throttle, device refresh tokens
- Transactions where replica set, compensating path otherwise
- Orphan file GC cron, audit log
- GitHub Actions CI + `Dockerfile`

Accept: `GET /api/v1/docs` serves spec; rate limits shared across instances; 500s alert via Sentry.

### Phase 4 — Delight & Scale (optional)
- PWA + offline shell, Atlas Search autocomplete with typo tolerance
- Admin charts + bulk actions, WYSIWYG for `pages`
- `i18n` (en + hi) via `$localize`, currency display `Intl.NumberFormat('en-IN')` already implicit in `PriceTag`
- Cursor pagination for feeds, image CDN `srcset` automation

---

## 10. File Map for First PR (Phase 1)

```
web/src/app/shared/components/breadcrumbs/*
web/src/app/shared/components/mini-cart/*
web/src/app/shared/components/search-autocomplete/*
web/src/app/layouts/storefront-layout/*   (search, drawer, skip link)
web/src/app/features/storefront/shop/*
web/src/app/features/storefront/product/*
web/src/app/core/services/compare.service.ts
web/src/app/core/services/wishlist.service.ts  (guest merge)
web/public/sitemap.xml  web/public/robots.txt  web/public/manifest.webmanifest
web/ngsw-config.json  web/angular.json  web/src/styles.css
server/src/routes/catalog.routes.ts  server/src/services/catalog.service.ts
server/src/middleware/validate.ts  server/src/validators/*
server/src/services/order.service.ts  server/src/utils/http.ts  server/openapi.yaml
```

---

## 11. Risks & Non-Goals

- Do not recolour `gold→silver` per-pixel (rejected in `tools/prepare-catalog-images.ps1` notes — gold/skin share hue 20-39°).
- Do not enable `sanitizeFilter` (breaks `$text/$expr`, `config/db.ts:36-40`).
- Do not add compound multikey index over `colors/materials/occasions` (`CannotIndexParallelArrays`, `models/product.model.ts:158`).
- Keep money as `Number` rupees (`services/pricing.service.ts`) — no premature `Decimal128`.
- `web/src/assets` stays out of `angular.json` assets — only `public/` is bundled; catalog manifest stays in `server/uploads/catalog`.

---

## 12. How to Run the Audit Again

```powershell
npm --prefix server run typecheck
npm --prefix web exec -- ng build
npm test
# optional live DB
npm run db:check
npm run seed
```

Keep `README.md` (operator) and `AGENTS.md` (contributor) in sync with any script/env/architecture change per repo convention.
