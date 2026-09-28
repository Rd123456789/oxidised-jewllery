# Oxidised Jewellery — storefront, admin panel and API

Full-stack e-commerce monorepo for an oxidised jewellery store.

| Layer | Stack |
|---|---|
| Storefront + admin | Angular 21 (zoneless, standalone, signals, deferrable views) + Tailwind CSS 4 |
| API | Node.js 24, Express 5, TypeScript, Zod |
| Database | MongoDB (Mongoose 9) — MongoDB Atlas |
| Images | Cloudinary (with automatic local-disk fallback) |

---

## 1. The two things you must provide

Everything else already works. You only need to fill in **`C:\e-commerce\server\.env`**.

That file already exists and already contains freshly generated JWT/cookie secrets.
Two blocks are still placeholders.

### 1a. MongoDB Atlas → `MONGODB_URI`

**File:** `server/.env` — **line 13**

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=oxidised-jewellery
```

**How to get it**

1. Create a free account: <https://www.mongodb.com/cloud/atlas/register> (free forever, no card).
2. **Build a Database** → choose **M0 / Free** → pick a region near you (for India: `AWS / Mumbai (ap-south-1)`) → **Create**.
3. **Security → Database Access → Add New Database User**
   - Username: e.g. `oxidised_app`
   - Password: click **Autogenerate Secure Password** and copy it. Avoid `@ : / ? # [ ] %` in the password, or you must URL-encode it (see below).
   - Role: **Read and write to any database** → **Add User**.
4. **Security → Network Access → Add IP Address** → **Add Current IP Address**.
   (For a throwaway dev machine only, `0.0.0.0/0` also works but exposes the cluster to the internet.)
5. **Database → Connect → Drivers → Node.js** → copy the string, then paste it over line 13 and replace
   `USERNAME` and `PASSWORD` with the values from step 3.
6. The database name is already handled — `MONGODB_DB_NAME=oxidised_jewellery` is set for you.

If your password contains a special character, URL-encode it:

| char | `@` | `:` | `/` | `?` | `#` | `%` | `[` | `]` |
|---|---|---|---|---|---|---|---|---|
| encoded | `%40` | `%3A` | `%2F` | `%3F` | `%23` | `%25` | `%5B` | `%5D` |

Verify the string before starting the app:

```powershell
cd C:\e-commerce\server
node -e "import('mongoose').then(async m => { await m.default.connect(process.env.MONGODB_URI || require('fs').readFileSync('.env','utf8').match(/MONGODB_URI=(.+)/)[1]); console.log('connected'); process.exit(0); }).catch(e => { console.error('FAILED:', e.message); process.exit(1); })"
```

### 1b. Cloudinary → image uploads

**File:** `server/.env` — **lines 41–43**

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**How to get them**

1. Create a free account: <https://cloudinary.com/users/register_free> (free tier: 25 monthly credits, plenty for a small store).
2. Open the **Console / Dashboard** and find the **Product Environment Credentials** panel.
3. Copy the three values **Cloud name**, **API Key** and **API Secret** into lines 41–43.

Optional: `CLOUDINARY_FOLDER` (line 44) is the top-level folder for new uploads; it defaults to `oxidised-jewellery`.

> **If you leave these blank the app still works.** Uploads are written to `server/uploads`
> and served from `/uploads`. The API logs a warning on boot telling you which mode is active.
> Add the credentials whenever you want cloud-hosted, CDN-served images.

> Note: **Cloudinary** (image hosting, what this project uses) is a different company from
> **Cloudflare** (DNS/CDN/WAF, used at deploy time). Nothing in this code needs a Cloudflare key —
> if you meant Cloudflare, that is a deployment/DNS concern and requires no code change.

### Where not to put secrets

- Do **not** put either value in `web/` — the Angular app has no configuration files and never
  receives these secrets. It talks to the API through `/api`, which the dev server proxies to
  `http://localhost:5000` via `web/proxy.conf.json`.
- Do **not** commit `server/.env`. It is already listed in `.gitignore` (`server/.env.example`
  is the tracked template).

---

## 2. Quick start

```powershell
# 0) One-time: allow npm.ps1 / ng.ps1 to run in PowerShell (see Troubleshooting)
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# 1) Install all three package trees (root, server, web)
cd C:\e-commerce
npm run install:all

# 2) Build the catalogue photos from the source images in web/src/assets/oxidised
#    (optional - without it the seed generates SVG placeholders instead)
npm run catalog:images

# 3) Fill in server/.env (section 1 above), then load the demo catalogue
npm run seed

# 3) Run the API (port 5000) and the Angular dev server (port 4200) together
npm run dev
```

Then open <http://localhost:4200> for the store and <http://localhost:4200/admin> for the panel.

### Seeded logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@oxidisedjewellery.test` | `Admin@12345` |
| Manager | `manager@oxidisedjewellery.test` | `Manager@12345` |
| Customer | `customer@oxidisedjewellery.test` | `Customer@12345` |

Change these in `server/.env` (`SEED_ADMIN_*`, `SEED_CUSTOMER_*`) before seeding anything real.

---

## 3. Scripts

Run from `C:\e-commerce`:

| Command | What it does |
|---|---|
| `npm run install:all` | Installs root, `server/` and `web/` dependencies |
| `npm run install:ci` | Same, but forces devDependencies (used by the deploy build) |
| `npm run catalog:images` | Builds the product/category/collection/banner photos into `server/uploads/catalog` |
| `npm run dev` | API (5000) + Angular dev server (4200) together |
| `npm run dev:server` | API only, watch mode (`tsx watch`) |
| `npm run dev:web` | Angular dev server only |
| `npm run build` | Compiles the API (`server/dist`) and the web app (`web/dist/web`) |
| `npm start` | Runs the compiled API |
| `npm run seed` | Seeds settings, categories, collections, 18 products, banners, pages, coupons, reviews |
| `npm run seed:destroy` | Deletes all documents (keeps indexes) |
| `npm test` | API test suite (Vitest + Supertest) |
| `npm run typecheck:server` | Type-checks the API only |

---

## 4. Project layout

```
C:\e-commerce
├─ package.json                 root scripts (no workspaces — see Troubleshooting)
├─ tools/
│  └─ prepare-catalog-images.ps1  builds web-ready photos from web/src/assets/oxidised
├─ server/                      Node.js + Express 5 + TypeScript API
│  ├─ .env                      ← YOUR SECRETS GO HERE
│  ├─ .env.example              tracked template
│  ├─ src/
│  │  ├─ config/                env validation (Zod), Mongo connection + retry, Cloudinary
│  │  ├─ models/                14 Mongoose models
│  │  ├─ middleware/            auth (JWT), error mapping, Zod validation, uploads, rate limits
│  │  ├─ validators/            Zod request schemas
│  │  ├─ services/              pricing, coupons, catalog, cart, orders, dashboard, auth, settings
│  │  ├─ controllers/           HTTP layer (public + admin)
│  │  ├─ routes/                route wiring, mounted at /api/v1
│  │  ├─ seed/                  demo data + generated SVG placeholder images
│  │  └─ __tests__/             Vitest + Supertest suite
│  └─ uploads/seed/             generated placeholder images (local mode)
├─ web/                         Angular 21 app
│  ├─ proxy.conf.json           /api and /uploads → http://localhost:5000
│  └─ src/app/
│     ├─ core/                  API client, models, session/cart/catalog/order/admin services,
│     │                         guards, auth interceptor, formatting + SEO utils
│     ├─ shared/components/     icon, product card, price, rating, stepper, pagination,
│     │                         empty state, skeleton grid, status badge, image uploader, toasts
│     ├─ layouts/               storefront shell (header/footer) and admin shell (sidebar/topbar)
│     └─ features/
│        ├─ storefront/         home, shop, product, collections, cart, checkout, order success,
│        │                      track order, auth (login/register/forgot/reset), account, wishlist,
│        │                      CMS pages, 404
│        └─ admin/              login, dashboard, products, categories, collections, orders,
│                               customers, reviews, coupons, banners, pages, settings
```

---

## 5. Catalogue imagery

Source photographs live in `web/src/assets/oxidised`. That folder is **not** part of the Angular build
(`angular.json` only bundles `public/`), so it is purely raw material — nothing there ships to
the browser.

`npm run catalog:images` reads those sources and writes web-ready derivatives to
`server/uploads/catalog`, which the API already serves at `/uploads/catalog/...`:

| Output | Size | Used for |
|---|---|---|
| `<source><1..3>.jpg` | 1200×1500 (4:5) | Product galleries — three crops of one source per product, so a gallery shows one piece from several angles |
| `cat-<source>.jpg` | 600×750 | Category tiles |
| `col-<n>.jpg` | 1600×900 | Collection hero tiles |
| `hero-<n>.jpg` | 1920×720 | Homepage banners |
| `manifest.json` | — | Tells the seed which files exist |

The tool only decodes, crops, resizes and re-encodes. **No colour is altered** — the photographs are
used exactly as supplied. It handles JPEG, PNG and WebP (via Windows Imaging Component), and is
idempotent: re-running overwrites the derivatives.

If `manifest.json` is absent, `npm run seed` falls back to generating its own SVG placeholders, so a
fresh clone still boots a complete store.

### Image licensing — read before going live

| Source | Licence | Status |
|---|---|---|
| `pexels-vedat-29013500.jpg` | Pexels License | Safe — commercial use, no attribution required |
| `pexels-vedat-29043373.jpg` | Pexels License | Safe — commercial use, no attribution required |
| `images.jpg`, `images (1).jpg`, `images (2).jpg` | Unknown | `images.jpg` is the default filename a browser gives a Google Images download |
| `unnamed.png` | Unknown | Carries a social-post border |
| `10-137011_2.png`, `1-min_<hash>.png` | Unknown | Filenames suggest Pinterest/CDN captures |

The five "Unknown" files have no verifiable provenance. Replace them with licensed photography
(or your own product shots) before this store takes real orders — an unlicensed image on a live
commercial site is a legal exposure, not just a placeholder.

Note also that every supplied photo shows **bright yellow gold**, while the catalogue sells
oxidised silver (charcoal patina, silver/black). Automatic recolouring was evaluated and rejected:
in these photos gold sits at hue 30-39°, the same band as skin, the brown mannequin bust and warm
wood, so no per-pixel rule can separate them without artefacts. The mismatch is a content problem
that needs the right photographs, not an image-processing fix.



## 6. Deferrable views

The storefront uses Angular's `@defer` for anything below the fold, so each section ships as its
own lazily-loaded chunk and its data is fetched only when it scrolls into view:

```html
@defer (on viewport) {
  <app-featured-products-section eyebrow="Handpicked" title="Most loved this season" />
} @placeholder (minimum 300ms) {
  <div class="ox-skeleton h-64 rounded-2xl"></div>
} @loading (minimum 200ms) {
  <span class="ox-spinner"></span>
} @error {
  <p>We could not load the featured pieces. Please refresh the page.</p>
}
```

Deferred sections on the home page: featured products, category strip, collections, the
craft story, and new arrivals. Also deferred: product reviews, related pieces, recently viewed,
admin dashboard charts and the low-stock inventory table.

`@defer` is a compile-time feature — components used inside a block must still be listed in the
owning component's `imports`; the compiler then emits them into a separate chunk. You can see this
in the build output as `featured-products-section`, `category-strip-section`, `collections-section`
and `new-arrivals-section` chunks.

---

## 7. API overview

Base URL `/api/v1`. Every response is `{ success, data, meta? }` or `{ success: false, error: { code, message, details? } }`.

**Public**

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness + Mongo state |
| GET | `/products` | Filters: `category, collection, q, minPrice, maxPrice, colors, materials, stones, occasions, tags, inStock, featured, newArrival, bestSeller, onSale, minRating, sort, page, limit` |
| GET | `/products/facets` | Available filter values + price range |
| GET | `/search/suggest?q=` | Header typeahead: matching products, categories and collections (cached 60s) |
| GET | `/products/:slug` | Full product (excludes `costPrice`) |
| GET | `/products/:slug/related` | Same-category recommendations |
| GET | `/products/:idOrSlug/reviews` | Approved reviews + rating summary |
| GET | `/categories`, `/categories/:slug` | Category tree |
| GET | `/collections`, `/collections/:slug` | Curated collections |
| GET | `/banners?position=hero` | Active banners |
| GET | `/pages`, `/pages/header`, `/pages/:slug` | CMS pages |
| GET | `/settings/public` | Storefront settings |
| POST | `/newsletter/subscribe` | — |
| POST | `/auth/register`, `/auth/login`, `/auth/admin/login`, `/auth/refresh`, `/auth/logout` | JWT access token + httpOnly refresh cookie |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Returns the token in the response outside production (no SMTP configured) |
| GET/PATCH/POST | `/auth/me`, `/auth/addresses` | Profile + address book |
| GET/POST/PATCH/DELETE | `/cart`, `/cart/items`, `/cart/coupon`, `/cart/merge` | Guest carts keyed by the `x-cart-session` header |
| GET/POST | `/wishlist`, `/wishlist/toggle` | — |
| POST | `/orders`, `/orders/quote` | Place / price an order. Send an `Idempotency-Key` header to make retries safe |
| GET | `/orders`, `/orders/:orderNumber`, `/orders/track` | Customer orders and public tracking |

Outside the versioned prefix the API also serves `GET /sitemap.xml` (generated from live
categories, collections, products and CMS pages); `robots.txt` is served from the web app's
`public/` folder and points at it.

**Admin** (`/admin/**`, requires an `admin` or `manager` JWT) — full CRUD for products (incl.
stock, variant stock, flags, duplicate), categories, collections, orders (status changes with
validated transitions, tracking, CSV export), customers, reviews, coupons, banners, pages,
settings, newsletter subscribers, dashboard stats and image uploads.

---

## 8. Deploying to a free host

`render.yaml` is a Render blueprint for the free plan. A single web service serves both the
API and the built storefront, which is why:

- the rotating refresh cookie stays `sameSite=lax` — no cross-site cookie work,
- `/sitemap.xml` and `/robots.txt` resolve on the same origin,
- the app's own requests need no `CORS_ORIGINS` entry: the service always trusts its own
  hostname, and `CORS_ORIGINS` only lists other origins (a custom domain, the dev server).

### Before the first deploy

1. **Push to Git.** Render deploys from a repository.
2. **MongoDB Atlas** (free M0). Network Access must allow `0.0.0.0/0`, because Render's
   outbound addresses are not fixed. Put the connection string in the dashboard as
   `MONGODB_URI`.
3. **Cloudinary** (free). On the free plan this is **required, not optional**: the filesystem
   is ephemeral, so anything written to `server/uploads` disappears on the next restart or
   deploy.
4. `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `COOKIE_SECRET` are generated by Render
   (`generateValue: true`). Do not reuse the development values.
5. **Seed once** with `npm run seed` so the catalogue exists. It is idempotent — every write
   is an upsert — and with Cloudinary configured it publishes each catalogue photo *before*
   writing records, so no product ends up pointing at a file the host does not have.

### What the deploy runs

| Step | Command |
|---|---|
| install | `npm run install:ci` — forces devDependencies, because `NODE_ENV=production` would otherwise skip the Angular CLI |
| build | `npm run build` — emits `server/dist` and `web/dist/web/browser` |
| start | `npm start` → `node dist/index.js` |

In production the API serves the storefront itself: hashed assets as
`max-age=31536000, immutable`, `index.html` as `no-cache`, and a shell fallback so deep links
such as `/product/<slug>` and `/admin/orders` resolve instead of 404ing. `WEB_DIST_DIR`
overrides the default bundle location (`web/dist/web/browser`).

The API index moved to `/api/v1` because `/` belongs to the storefront whenever the bundle
is present.

### Checks after deploying

- `GET /api/v1/health` returns `200` — this is the configured health check path
- `/` and a deep link both render the storefront, not a 404
- images load from `res.cloudinary.com`; if they are blocked, the credentials are wrong or
  the CSP `img-src` no longer lists that origin
- sign in, reload, and stay signed in (proves the refresh cookie survives)
- `/sitemap.xml` lists live products

### Free-plan limits worth knowing

- The service **spins down after ~15 minutes idle**; the next request takes 30-60 s. Fine for
  a demo or UAT, poor for real shoppers.
- 512 MB RAM, shared CPU, no persistent disk.
- Atlas M0 is 512 MB of shared storage.

---

## 9. Troubleshooting

**`npm.ps1 cannot be loaded because running scripts is disabled`**
PowerShell blocks npm's shim. Either allow signed scripts once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

or prefix commands with `cmd /c` / use `npm.cmd`.

**`npm error Cannot read properties of null (reading 'edgesOut')`**
A bug in npm 11.3.0's recursive peer resolution, triggered by Vitest 4's optional peer set. This
repo ships `.npmrc` files with `legacy-peer-deps=true` in `server/` and `web/` to work around it.
Deleting those two files after upgrading npm (`npm i -g npm@latest`) is safe.

Because of that bug the root `package.json` intentionally does **not** use npm workspaces;
`server/` and `web/` are installed independently and driven with `npm --prefix`.

**`Cannot reach the store server` in the browser**
The Angular dev server proxies `/api` to `http://localhost:5000`. Make sure `npm run dev:server`
(or the combined `npm run dev`) is running and that `PORT=5000` in `server/.env`.

**`Invalid environment configuration` on boot**
`server/.env` is missing or a required value is blank. The error lists exactly which keys failed.

**Images not appearing in Cloudinary mode**
Check the folder is not blocked and that the three `CLOUDINARY_*` values come from the same
product environment. Uploads need `admin`/`manager` rights, so sign in to the admin panel first.

---

## 10. Security notes before going live

- Rotate `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `COOKIE_SECRET` for production.
- Set `NODE_ENV=production`, a real `CORS_ORIGINS` origin and a real `COOKIE_DOMAIN`.
- In production the API sends a strict Content-Security-Policy (`server/src/app.ts`). It
  allows `'self'` plus `https://res.cloudinary.com` for images and `'unsafe-inline'` for
  styles, which Angular's inlined critical CSS requires. Adding another image host or a
  third-party script means editing that policy.
- Never expose `costPrice`, `MONGODB_URI` or Cloudinary secrets to the browser — they are server-only.
- Add SMTP (Nodemailer) if you want real password-reset and order-confirmation emails; the
  integration point is marked in `server/src/services/auth.service.ts`.
- Payment gateways are not wired: `payment.method` supports `cod`/`upi`/`manual` today, and
  signature verification for Razorpay/Stripe belongs in `markPaymentSucceeded` in
  `server/src/services/order.service.ts`.
