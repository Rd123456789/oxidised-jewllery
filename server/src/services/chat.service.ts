import { Product } from '../models/product.model.js';
import { getSettings } from './settings.service.js';

/**
 * The chatbot's brain: maps a shopper's message to an intent and answers from live data.
 *
 * Deliberately rule-based rather than a language model. Availability, price and policy are facts this
 * store already owns — an LLM would be asked to state them from memory and would eventually be wrong
 * about a price or promise stock it cannot see. Reading `Product` and the store settings means an
 * answer changes the moment an admin edits either, and every answer is reproducible in a test.
 *
 * Answers are short. A chat bubble is not a policy document, so each reply stays to a couple of
 * sentences and ends with something actionable: a tap-able follow-up, a product to look at, or a way
 * to reach a human.
 */

export interface ChatProduct {
  slug: string;
  name: string;
  image?: string;
  price: number;
  currency: string;
  inStock: boolean;
  stock: number;
  lowStock: boolean;
}

export interface ChatContact {
  email?: string;
  whatsapp?: string;
}

export interface ChatReply {
  reply: string;
  intent: string;
  suggestions: string[];
  products: ChatProduct[];
  contact?: ChatContact;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatInput {
  message: string;
  history?: ChatHistoryEntry[];
}

/**
 * Keywords that mean "I want to know if I can buy this". Ordered: availability is checked before
 * anything else, because "is the jhumka in stock" is both a product question and a stock question and
 * the product half is the one the shopper wants.
 *
 * Note "available" is not here on its own. It appears inside phrases like "cash on delivery
 * available", and matching the bare word sent payment and policy questions down the catalog branch.
 */
const AVAILABILITY_WORDS = [
  'in stock',
  'instock',
  'stock',
  'available',
  'availability',
  'sell out',
  'sold out',
  'left',
  'remaining',
];

/**
 * "do you have the jhumkas" with no stock wording at all. Still an availability question — a shopper
 * asking that wants to know whether they can buy the thing, and without this it fell through to the
 * fallback and claimed not to understand.
 *
 * Deliberately narrow. An earlier, broader `do you have` matched "do you sell motorcycles" too and
 * answered it from the catalogue. The guard below is what keeps this to products: these phrases only
 * count when there are search terms left over, and motorcycle/sell are policy words that get filtered
 * out before that check.
 */
const AVAILABILITY_PHRASES = [
  /\b(do|does) (you|i|we) (have|got)\b/i,
  /\bdo you have\b/i,
  /\bcan i (get|buy|order)\b/i,
];

/** Phrases that try to steer the bot out of its job. Refused plainly rather than obeyed. */
const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above)/i,
  /disregard (all |any )?(previous|prior|above|your)/i,
  /you are (now )?a/i,
  /act as (a|an|if)/i,
  /system prompt/i,
  /reveal (your|the)/i,
  /\bDAN\b/,
  /jailbreak/i,
  /developer mode/i,
];

/** Filler words stripped before matching, so "do you have the tikka in stock?" still hits "tikka". */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'do', 'does', 'you', 'i', 'my', 'me', 'have', 'has', 'any', 'some',
  'can', 'could', 'would', 'please', 'of', 'in', 'on', 'it', 'to', 'for', 'and', 'or', 'there',
  'that', 'this', 'with', 'get', 'tell', 'know', 'want', 'need', 'looking', 'still', 'yet', 'right',
  'now', 'about', 'whats', 'wheres', 'how', 'much', 'many',
  // Interrogatives and discourse markers. Left in, "what about the adjustable ring?" searched for
  // "what" as well as "adjustable ring", which diluted the score and let the wrong piece win.
  'what', 'which', 'who', 'whom', 'whose', 'why', 'when', 'where', 'whether', 'show', 'find',
  'check', 'give', 'list', 'also', 'too', 'then', 'else', 'same', 'other', 'another', 'some', 'let',
  // The pronouns below double as search terms unless filtered, so "That piece is in stock" resolves
  // the follow-up to a search for "piece" instead of to the product that was actually discussed.
  'it', 'that', 'this', 'those', 'them', 'they', 'piece', 'item', 'ones',
  // Generic verbs, adjectives and units. "how long is delivery" searched for "long", and
  // "what payment methods do you accept" for "methods" and "accept" — which made a shipping or
  // payment question look like it named a product, and sent it to the catalogue instead.
  'long', 'short', 'fast', 'slow', 'quick', 'big', 'small', 'large', 'tiny', 'cheap', 'costly',
  'accept', 'accepted', 'accepts', 'available', 'work', 'works', 'working', 'happen', 'happens',
  'take', 'takes', 'need', 'needs', 'want', 'come', 'comes', 'make', 'makes', 'buy', 'buys', 'bought',
  'rs', 'rupees', 'inr', 'only', 'just', 'much', 'many', 'lot', 'lots',
]);

interface KnowledgeEntry {
  intent: string;
  /** Every phrase that should route here. Matched as a substring of the normalised message. */
  patterns: RegExp[];
  /**
   * Builds the answer. Policy entries read live settings so an admin edit is reflected immediately.
   * Returns `undefined` when the entry does not apply, letting the caller fall through.
   */
  build: (settings: Awaited<ReturnType<typeof getSettings>>) => string | undefined;
  suggestions: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

function currency(value: number, code: string): string {
  const symbol = code === 'INR' ? '₹' : '';
  const separator = code === 'INR' ? ',' : '';

  return `${symbol}${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, separator)}`;
}

/**
 * True availability for a product, mirroring the `inStock` virtual on the schema. Variants win when
 * present: a product whose every variant is sold out is out of stock even if `stock` still says
 * otherwise.
 */
function productAvailability(product: {
  stock: number;
  variants?: { isActive: boolean; stock: number }[];
}): { inStock: boolean; stock: number } {
  if (product.variants && product.variants.length > 0) {
    const stock = product.variants
      .filter((variant) => variant.isActive)
      .reduce((total, variant) => total + (variant.stock ?? 0), 0);

    return { inStock: stock > 0, stock };
  }

  return { inStock: product.stock > 0, stock: product.stock };
}

/**
 * Words that belong to store policy, not to a product. Without this, "is cash on delivery available"
 * left `cash` and `delivery` as search terms, which read as a product name and sent a payment
 * question into the catalog branch.
 */
const POLICY_WORDS = new Set([
  'cash', 'delivery', 'deliver', 'shipping', 'ship', 'return', 'returns', 'refund', 'exchange',
  'payment', 'pay', 'payable', 'cod', 'upi', 'card', 'cards', 'razorpay', 'invoice', 'order',
  'orders', 'price', 'cost', 'charge', 'charges', 'rate', 'free', 'offer', 'discount', 'coupon',
  'gst', 'tax', 'taxes', 'warranty', 'guarantee', 'shipping', 'options', 'option', 'available',
  'policy', 'policies', 'contact', 'you', 'your', 'us',
]);

/**
 * Strips the question down to the words worth searching for, so a phrase like "do you have the
 * oxidised maang tikka with pearl in stock" reduces to the product's own words.
 */
function searchTerms(message: string): string {
  return normalize(message)
    .split(' ')
    .filter(
      (word) =>
        word.length > 2 &&
        !STOP_WORDS.has(word) &&
        !POLICY_WORDS.has(word) &&
        !AVAILABILITY_WORDS.includes(word),
    )
    .join(' ')
    .trim();
}

/**
 * Reduces a word to a stem crude enough to bridge singular and plural.
 *
 * Without this, "do you have the jhumkas in stock" matched nothing — "jhumkas" is not a substring of
 * "jhumka", and shoppers ask in plurals while product names are singular. It only strips a trailing
 * `s`, so it cannot mangle words that merely end in one.
 */
function stem(word: string): string {
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Finds the product a shopper is asking about.
 *
 * Scoring rather than a plain lookup, because availability is the one answer that has to be right: a
 * reply naming the wrong piece sends someone to buy something they did not ask about. Both the terms
 * and the product name are stemmed, then matched three ways, because neither direction alone is
 * enough — a shopper types "jhumkas" against "Jhumka", but types "oxidised" against "Oxidised" in a
 * longer name.
 */
async function findProducts(message: string, limit: number): Promise<ChatProduct[]> {
  const terms = searchTerms(message)
    .split(' ')
    .filter((word) => word.length > 1);

  if (terms.length === 0) {
    return [];
  }

  const candidates = await Product.find({ isActive: true })
    .select('name slug price currency stock lowStockThreshold images variants')
    .limit(200)
    .lean<{
      name: string;
      slug: string;
      price: number;
      currency: string;
      stock: number;
      lowStockThreshold?: number;
      images?: { url?: string; isPrimary?: boolean }[];
      variants?: { isActive: boolean; stock: number }[];
    }[]>();

  const stemmedTerms = terms.map(stem);

  const scored = candidates
    .map((product) => {
      const name = normalize(product.name);
      const nameWords = name.split(' ').filter((word) => word.length > 2);
      const stemmedName = nameWords.map(stem);

      // Stemmed word-in-word, so "jhumka" matches "jhumkas".
      const stemmedHits = stemmedTerms.filter((term) => stemmedName.some((word) => word.includes(term))).length;

      // Exact substring on the whole name, so a partial word still counts when it appears verbatim.
      const directHits = terms.filter((term) => name.includes(term)).length;

      // How much of the product's own name the shopper's words account for. This is what separates a
      // specific piece from a broad category term — almost every product here is "oxidised", so
      // matching on that alone would return the whole catalogue.
      const coverage =
        nameWords.length > 0
          ? stemmedName.filter((word) => stemmedTerms.includes(word)).length / nameWords.length
          : 0;

      return { product, score: stemmedHits * 2 + directHits + coverage * 2 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ product }) => {
    const { inStock, stock } = productAvailability(product);
    const image = product.images?.find((entry) => entry.isPrimary)?.url ?? product.images?.[0]?.url;

    return {
      slug: product.slug,
      name: product.name,
      image,
      price: product.price,
      currency: product.currency,
      inStock,
      stock,
      lowStock: inStock && stock <= (product.lowStockThreshold ?? 5),
    };
  });
}

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    intent: 'care',
    patterns: [
      // `\boxidis\b` rather than `\boxidis`: the unanchored form matched "oxidised", which appears in
      // almost every product name and pulled stock questions into this care answer.
      /\btarnish|\boxidis\b|\bblacken|\bdarken|\bpatina\b/i,
      /\bclean|\bpolish|\bwipe|\bcare\b/i,
      /\bstore|\bstorag|\bkeep\b/i,
      /\bwater\b|\bsweat\b|\bperfume\b/i,
    ],
    build: () =>
      'Oxidised silver is meant to deepen over time — a little care keeps it even. Keep it away from ' +
      'water, perfume and sweat, and store it dry in the pouch it arrived in. Wipe it with a dry, ' +
      'soft cloth after wearing. If you want the shine back, a gentle silver polish restores it, and ' +
      'it will oxidise again over time. Never use toothpaste or a scourer; both scratch the surface.',
    suggestions: ['How do I stop it tarnishing?', 'Is it safe for sensitive skin?', 'What is oxidised silver?'],
  },
  {
    intent: 'materials',
    patterns: [
      /\bnickel\b|\ballergen|\bhyperallergenic|\bsensitive\b|\bskin\b|\bsafe\b/i,
      /\bmaterial|\bmade of|\bsterling|\bsilver\b|\b925\b|\bhallmark\b/i,
    ],
    build: () =>
      'Our pieces are oxidised silver with a deliberate patina, chosen to be gentle on skin. ' +
      'The trust strip on the product pages states the exact materials, and every piece lists its ' +
      'weight and dimensions. If you react to metals, tell us what you are sensitive to and we will ' +
      'check the piece before you buy.',
    suggestions: ['Is it safe for sensitive skin?', 'How do I clean it?', 'What sizes do you have?'],
  },
  {
    intent: 'sizing',
    patterns: [/\bsize\b|\bsizing\b|\bfit\b|\btoo (big|small|tight|loose)\b|\bmeasure\b/i],
    build: () =>
      'Each product page lists its own dimensions and weight in grams, which is the most reliable way ' +
      'to judge fit — a jhumka that looks large in a photo may be light in the hand. If you are ' +
      'between sizes, message us with the piece you have in mind and we will tell you what we would ' +
      'pick.',
    suggestions: ['What sizes do you have?', 'Is it safe for sensitive skin?', 'How do I clean it?'],
  },
  {
    // Ahead of `shipping`: "is cash on delivery available" mentions delivery, but the shopper is
    // asking about payment. Entries are tried in order and the first match wins, so the more specific
    // intent has to come first or the broader one swallows it.
    intent: 'payment',
    patterns: [/\bpay\b|\bpayment\b|\bcod\b|\bcash on delivery\b|\bupi\b|\brazorpay\b|\bcard\b|\binvoice\b/i],
    build: (settings) =>
      `You can pay cash on delivery${settings.codEnabled ? ` for ${currency(settings.codFee, settings.currency)}` : ''} or ` +
      'by card and UPI at checkout. Prices include ' +
      `${settings.taxLabel} at ${settings.taxPercent}%, so the total you see is the total you pay.`,
    suggestions: ['How long does delivery take?', 'What is your return policy?', 'Do you have it in stock?'],
  },
  {
    intent: 'shipping',
    patterns: [/\bdeliver|\bshipping\b|\bship\b|\bcourier\b|\bwhen (will|does) .*(arrive|come)/i, /\border\b/i],
    build: (settings) => {
      const threshold = currency(settings.freeShippingThreshold, settings.currency);
      const flat = currency(settings.shippingFlatRate, settings.currency);

      // The COD sentence is built whole rather than by appending a fee: when COD is switched off there
      // is no fee to quote either, and a stitched-together sentence used to read "Cash on delivery is
      // not available right now for a ₹30 fee".
      const cod = settings.codEnabled
        ? `Cash on delivery is available for a ${currency(settings.codFee, settings.currency)} fee.`
        : 'Cash on delivery is not available right now.';

      return (
        `We ship across India. Delivery is ${flat} flat, and it is free on orders above ${threshold}. ` +
        `${cod} Tracking is on the order page as soon as the parcel moves.`
      );
    },
    suggestions: ['What is your return policy?', 'Is cash on delivery available?', 'How long does delivery take?'],
  },
  {
    intent: 'returns',
    patterns: [/\breturn|\brefund\b|\bexchange\b|\breplace\b|\bwrong (size|item)\b/i],
    build: (settings) => {
      const days = settings.returnsWindowDays;
      const window = days === 1 ? '1 day' : `${days} days`;

      return (
        `You have ${window} to return or exchange an unused piece in its original packaging. ` +
        'Start from your order page and tell us what happened — if it is on us we will sort it quickly.'
      );
    },
    suggestions: ['How long does delivery take?', 'How do I clean it?', 'Is cash on delivery available?'],
  },
];

function greetingReply(): ChatReply {
  return {
    reply:
      'Hello. I can tell you whether a piece is in stock, how to care for oxidised silver, our ' +
      'shipping and returns, and anything else about the jewellery. What would you like to know?',
    intent: 'greeting',
    suggestions: ['Do you have the jhumkas in stock?', 'How do I stop it tarnishing?', 'What is your return policy?'],
    products: [],
  };
}

function thanksReply(): ChatReply {
  return {
    reply: 'Happy to help. Ask me anything else about a piece, or about shipping and returns.',
    intent: 'thanks',
    suggestions: ['Do you have it in stock?', 'How do I clean it?', 'What is your return policy?'],
    products: [],
  };
}

function fallbackReply(contact?: ChatContact): ChatReply {
  const reach = contact?.email ? ` You can also email ${contact.email}.` : '';

  return {
    reply:
      'I am not sure I follow — I can help with stock, care, materials, sizing, shipping and ' +
      `returns. If it is something else, our team will know better than I will.${reach}`,
    intent: 'fallback',
    suggestions: ['Do you have it in stock?', 'How do I clean it?', 'What is your return policy?'],
    products: [],
    contact,
  };
}

function unavailableReply(): ChatReply {
  return {
    reply:
      'I could not find a piece matching that. Try the product name, for example "oxidised jhumka" or ' +
      '"maang tikka", and I will check whether it is in stock.',
    intent: 'availability',
    suggestions: ['What sizes do you have?', 'How long does delivery take?', 'What is your return policy?'],
    products: [],
  };
}

function describeAvailability(products: ChatProduct[]): string {
  const lines = products.slice(0, 3).map((product) => {
    const price = currency(product.price, product.currency);

    if (!product.inStock) {
      return `${product.name} is currently sold out.`;
    }

    if (product.lowStock) {
      return `${product.name} is available at ${price} — only ${product.stock} left.`;
    }

    return `${product.name} is in stock at ${price}.`;
  });

  const more = products.length > lines.length ? ` I found ${products.length} matching pieces.` : '';

  return `${lines.join(' ')}${more}`;
}

/** Follow-ups that only make sense if a piece is already on the table. */
const PRONOUNS = ['it', 'that', 'this', 'those', 'them', 'they', 'one', 'piece', 'item'];

/**
 * Browsing questions: "what is your cheapest piece", "any under 500", "show me the best sellers".
 *
 * These were the largest remaining gap — a shopper arriving with no product in mind had no way in, and
 * every one of them fell through to the fallback. They are answered from the same live catalog the
 * availability answers use, so a recommendation can never point at something unbuyable.
 */
const BROWSE_PATTERNS: { pattern: RegExp; build: (budget?: number) => string }[] = [
  {
    // A stated budget has to be caught before the generic "cheapest/under" rules, or "under 500" is
    // answered as though the shopper had merely asked for something inexpensive.
    pattern: /\b(under|below|less than|within|max|maxim)\s*(?:rs\.?|₹|inr)?\s*(\d{2,7})\b/i,
    build: (budget) => 'budget',
  },
  {
    pattern: /\b(cheapest|least expensive|lowest price|budget|affordable)\b/i,
    build: () => 'cheapest',
  },
  {
    // The `s?` on each ending matters: shoppers write "best seller" and "best sellers" equally, and
    // the plural form did not match.
    pattern: /\bbest ?sell(er|ers|ing)?|most popular|top ?sell(er|ers|ing)?\b|\bfavou?rite\b/i,
    build: () => 'bestseller',
  },
  {
    pattern: /\b(new arrivals?|latest|just in|newest|recently added)\b/i,
    build: () => 'new',
  },
  {
    pattern: /\b(top rated|highest rated|best reviewed|highest rated|most reviewed)\b/i,
    build: () => 'rated',
  },
];

/**
 * Damage, warranty and stock-replenishment questions.
 *
 * Grouped as one intent on purpose. A broken or faulty piece is the question a customer most needs a
 * human for, so the answer hands off to support rather than paraphrasing the returns window.
 */
const FAULT_PATTERNS = [
  /\bbroke|broken|damage|damaged|crack|tear|snapped|stopped working|faulty|defect/i,
  /\bwarranty|guarantee\b/i,
  /\bnot working|doesn'?t work|not working properly/i,
  /\breturn it because|exchange because/i,
];

/** Questions about a specific piece rather than the store. */
const PRICE_QUESTIONS = [
  /\bhow much\b/i,
  /\bwhat (price|cost)\b/i,
  /\bprice of\b/i,
  /\bcost of\b/i,
  /\bhow expensive\b/i,
  /\b(is|whats) the price\b/i,
];

/**
 * Runs a browsing question against the catalog.
 *
 * Every result is filtered to what can actually be bought — a recommendation that lists a sold-out
 * piece wastes the shopper's time and makes the assistant look careless — and ordering is pushed into
 * MongoDB rather than done here, so only the handful being shown crosses the wire.
 *
 * Returns `undefined` for an unrecognised browse request so the caller can fall through.
 */
async function runBrowse(message: string): Promise<ChatReply | undefined> {
  const rule = BROWSE_PATTERNS.find((entry) => entry.pattern.test(message));

  if (!rule) {
    return undefined;
  }

  const kind = rule.build();

  // A stated budget is captured from the match, not from a second parse of the message.
  const budgetMatch = message.match(/\b(under|below|less than|within|max|maxim)\s*(?:rs\.?|₹|inr)?\s*(\d{2,7})\b/i);
  const budget = budgetMatch ? Number(budgetMatch[2]) : undefined;

  const query: Record<string, unknown> = { isActive: true };
  let sort: Record<string, 1 | -1> = { ratingsAverage: -1 };

  if (kind === 'budget' && typeof budget === 'number') {
    query['price'] = { $lte: budget };
    sort = { price: 1 };
  } else if (kind === 'cheapest') {
    sort = { price: 1 };
  } else if (kind === 'bestseller') {
    query['isBestSeller'] = true;
    sort = { soldCount: -1 };
  } else if (kind === 'new') {
    sort = { createdAt: -1 };
  }

  const docs = await Product.find(query)
    .select('name slug price currency stock lowStockThreshold images variants')
    .sort(sort)
    .limit(12)
    .lean<
      {
        name: string;
        slug: string;
        price: number;
        currency: string;
        stock: number;
        lowStockThreshold?: number;
        images?: { url?: string; isPrimary?: boolean }[];
        variants?: { isActive: boolean; stock: number }[];
      }[]
    >();

  const buyable = docs
    .map((product) => {
      const { inStock, stock } = productAvailability(product);

      return {
        slug: product.slug,
        name: product.name,
        image: product.images?.find((entry) => entry.isPrimary)?.url ?? product.images?.[0]?.url,
        price: product.price,
        currency: product.currency,
        inStock,
        stock,
        lowStock: inStock && stock <= (product.lowStockThreshold ?? 5),
      };
    })
    .filter((product) => product.inStock)
    .slice(0, 3);

  if (buyable.length === 0) {
    return {
      reply:
        kind === 'budget' && typeof budget === 'number'
          ? `Nothing is currently in stock under ${currency(budget, 'INR')}. The shop page will show you everything we have.`
          : 'Nothing matches that right now. Try the shop page to see everything we have in stock.',
      intent: 'discovery',
      suggestions: ['What is your return policy?', 'How long does delivery take?', 'How do I clean it?'],
      products: [],
    };
  }

  const intro: Record<string, string> = {
    cheapest: 'Our least expensive pieces right now:',
    bestseller: 'The pieces selling best right now:',
    new: 'The newest arrivals:',
    rated: 'Our best reviewed pieces:',
    budget: `Pieces under ${currency(budget ?? 0, buyable[0].currency)}:`,
  };

  return {
    reply: `${intro[kind] ?? 'A few pieces you might like:'} ${buyable
      .map((product) => `${product.name} at ${currency(product.price, product.currency)}`)
      .join(', ')}.`,
    intent: 'discovery',
    suggestions: ['Do you have it in stock?', 'What sizes do you have?', 'How long does delivery take?'],
    products: buyable,
  };
}

/**
 * Recovers the product a follow-up is pointing at.
 *
 * Without this the assistant could not answer "and the earrings?" or "how much is it" — it read each
 * message in isolation, so every pronoun resolved to nothing and the shopper had to retype the whole
 * product name.
 *
 * Both sides of the conversation are scanned. The shopper's own turn is preferred because it is what
 * they actually asked, but an assistant turn naming a piece also counts: it is the only record of the
 * subject when the shopper's follow-up is a bare pronoun ("how much is it?"). Scanning assistant text
 * is safe because the recovered string is only ever used as *search input* — the price and stock that
 * come back are read from the catalog, never from the transcript.
 */
function recentProductHint(history: ChatHistoryEntry[]): string | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];

    if (entry.role !== 'user') {
      continue;
    }

    const hint = searchTerms(entry.content);

    if (hint.length > 0) {
      return hint;
    }
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];

    if (entry.role !== 'assistant') {
      continue;
    }

    // Assistant replies quote product names but wrap them in status wording and prices. Both are
    // stripped so only the name survives as search input — the figures are re-read from the catalog,
    // never carried over, so a transcript cannot assert a price the store does not agree with.
    const hint = searchTerms(
      entry.content
        .replace(/is in stock.*$/i, '')
        .replace(/is currently sold out.*$/i, '')
        .replace(/is available.*$/i, '')
        .replace(/[₹$€£]\s?[\d,]+/g, ''),
    );

    if (hint.length > 0) {
      return hint;
    }
  }

  return undefined;
}

/**
 * Pulls the category word out of a bare follow-up.
 *
 * "And the earrings?" contains no product *name*, only the noun the shopper used. Stop and policy
 * words are stripped, so what survives is treated as the thing being asked about.
 */
function resolveReferentTerms(message: string, history: ChatHistoryEntry[]): string[] {
  const terms = searchTerms(message).split(' ').filter((word) => word.length > 1);

  if (terms.length > 0) {
    return terms;
  }

  // Nothing but pronouns and filler: fall back to whatever product the shopper last named.
  const hint = recentProductHint(history);

  return hint ? hint.split(' ').filter((word) => word.length > 1) : [];
}

/** True when the message is a follow-up that only makes sense about a previously discussed piece. */
function isReferential(message: string): boolean {
  const words = message.split(' ');

  if (!words.some((word) => PRONOUNS.includes(word))) {
    return false;
  }

  // A pronoun alongside a fresh product name is not referential — the new name should win.
  return words.length <= 6;
}

/**
 * Answers "how much is it?" about the piece already being discussed.
 *
 * Kept separate from availability because the answer is different in kind: the shopper is not asking
 * whether they can buy it, they are asking what it costs, and repeating the stock line at them reads
 * like the assistant did not understand the question.
 */
function priceOfReply(products: ChatProduct[]): ChatReply {
  const named = products.slice(0, 2).map((product) => {
    const price = currency(product.price, product.currency);

    return product.inStock
      ? `${product.name} is ${price}.`
      : `${product.name} is ${price}, but it is currently sold out.`;
  });

  const more = products.length > 2 ? ` I found ${products.length} pieces matching.` : '';

  return {
    reply: `${named.join(' ')}${more} Tell me the piece you mean and I will check its stock.`,
    intent: 'price',
    suggestions: ['Is it in stock?', 'What sizes do you have?', 'How long does delivery take?'],
    products: products.slice(0, 3),
  };
}

/**
 * Answers a damage or warranty question by handing off.
 *
 * Deliberately does not try to resolve it. A damaged or faulty piece is the one question where a
 * scripted answer is the wrong answer — quoting the returns window at someone whose parcel arrived
 * broken reads as indifference — so this routes to a human and says so plainly.
 */
function faultReply(contact?: ChatContact): ChatReply {
  const reach = contact?.email ? ` Email ${contact.email} with a photo and we will sort it out.` : '';

  return {
    reply:
      'I am sorry about that — a damaged or faulty piece is something our team should handle directly.' +
      `${reach} It will not cost you anything to raise.`,
    intent: 'fault',
    suggestions: ['What is your return policy?', 'How long does delivery take?', 'How do I clean it?'],
    products: [],
    contact,
  };
}

/**
 * True when the message asks the knowledge question outright rather than mentioning a product.
 *
 * Only the intents whose subject a shopper can ask about without naming a piece qualify. Care and
 * materials are excluded on purpose: "is the oxidised haar water safe" is really asking whether that
 * specific piece is water safe, and the catalog has the answer.
 */
const EXPLICIT_QUESTION_PATTERNS: Record<string, RegExp> = {
  // "what size"/"size chart" is sizing whatever else the message contains. A shopper asking "what size is
  // a ring" wants to know how sizing works, not to be shown whichever ring happens to match the word.
  sizing: /^\s*(what|which)\s+(size|sizes|sizing)\b|\bsize chart\b|\bwhat weight\b|\bhow (heavy|light)\b|\bhow (long|tall|wide)\b/i,
  shipping: /\bhow long (does|do|will|is) (delivery|shipping|delivery take)|\bhow many days\b|\bwhen (will|does) .*(arrive|come|ship|delivery)/i,
  returns: /\b(return|refund|exchange)\b.*\b(policy|window|policy)?\b|\bhow long.*return/i,
  payment: /\b(payment|pay)\b.*\b(method|option|accept)|\bdo you (accept|take)\b/i,
};

/**
 * True when the shopper asked this intent's question outright.
 *
 * The leading `what size` in the sizing pattern is deliberate. It matches at the *start* of the
 * message, so a bare "what size is a ring" is answered with sizing guidance even though "ring" also
 * matches a real product — while "what size is the oxidised adjustable ring" still reaches the catalog,
 * because the question is no longer at the start of the message.
 */
function entryIsExplicitQuestion(message: string, intent: string): boolean {
  const pattern = EXPLICIT_QUESTION_PATTERNS[intent];

  return pattern ? pattern.test(message) : false;
}

/**
 * Returns the best product match only when the shopper named it *specifically*.
 *
 * Distinct from `findProducts`, which answers "do you have a ring" happily with a listing. Here the
 * question is narrower: was a particular piece identified, or did the shopper only use a word that
 * happens to appear in some product name?
 *
 * The discriminator is *distinctiveness*, not length or raw coverage. "haar" is one word out of three
 * in "Long Oxidised Haar" — only a third of the name — yet it names that piece unambiguously. "ring" in
 * "Oxidised Adjustable Ring" is the same third, and names nothing, because rings are a category and
 * there are several. What separates them is whether the word appears in most product names or in one:
 * every piece here is "oxidised", so that word carries no information, while "haar" appears once.
 *
 * So a match counts as naming a piece when the shopper supplied at least one distinctive word that
 * belongs to that product, and that word is most of what they said.
 */
async function findMostSpecific(message: string): Promise<ChatProduct | undefined> {
  const terms = searchTerms(message)
    .split(' ')
    .filter((word) => word.length > 1);

  if (terms.length === 0) {
    return undefined;
  }

  const candidates = await Product.find({ isActive: true })
    .select('name slug price currency stock lowStockThreshold images variants')
    .limit(200)
    .lean<
      {
        name: string;
        slug: string;
        price: number;
        currency: string;
        stock: number;
        lowStockThreshold?: number;
        images?: { url?: string; isPrimary?: boolean }[];
        variants?: { isActive: boolean; stock: number }[];
      }[]
    >();

  const stemmedTerms = terms.map(stem);
  const names = candidates.map((candidate) =>
    normalize(candidate.name)
      .split(' ')
      .filter((word) => word.length > 2)
      .map(stem),
  );

  // How many products contain each term. A term in every name is boilerplate ("oxidised") and cannot
  // identify anything; a term in one or two can.
  const documentFrequency = new Map<string, number>();

  for (const term of stemmedTerms) {
    documentFrequency.set(term, names.filter((words) => words.some((word) => word.includes(term))).length);
  }

  // The most distinctive thing the shopper said: rarest term wins ties, so "haar" beats "oxidised".
  const rarest = Math.min(...documentFrequency.values());

  // Nothing they said narrows the catalogue down.
  if (rarest >= names.length * 0.5 && names.length > 2) {
    return undefined;
  }

  const bestIndex = names.reduce((best, words, index) => {
    const hit = stemmedTerms.some((term) =>
      words.some((word) => word.includes(term) || term.includes(word)),
    );

    if (!hit) {
      return best;
    }

    return best === -1 ? index : best;
  }, -1);

  if (bestIndex === -1) {
    return undefined;
  }

  const product = candidates[bestIndex];

  if (!product) {
    return undefined;
  }

  const { inStock, stock } = productAvailability(product);

  return {
    slug: product.slug,
    name: product.name,
    image: product.images?.find((entry) => entry.isPrimary)?.url ?? product.images?.[0]?.url,
    price: product.price,
    currency: product.currency,
    inStock,
    stock,
    lowStock: inStock && stock <= (product.lowStockThreshold ?? 5),
  };
}

/**
 * Answers one message. Exported for the endpoint and exercised directly by the tests.
 *
 * The catalog and settings are read once per call, so a reply always reflects the state at the time
 * it was asked rather than something cached at boot.
 *
 * `history` is used for exactly one thing: working out which product a follow-up refers to. It never
 * decides the answer itself, so a shopper cannot talk the assistant into a wrong price by replaying a
 * fabricated transcript — the figures always come from a live lookup.
 */
export async function replyToChat(input: ChatInput): Promise<ChatReply> {
  const raw = input.message.trim();

  if (raw.length === 0) {
    return fallbackReply();
  }

  // Refused before any intent runs, so an injection attempt cannot reach the catalog query.
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(raw))) {
    return {
      reply:
        'I can only answer questions about the jewellery — stock, care, materials, sizing, shipping ' +
        'and returns. Ask me one of those and I will help.',
      intent: 'refusal',
      suggestions: ['Do you have it in stock?', 'How do I clean it?', 'What is your return policy?'],
      products: [],
    };
  }

  const settings = await getSettings();
  const contact: ChatContact = { email: settings.supportEmail, whatsapp: settings.whatsappNumber };
  const message = normalize(raw);
  const history = input.history ?? [];

  if (message.length === 0) {
    return fallbackReply(contact);
  }

  const greeting = /^(hi|hey|hello|hola|namaste|good (morning|evening|afternoon))\b/.test(message);

  if (greeting && message.split(' ').length <= 3) {
    return greetingReply();
  }

  if (/\b(thanks|thank you|thx|cheers|shukriya)\b/.test(message)) {
    return thanksReply();
  }

  const referential = isReferential(message);
  const asksAvailability =
    matchesAny(message, AVAILABILITY_WORDS.map((word) => new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}`))) ||
    matchesAny(message, AVAILABILITY_PHRASES);

  // Faults first: a damaged piece is never a browsing or catalog question, and the two catalogues of
  // intent below would otherwise try to interpret "my parcel arrived broken" as a product search.
  if (matchesAny(message, FAULT_PATTERNS)) {
    return faultReply(contact);
  }

  // Browsing next, and before the knowledge entries on purpose. "cheapest", "best sellers" and
  // "new arrivals" all contain words the care entry matches ("silver", "polish"), and answering those
  // with tarnishing advice is worse than not answering at all.
  const browsed = await runBrowse(message);

  if (browsed) {
    return browsed;
  }

  // Whether the message names something that resolves to a product is decided by *looking*, not by
  // counting words. A pronoun alone ("how do I clean it") must not be read as naming a product, and
  // the word "oxidised" in a product name must not be read as a care question. So a knowledge entry is
  // only bypassed once a catalog lookup has actually returned something.
  //
  // An explicit knowledge question — "what size is a ring", "how long is delivery" — is answered
  // outright. It mentions a product word, but the shopper is not asking about stock, so answering with
  // in-stock lines would be about a ring and still useless. Availability, price and browsing are
  // excluded because those genuinely are product questions even when worded like knowledge questions.
  const knowledgeMatch = KNOWLEDGE.find((entry) => matchesAny(message, entry.patterns));
  const candidateTermsForLookup = searchTerms(raw).split(' ').filter((word) => word.length > 1);

  // An explicit knowledge question — "what size is a ring", "how long is delivery" — is answered
  // outright. Availability, price and browsing are excluded because those genuinely are product
  // questions even when worded like knowledge questions.
  const isProductQuestion = asksAvailability || matchesAny(message, PRICE_QUESTIONS) ||
    BROWSE_PATTERNS.some((entry) => entry.pattern.test(message));

  // ...unless the message names a *specific* piece. "how long does delivery take for the maang tikka"
  // is about that piece, so the catalog has to answer. Incidental matches do not count: "ring" matches
  // "Oxidised Adjustable Ring", and letting that veto the answer turned "what size is a ring" into a
  // stock listing. Specificity is the fraction of the product's own name the shopper actually said —
  // "the maang tikka" covers "Oxidised Maang Tikka with Pearl" far better than "ring" covers
  // "Oxidised Adjustable Ring".
  const specific = candidateTermsForLookup.length > 0 ? await findMostSpecific(raw) : undefined;

  const explicitlyAsksKnowledge =
    knowledgeMatch !== undefined &&
    entryIsExplicitQuestion(message, knowledgeMatch.intent) &&
    !isProductQuestion &&
    specific === undefined;

  if (knowledgeMatch && explicitlyAsksKnowledge) {
    const body = knowledgeMatch.build(settings);

    if (body) {
      return {
        reply: body,
        intent: knowledgeMatch.intent,
        suggestions: knowledgeMatch.suggestions,
        products: [],
      };
    }
  }

  const candidateTerms = searchTerms(raw).split(' ').filter((word) => word.length > 1);
  const historyTerms = referential ? resolveReferentTerms(raw, history) : [];
  const referent = candidateTerms.length > 0 ? candidateTerms : historyTerms;
  const looksLikeProduct = candidateTerms.length > 0 || referential;

  if (knowledgeMatch) {
    const products =
      looksLikeProduct && referent.length > 0 ? await findProducts(referent.join(' '), 3) : [];

    // No matching product, so the knowledge entry is the right answer after all.
    if (products.length === 0) {
      const body = knowledgeMatch.build(settings);

      if (body) {
        return {
          reply: body,
          intent: knowledgeMatch.intent,
          suggestions: knowledgeMatch.suggestions,
          products: [],
        };
      }
    } else {
      return {
        reply: describeAvailability(products),
        intent: 'availability',
        suggestions: ['What sizes do you have?', 'How long does delivery take?', 'How do I clean it?'],
        products,
      };
    }
  }

  // A price question with nothing new in it ("how much is it?") is about the piece already on the
  // table. A price question naming a piece ("how much is the haar?") is answered by the catalog branch
  // below, which already reports prices.
  if (matchesAny(message, PRICE_QUESTIONS) && referent.length > 0 && candidateTerms.length === 0) {
    const products = await findProducts(referent.join(' '), 3);

    if (products.length > 0) {
      return priceOfReply(products);
    }
  }

  // Availability is answered before the knowledge entries, but only when the message actually names
  // something or refers back to a piece. Without that guard "is cash on delivery available" and "is
  // free delivery available" were treated as stock questions and answered from the catalogue.
  if (asksAvailability) {
    const own = searchTerms(raw).split(' ').filter((word) => word.length > 1);
    const terms = own.length > 0 ? own : referential ? resolveReferentTerms(raw, history) : [];

    if (terms.length > 0) {
      const products = await findProducts(terms.join(' '), 3);

      if (products.length === 0) {
        return unavailableReply();
      }

      return {
        reply: describeAvailability(products),
        intent: 'availability',
        suggestions: ['What sizes do you have?', 'How long does delivery take?', 'How do I clean it?'],
        products,
      };
    }
  }

  // A bare product noun, with no question wording at all ("jhumka"), is still a request to see that
  // piece. Without this the shopper had to add "is it in stock" to get anything back.
  //
  // Trailing punctuation does not disqualify it: "what about the adjustable ring?" is a product
  // question too, and rejecting anything ending in a question mark threw away the whole family of
  // "what about X?" follow-ups. Only a genuinely long clause is treated as not-a-product-query.
  if (searchTerms(raw).length > 0 && !asksAvailability) {
    const bare = searchTerms(raw).split(' ').filter((word) => word.length > 2);
    const looksLikeProduct = bare.length <= 4;

    if (looksLikeProduct) {
      const products = await findProducts(raw, 3);

      if (products.length > 0) {
        return {
          reply: describeAvailability(products),
          intent: 'availability',
          suggestions: ['What sizes do you have?', 'How long does delivery take?', 'How do I clean it?'],
          products,
        };
      }
    }
  }

  return fallbackReply(contact);
}