# Home page modernisation plan (execution hand-off)

> **Status: executed** (hero stage pinned, `.ox-rail` product rows, bento collections, statement
> band, build clean + class audit green). Kept for reference; the remaining checks are visual
> (slide transitions at 375/768/1280px must not shift any section boundary).

Goal: a calm, new-age storefront home (Linear/Anthropic-style) with **layout stability as the
first rule**: no band may resize in response to image dimensions or per-slide copy length.

Repo: `C:\e-commerce`. Read `AGENTS.md` first — it is binding. Key rules repeated here because
they are easy to break:

- Angular 21, zoneless, standalone, `ChangeDetectionStrategy.OnPush`, control flow (`@if/@for`),
  signals, `input()`/`inject()`. No `*ngIf`/`*ngFor`.
- Tailwind 4 utilities + design-system classes in `web/src/styles.css` (`@layer components`).
  Never use an `ox-*` modifier without its base class. Utilities always beat `components`.
- No hover-only affordances on cards/tiles (touch). Use `active:` states.
- All animations must stay disabled under `prefers-reduced-motion`.
- Components referenced inside `@defer` must be in the owning component's `imports`.
- No comments in code unless a decision needs explaining.

## Why the current hero resizes ("getting bigger and smaller")

`web/src/app/features/storefront/home/home.page.html` hero:

1. The image panel uses `aspect-[4/5] sm:aspect-[16/10] lg:aspect-[4/3]`, so its height is a
   multiple of its width at every breakpoint.
2. The grid row height is `max(copy, image)`, and every banner has a different title/subtitle
   length, so the stage height changes on every slide transition.

Fix rule for the whole page: **fixed or min heights only; images are always `object-cover`
inside a box whose size does not depend on the image.**

## 1. Hero — stable split stage

File: `web/src/app/features/storefront/home/home.page.html` (only the hero block changes).

- Grid container: `grid gap-10 lg:min-h-[34rem] lg:grid-cols-[1.05fr_1fr] lg:items-stretch lg:gap-16`.
  The `lg:min-h-[34rem]` pins the desktop stage; copy must never exceed it (verify against
  `server/src/seed/data.ts` banner titles/subtitles; clamp the subtitle, next point).
- Copy column: `flex min-w-0 flex-col justify-center`. Keep `ox-hero-copy`, eyebrow, `ox-h1`,
  one `ox-btn--primary` CTA and one `ox-link-arrow`. Subtitle gets `line-clamp-3`
  (`max-w-[34rem]` stays) so a long subtitle cannot grow the stage.
- Image panel: `relative h-64 overflow-hidden rounded-3xl border border-sand-deep/60 bg-sand
  sm:h-80 lg:h-full` — fixed height on mobile/tablet, fills the pinned row on `lg`. **No
  `aspect-*` classes.**
- Crossfade layers stay `absolute inset-0` with `h-full w-full object-cover` images,
  `transition-opacity duration-[900ms]`, `motion-reduce:transition-none`, `fetchpriority` on the
  first slide. Keep the `@empty` skeleton/fallback (sized to the panel, `absolute inset-0`).
- Keep dots + arrows under the panel; keep autoplay/visibility logic in `home.page.ts`
  (no TS changes needed).

## 2. Trust strip — keep

Already hairline (`lg:divide-x`), stable. No change.

## 3. Featured products — snap rail instead of grid

Files: `web/src/app/features/storefront/home/sections/featured-products.section.html`,
`featured-products.section.ts`, plus `web/src/styles.css`.

- Add a rail primitive to `styles.css` (`@layer components`):

  ```css
  .ox-rail {
    display: flex;
    gap: 1.25rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    padding-bottom: 0.25rem;
  }

  .ox-rail::-webkit-scrollbar {
    display: none;
  }

  .ox-rail > * {
    scroll-snap-align: start;
    flex-shrink: 0;
  }
  ```

  Also add `.ox-rail > *` to the `prefers-reduced-motion` block only if you animate it (you will
  not — no JS-driven scroll animation, so nothing to disable).
- Featured template: replace the product grid with `<div class="ox-rail">` and each
  `<app-product-card>` wrapped in `<div class="w-40 shrink-0 sm:w-48 lg:w-56">` (card fills the
  wrapper; adjust widths so 2–4 cards are visible per viewport). Keep `app-section-header`.
- Loading skeleton becomes a matching non-scrolling row of the same widths (four
  `ox-skeleton` blocks, same wrapper widths, inside a plain `flex gap-5` — not `.ox-rail`, so it
  cannot be scrolled mid-load).
- `xl:grid-cols-4` grid classes disappear; nothing else changes in the TS.

## 4. Category strip — keep, one stability fix

File: `category-strip.section.html`. Tiles are already circular and borderless. Replace the
image classes `h-20 w-20 ... sm:h-24 sm:w-24` — these are already fixed, so keep them, but make
the fallback `<span>` identical (it is). No change needed unless widths differ after the rail
work. Verify grid stays `grid-cols-3 sm:grid-cols-6` (never aspect-driven).

## 5. Collections — fixed-height bento

File: `collections.section.html`.

- Grid: `grid gap-5 sm:grid-cols-2 lg:grid-cols-3` (was 4 across).
- First collection tile is the feature tile: `sm:col-span-2 lg:col-span-2`, image box
  `h-64 sm:h-80` (fixed). Remaining tiles: image box `h-60 sm:h-72` (fixed). **No `aspect-*`,
  no `h-56`-style classes tied to image natural size** — `object-cover` everywhere.
- Overlay stays light: `bg-gradient-to-t from-ink/70 via-ink/10 to-transparent`, `p-5`,
  title + tagline + Explore arrow (no badge).
- Loading skeletons must use the exact same box heights and column spans so the defer swap
  does not jump: first skeleton `sm:col-span-2 h-64 sm:h-80`, rest `h-60 sm:h-72`.

## 6. Craft block — keep, already stable

`border-y border-ivory/10 bg-ink`, `ox-section`, `ox-h2`, prose measure. No image, no aspect
classes — stable. No change.

## 7. New arrivals — same rail treatment as featured

File: `new-arrivals.section.html`. Same `.ox-rail` markup, wrapper widths, and non-scrolling
skeleton row. Keep the `app-section-header` with `[linkQueryParams]="{ newArrival: true }"`.

## 8. New: big statement band (the "new age" moment)

File: `home.page.html`, inserted after the collections `@defer` block, before the craft block.
Static markup only (no data fetch), wrapped in its own `@defer (on viewport)` with a
placeholder of the same height (`h-40`):

```html
<section class="ox-reveal border-y border-sand-deep/60 bg-paper">
  <div class="ox-container ox-section--tight text-center">
    <p class="ox-eyebrow">Why oxidised</p>
    <h2 class="ox-h1 mt-4 text-balance">Oxidised, not ordinary.</h2>
    <p class="mx-auto mt-5 max-w-[34rem] text-sm leading-relaxed text-ink-soft sm:text-base">
      A deep, deliberate patina that flatters every skin tone — finished by hand, priced honestly.
    </p>
    <a class="ox-link-arrow mt-7 self-center" routerLink="/shop">
      Shop the range <app-icon name="arrow-right" [size]="14" />
    </a>
  </div>
</section>
```

Static text is fine to hard-code like the trust strip copy. Do not add a CMS dependency.

## 9. Recently viewed — keep

Already on `ox-section--tight` with `ox-h2`; its rail already scrolls horizontally and its
tiles are fixed-width. No change.

## 10. Verification (must all pass before you report done)

1. `cmd /c "npm run build:web"` — clean, zero template errors.
2. Height-stability check in the built app: switch hero slides (dots/arrows) at 375px, 768px
   and 1280px widths — the hero stage and every section boundary must not move by a pixel.
   Same for the collections first/other tiles.
3. Class audit: every new class token (`ox-rail`, `lg:min-h-[34rem]`, `line-clamp-3`, `h-64`,
   `sm:h-80`, `lg:h-full`, `lg:col-span-2`, `h-60`, `sm:h-72`, `w-40`, `sm:w-48`, `lg:w-56`)
   must appear in `web/dist/web/browser/*.css`. Escape `:`, `/`, `[`, `]`, `.` when grepping
   (e.g. search `.lg\:min-h-\[34rem\]`), or write a small Node script that unescapes selectors.
4. Confirm `prefers-reduced-motion` still disables every animation listed in `AGENTS.md`.
5. Do not touch: pricing, cart, checkout, admin, `styles.css` tokens other than adding
   `.ox-rail`, `app.routes.ts`, and any server code.

## Out of scope

Fonts (system stack is a deliberate decision), dark mode, new dependencies, CMS wiring for the
statement band, any change to `home.page.ts` logic beyond what the template needs.
