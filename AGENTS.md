# AGENTS.md

Guidance for AI agents and developers working in this repository.

## Commands

All commands are run from `C:\e-commerce` unless stated otherwise.

```powershell
npm run install:all        # install root + server + web dependencies
npm run dev                # API on :5000 and Angular dev server on :4200 together
npm run dev:server         # API only (tsx watch)
npm run dev:web            # Angular only
npm run build              # compile API (server/dist) and web (web/dist/web)
npm run build:server
npm run build:web
npm start                  # run the compiled API
npm run db:check           # verify the MongoDB Atlas connection and list collection counts
npm run catalog:images     # build web-ready photos from web/src/assets/oxidised into server/uploads/catalog
npm run seed               # seed demo data (also reconciles indexes)
npm run seed:destroy       # delete all documents
npm test                   # API tests (Vitest + Supertest)
npm run typecheck:server   # tsc --noEmit for the API
npm run typecheck:web      # tsc --noEmit for the web app (no template checking)
```

Verification checklist before finishing any change:

1. `npm --prefix server run typecheck` — must be clean.
2. `npm --prefix web exec -- ng build` — must be clean (this is what type-checks templates).
3. `npm test` — API suite must stay green.

## Environment

- `server/.env` holds every secret. It is gitignored. `server/.env.example` is the tracked template.
- `MONGODB_URI` (MongoDB Atlas) and `CLOUDINARY_*` are the only values the operator must supply.
  With Cloudinary blank the API falls back to local disk uploads under `server/uploads`.
- Env is validated with Zod at import time in `server/src/config/env.ts`; a missing key exits with a
  list of failures rather than failing later.
- The web app has **no** environment files. It calls `/api/v1/...` relatively and relies on
  `web/proxy.conf.json` in development (wired through `angular.json` → `serve.options.proxyConfig`).

## Architecture rules

### Backend (`server/`)

- ESM only (`"type": "module"`, `module: NodeNext`). **Relative imports must end in `.js`.**
- Layering: `routes → controllers → services → models`. Controllers never touch Mongoose queries
  directly when a service exists; services never touch `req`/`res`.
- Express 5 specifics: `req.query` is a read-only getter. Validated query values are exposed on
  `req.validatedQuery` by `middleware/validate.ts` (params on `req.validatedParams`).
- Mongoose 9 specifics:
  - The filter type is `QueryFilter<T>`, **not** `FilterQuery`.
  - Callback-style middleware (`function (next)`) was removed. Use `pre('validate', function () {})`
    without calling `next`.
  - `doc.addresses.pull()` is unavailable on the typed array; filter and reassign instead.
  - Document types are declared as plain interfaces and passed as `new Schema<TDoc, TModel, TMethods>`;
    shared options live in `models/common.ts`.
- Every response goes through `sendSuccess` / `sendPaginated` (`utils/http.ts`) and every error
  through `ApiError` + `middleware/error.ts`, which maps Zod, Mongoose validation/cast/duplicate-key
  and Multer errors to consistent `{ success: false, error: { code, message, details } }` payloads.
- Zod schemas live in `validators/` and are attached with `validate({ body, query, params })`.
  Mutating **body** schemas are `.strict()`, so a new client field must be added to the schema or it
  is rejected with 422. Query schemas stay permissive (unknown keys are stripped). `settingsUpdateSchema`,
  the page schemas and the address schemas are deliberately exempt: their clients round-trip the
  server response, which carries `id`/`key`/timestamps and, for pages, a comma-separated `keywords`.
- `POST /orders` accepts an `Idempotency-Key` header (`middleware/idempotency.ts`). The first
  response is stored in the TTL `IdempotencyRecord` collection for 24 h and replayed on retry; a
  placeholder row (`statusCode: 0`) blocks concurrent duplicates with 409 and 5xx responses are not
  cached. Redis replaces this in Phase 2.
- `GET /sitemap.xml` is served at the site root (`routes/seo.routes.ts`, mounted outside the API
  prefix) from live categories, collections, products and pages. `web/proxy.conf.json` proxies it in
  development; a production reverse proxy must route `/sitemap.xml` to the API.
- The deploy is **single-origin**: `app.ts` serves `web/dist/web/browser` (hashed assets immutable,
  `index.html` no-cache) plus a shell fallback so client-side deep links resolve. Because `/` belongs
  to the storefront whenever that bundle exists, the API index lives at `API_PREFIX` (`/api/v1`) —
  `WEB_DIST_DIR` overrides the bundle location.
- The production CSP in `app.ts` is deliberate and explicit, not helmet's default: the default's
  `img-src 'self' data:` blocks every Cloudinary delivery URL, which looks exactly like a failed
  upload. `style-src` needs `'unsafe-inline'` because Angular inlines critical CSS. A new image host
  or analytics script means editing that policy.
- CORS trusts the service's own hostname in addition to `CORS_ORIGINS`, because same-origin requests
  still send an `Origin` header and the deployed hostname only exists after the first deploy.
- Seeded imagery is published to Cloudinary by `seed/assets.ts` (registry in
  `seed/published-assets.ts`); `seed/catalog.ts` and `seed/placeholders.ts` prefer the published URL
  and fall back to the local path. Without this, every seeded image 404s on a host with an ephemeral
  disk. Publishing is all-or-nothing, and deterministic public ids keep re-seeding from orphaning assets.
- `npm run install:ci` exists because the deploy sets `NODE_ENV=production`, which would otherwise
  stop `npm install` from fetching devDependencies and break the Angular build.
- Money is stored as a plain `Number` in rupees. Totals are computed in `services/pricing.service.ts`
  (single source of truth for subtotal/discount/shipping/tax/total).
- Coupon rules are centralised in `services/coupon.service.ts`.
- Stock is reserved with conditional atomic updates and rolled back on failure, then `soldCount` and
  variant-derived `stock` are finalised afterwards (`services/order.service.ts`). This is deliberate:
  it works on standalone MongoDB as well as Atlas replica sets.
- Auth: short-lived access JWT in the `Authorization` header, rotating refresh JWT in an httpOnly
  cookie. Only a SHA-256 hash of the refresh token is persisted on the user document.

### Frontend (`web/`)

- Angular 21, zoneless (no `zone.js`), standalone components only, `ChangeDetectionStrategy.OnPush`
  everywhere, `inject()` instead of constructor injection, signals for state.
- Templates use Angular control flow (`@if`, `@for (x of xs(); track x.id)`, `@empty`, `@switch`).
  `*ngIf` / `*ngFor` are not used.
- `withComponentInputBinding()` is enabled, so **route params arrive as signal inputs**, e.g.
  `readonly slug = input.required<string>();`.
- Data access goes through the services in `core/services/`. Components never call `HttpClient`
  directly (the one exception is `SessionService`, which talks to `/auth/*` itself so the
  interceptor does not create a DI cycle).
- `core/auth/session.store.ts` is intentionally DI-free: the HTTP interceptor reads the access token
  and cart session id from it, and `SessionService` registers the refresh/expiry handlers there.
  Do not make the interceptor inject a service that uses `HttpClient`.
- Errors: catch and report with `ToastService.error(error)`; `ApiError` exposes `fieldErrors`,
  `fieldError(field)` and `status` helpers for form-level display.
- "Recently viewed" is one shared rail (`shared/components/recently-viewed`) fed by
  `RecentlyViewedService`, which persists to `ox.recently-viewed` in localStorage and exposes the list
  as a signal. The product page records a view, and the rail is mounted on home, shop and product.
  `session.store.ts` still migrates the old `ox-recently-viewed` key on read. Never re-implement this
  per page — the previous duplicate kept its own key and silently diverged from the shared one.
- `WishlistService` is the only wishlist state. Guests keep a local list in `ox.wishlist` that is
  pushed to the account by `mergeGuestWishlist()` on sign-in/registration; components read
  `wishlist.has(id)` / `wishlist.items()` instead of calling the wishlist endpoints themselves.
- Search is one component (`shared/components/search-autocomplete`, debounced 250 ms → `GET
  /search/suggest`). Do not hand-roll another header search form; recent terms live in
  `ox.recent-searches`.
- Overlays (mobile drawer, `shared/components/mini-cart`) must lock body scroll, trap Tab with
  `core/utils/focus-trap`, set `aria-modal="true"`, and restore focus to the trigger on close.
  `ariaCurrentWhenActive="page"` marks the active nav link; the storefront `<main>` keeps
  `id="main-content"` for the skip link.
- Images use `NgOptimizedImage` from `@angular/common` (`fill` + `sizes`, `priority` on the hero
  and product gallery). The parent must be positioned (`relative`), and `fill` requires `sizes`.
- Styling: Tailwind 4 utilities plus the design-system classes declared in `src/styles.css`
  (`ox-btn`, `ox-card`, `ox-input`, `ox-badge`, `ox-chip`, `ox-skeleton`, `ox-prose`, …) and the
  theme colours from the Tailwind `@theme` block (`ivory paper sand sand-deep ink ink-soft ink-muted
  brass brass-soft brass-deep oxide rose olive`). Prefer these over ad-hoc colours and shadows.
- **Page scaffolding is structural, not a convention.** Every admin page starts with
  `<div class="ox-page">` (vertical rhythm), a `<div class="ox-page-header">` row and an
  `<h1 class="ox-page-title">`. Do not hand-roll `space-y-5` / `space-y-6` or a bespoke heading class
  stack — that drift is exactly what made headings and gaps differ between admin screens.
- Standard storefront page titles also use `ox-page-title`. Only deliberately hero-scale headings
  (home, collections, CMS pages, 404) and the centred auth-form headings keep their own scale.
- **Never apply an `ox-*` modifier without its base class.** `ox-card--flat` alone, `ox-badge--danger`
  without `ox-badge`, etc. silently render as unstyled text, because the modifier only overrides
  properties the base class sets.
- Animation vocabulary (all disabled under `prefers-reduced-motion`): `ox-reveal` for deferred
  content, `ox-stagger` for grids, `ox-hero-copy` for hero copy that replays per slide, `ox-slide-down`
  for dropdowns, `ox-pop` for badge/appearance pops, `ox-ken-burns` for the hero image. Everything
  lives in the `components` layer, so Tailwind utilities still win. Product cards deliberately have
  **no hover-only affordances** (no lift, no image zoom, no hover colour): touch devices cannot
  trigger them, so feedback uses `active:` states instead.
- To audit styling: a class in a template that is absent from the compiled CSS silently does nothing.
  Comparing template class tokens against `dist/web/browser/*.css` catches typos, orphan modifiers and
  dead rules (`audit-css.mjs` in the notes above was a throwaway script — re-create it if needed).
- Use `@defer (on viewport)` with `@placeholder`, `@loading (minimum 200ms)` and `@error` for
  below-the-fold or heavy sections. Components referenced inside a `@defer` block must still be
  listed in the owning component's `imports`.

## Gotchas discovered while building this

- **Never enable `mongoose.set('sanitizeFilter', true)`.** It rewrites every operator object into
  `{ $eq: ... }` (`mongoose/lib/helpers/query/sanitizeFilter.js`) and throws outright on `$text` /
  `$expr` / `$where`. It silently broke product search, price ranges, stock/status filters, banners
  and the dashboard. Injection is prevented upstream instead: Zod whitelists query keys and coerces
  values, and user-supplied strings are passed through `escapeRegex` before becoming RegExp.
- **No compound index may span more than one array path.** `{ colors: 1, materials: 1, occasions: 1 }`
  is rejected by MongoDB with `CannotIndexParallelArrays` (error 171). Each of those fields has its
  own single-field multikey index declared on the schema path instead.
- **The product text index deliberately excludes `sku`.** Seeded SKUs all read `OX-OXIDISED-...`, so
  including `sku` made any search match the whole catalogue.
- **Multi-word search is AND, not OR.** `$text` ORs bare terms, so `q=oxidised jhumka` matched all 18
  products. `toTextSearch()` in `services/catalog.service.ts` quotes each term so the terms AND.
- **`autoIndex` never drops stale indexes.** `seed/run.ts` calls `syncIndexes()` on every registered
  model so schema index changes actually take effect. Run `npm run seed` after editing any index.
- **Seed data is cross-referenced, and a typo used to fail silently.** Product seeds point at category
  slugs; a mismatched slug skipped the product via `continue`, quietly seeding 15 of 18 products. The
  seed now throws on an unknown reference.
- **Mongoose 9 deprecates `new: true`** on `findOneAndUpdate` / `findByIdAndUpdate`. Use
  `returnDocument: 'after'` so no deprecation warnings are emitted.
- **`npm 11.3.0` crashes** with `Cannot read properties of null (reading 'edgesOut')` while resolving
  Vitest 4's optional peers. `server/.npmrc` and `web/.npmrc` set `legacy-peer-deps=true`. The root
  `package.json` therefore avoids npm workspaces and drives sub-packages with `npm --prefix`.
- **TypeScript is pinned to `~5.9.x`** in both packages on purpose. `typescript@7` is published but is
  incompatible with Angular 21's compiler.
- PowerShell blocks `npm.ps1` / `ng.ps1` by default on this machine; run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` or use `cmd /c`.
- The seed script generates its own SVG placeholder images into `server/uploads/seed`, so the demo
  store renders with no external image URLs and no Cloudinary account. Those placeholder URLs are
  served from local disk by `express.static` and are unaffected by the Cloudinary setting, so local
  placeholders and Cloudinary uploads coexist happily.
- **Photo catalogue:** `tools/prepare-catalog-images.ps1` reads `web/src/assets/oxidised` and writes
  cropped derivatives plus `manifest.json` to `server/uploads/catalog`. `seed/catalog.ts` reads that
  manifest and falls back to generated SVGs when it is absent, so a fresh clone still seeds a complete
  store. Several source files are WebP bytes with a `.png` extension; WIC decodes them regardless.
  `seed/catalog.ts` maps each category to explicit source keys (`CATEGORY_SOURCES`) and a deliberate
  tile (`CATEGORY_TILES`), because anklets and hair accessories have no true source shot and reuse the
  closest one. The tool crops/resizes/re-encodes only — it must not alter colour (automatic
  gold→silver recolouring was evaluated and rejected: in these photos gold and skin share hue band
  20-39°, so no per-pixel rule separates them without artefacts). `web/src/assets` is **not** in the
  Angular build — only `public/` is bundled.
- **PowerShell `Set-Content -Encoding UTF8` writes a BOM, and `JSON.parse` throws on it.** The
  manifest writer uses `[IO.File]::WriteAllText` with `UTF8Encoding($false)` and the reader also
  strips `^\uFEFF`. Keep both, or the seed silently falls back to SVG placeholders.
- `listAdminProducts` defaults to `status: 'all'` so drafts stay visible; the public listing defaults
  to `active` only.
- **Cloudinary deletes are eventually consistent at the CDN.** `destroyImage()` passes
  `invalidate: true`, but the old delivery URL can still return 200 for a short while after a
  successful delete — verify with the Admin API (`/resources/image/upload?public_ids[]=…`), not with
  a plain `HEAD` on the delivery URL. `DELETE /admin/uploads` now returns Cloudinary's real
  `result` (`ok` / `not found`) instead of always claiming success.
- `ImageUploader` deliberately does not delete assets while a form is being edited: removing an image
  only drops it from the form value, so cancelling an edit never destroys a live image. Orphaned
  assets are therefore expected unless a save-time diff/cleanup is added.

## Verifying against a live database

`npm run db:check` connects with a 12s single attempt (instead of the API's 5 retries), masks the
password and prints per-collection document counts — use it to confirm `MONGODB_URI` before starting
the API. The boot path logs `Image uploads: cloudinary | local disk` so you can see which mode is
active without reading `.env`.


## Conventions

- No comments in code unless a decision genuinely needs explaining.
- Keep `README.md` (operator-facing setup) and this file (contributor/agent-facing rules) in sync
  with any change to scripts, env keys or architecture.
