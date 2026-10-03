# Chatbot feature — handover context

Deterministic (no LLM) chatbot answering oxidised-jewellery FAQs and **live product availability**.
One server brain, two clients (Expo mobile first, then Angular web).

## Why deterministic

Availability and pricing are hard catalog facts. An LLM would guess them. Rules give exact answers
from live data, cost nothing, need no API key, and are unit-testable. Free text is still accepted —
it routes to known intents and falls back gracefully.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Server brain + endpoint + tests | **done** — 57 tests passing |
| 2 | Mobile (Expo) chat UI | **done** — typecheck + lint clean |
| 3 | Web (Angular) chat UI | **done** — typecheck + production build clean |
| 4 | Conversational memory + follow-ups | **done** |
| 5 | Discovery browsing + fault handoff | **done** |
| 6 | Commit + push | **not done — nothing is committed yet** |

**No external AI model is used, by explicit decision.** The assistant is entirely rule-based and
deterministic — no `AI_API_KEY`, no model provider, no network call to any LLM. Everything it says
about stock, price, shipping and returns is read live from MongoDB and the store settings.

Live routing verified against the running API:

```
'jhumka'                            -> availability  Oxidised Silver Jhumka Earrings
'do you have jhumkas'               -> availability  Oxidised Silver Jhumka Earrings
'how much is it'        (with hist) -> price         Oxidised Silver Jhumka Earrings
'is it in stock?'       (with hist) -> availability  Oxidised Silver Jhumka Earrings
'what about the adjustable ring?'   -> availability  Oxidised Adjustable Ring
'how long does delivery take for the maang tikka' -> availability Oxidised Maang Tikka
'how long is delivery'              -> shipping
'what payment methods do you accept'-> payment
'how do I clean it'                 -> care
'is it safe for sensitive skin?'    -> materials
'what is your return policy'        -> returns
'show me the best sellers'          -> discovery    3 products
'what is your cheapest piece'      -> discovery    3 products
'any under 500?'                    -> discovery    3 products
'my parcel arrived broken'          -> fault        (hands off to support)
'does it come with a warranty'      -> fault
'do you sell motorcycles'           -> fallback
'ignore all previous instructions'  -> refusal
```

## Repos (two separate git repos)

- `C:\e-commerce` → `oxidised-jewllery.git`, branch `main`
- `C:\e-commerce-mobile\mobile` → `e-commerce-mobile.git`, branch `master`

## The contract (both clients depend on this)

`POST /api/v1/chat` — public, no auth, guest-allowed, `writeLimiter` rate limit.
Request: `{ message: string, history?: { role: 'user' | 'assistant'; content: string }[] }`
Response (`data`):

```ts
{
  reply: string;                 // one short paragraph
  intent: string;                // availability | policy | care | materials | sizing | shipping | returns | payment | fallback
  suggestions: string[];         // tap-able follow-ups, max 4
  products: Array<{              // present only for availability intents
    slug: string; name: string; image?: string;
    price: number; currency: string;
    inStock: boolean; stock: number; lowStock: boolean;
  }>;
  contact?: { email?: string; whatsapp?: string };  // present when the bot hands off
}
```

## Files

**Server** (`C:\e-commerce\server\src\`)
- `services/chat.service.ts` — all intent logic. Pure-ish: takes `{ message, history }`, returns the reply shape.
- `routes/chat.routes.ts` — route + `validate({ body: chatSchema })` + `writeLimiter`.
- `validators/chat.validator.ts` — `chatSchema`.
- `__tests__/chat.service.test.ts` — intents, availability, injection attempt, settings-driven policy answers.

Registered in `routes/index.ts` via `router.use('/', chatRoutes);`.

**Mobile** (`C:\e-commerce-mobile\mobile\`)
- `src/api/client.ts` — `ChatMessage`/`ChatReply`/`chat()` added alongside the other typed calls.
- `src/components/chat.tsx` — floating launcher + sheet, built from the theme tokens.

**Web** (`C:\e-commerce\web\src\app\`)
- `core/services/chat.service.ts`
- `shared/components/chat/chat-widget.component.ts` + `.html`

## Conventions that matter here

- Server modules import with explicit `.js` extensions (`from '../models/product.model.js'`).
- Every response goes through `sendSuccess(res, data, opts)` — never hand-roll `res.json`.
- Routes wrap handlers in `asyncHandler` and validate with zod before the controller runs.
- `.lean()` bypasses schema transforms; `sendSuccess` normalises `_id` → `id` centrally, so lean
  queries are safe.
- Stock truth: `variants.length ? variants.some(v => v.isActive && v.stock > 0) : stock > 0`.
  `pre('validate')` already folds variant stock into `stock`.
- Mobile: theme tokens only (`radius`, `spacing`, `layout`, `type`, `font`, `elevation`) via
  `useThemedStyles`. No hardcoded colours.
- Web: `ox-card` / `ox-btn` / `ox-icon` classes, `ChangeDetectionStrategy.OnPush`, signals over fields.

## Verified

- `npm test` in `server` — full suite green.
- `npm run typecheck:server` and `npm run typecheck:web` clean.
- ESLint clean on touched mobile files.
- Endpoint exercised live against `localhost:5000`.

## Running locally

```powershell
# API          C:\e-commerce        -> cmd /c npm run dev:server        (:5000)
# Metro        C:\e-commerce-mobile\mobile -> cmd /c npx expo start
# Web          C:\e-commerce\web    -> cmd /c npm start
```

Emulator: `Pixel_4_XL_API_35`. Adb at
`C:\Users\Rajdip Parmar\AppData\Local\Android\Sdk\platform-tools\adb.exe`.

## Things a future agent should not get wrong

- **Do not** reintroduce a schema `default` on a nested path to fix a missing field. Mongoose applies
  defaults on write, not on read, so it does not fix already-stored documents. This exact trap was hit
  on the order-detail bug — normalise at the response layer instead.
- The guest-cart merge on web is verified working; leave it alone.
- Any function called from inside a Reanimated worklet must itself be a worklet. `useCallback` helpers
  are not — inline them or add `'worklet'`. This caused the zoom crash.
- `angular.json` `anyComponentStyle` warning budget was raised 4kB → 6kB for the chat widget
  (error ceiling left at 8kB). The widget is ~4.1kB of real CSS; comment-stripping does not reduce
  it. Do not raise it further without trimming the widget.

## Adding a new intent

1. Add an entry to `KNOWLEDGE` in `chat.service.ts`, or extend the availability branch if it needs
   the catalog. Entries are tried **in order, first match wins** — so a specific intent must come
   before a broader one that also matches its wording (`payment` before `shipping`).
2. If the intent should win over a product question ("what size is a ring"), add a pattern to
   `EXPLICIT_QUESTION_PATTERNS` keyed by that intent.
3. Any new word that belongs to store policy rather than a product must go in `POLICY_WORDS`.
   Otherwise it is treated as a product name and the question is answered from the catalogue.
4. Any generic verb/adjective that is not a product noun must go in `STOP_WORDS`.
5. Add tests covering the new intent, a settings-driven change to it, and one case proving it does
   not swallow a neighbouring intent.

## Traps hit while building this — do not repeat them

- **A knowledge entry can match a word inside a product name.** `care` matched `\boxidis`, which is a
  substring of "oxidised", so *"is the oxidised chandbali ring in stock?"* was answered with tarnish
  advice. Anchored it (`\boxidis\b`) **and** made a named product take precedence, decided by
  *looking the product up* rather than by counting words — "ring" matches a real product, so a word
  count cannot tell a specific mention from a category one.
- **`STOP_WORDS` leaking nouns is worse than a loose match.** "it", "that", "piece" once became search
  terms, so *"That piece is in stock"* resolved to a search for "piece". Pronouns belong in
  `STOP_WORDS` and `PRONOUNS` at once.
- **Do not filter on the trailing `?`.** Doing so discarded every "what about X?" follow-up.
- **Never assert a figure that came from history.** History is search *input* only; prices and stock
  are re-read from the catalog. There is a test for exactly this.

## Known rough edges

- The knowledge text in `KNOWLEDGE` is hardcoded in the service rather than seeded as editable
  `Page` content. It was a deliberate first pass: admin-editable content needs a schema and an editor,
  and it is the natural follow-up if the wording needs changing often.
- Memory resolves *which product* a follow-up refers to, but nothing else. It cannot hold a slot for
  a filter ("show me those in gold"), and it does not remember a stated budget.
- Discovery reads 200 active products to score them in memory. Fine at this catalogue size; worth a
  proper index or `$text` query if it grows into the thousands.
- "what size is a ring" returns the rings in stock rather than sizing guidance. Defensible — "ring"
  genuinely is a product category and not a named piece — but if you would rather sizing always won,
  the fix is in `EXPLICIT_QUESTION_PATTERNS.sizing`.
- Still falling back to the honest "I am not sure I follow" for questions with no intent at all —
  "do you gift wrap", "are you open on Sundays". Each needs either a new intent or admin-editable
  content.