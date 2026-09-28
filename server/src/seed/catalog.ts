import fs from 'node:fs';
import path from 'node:path';
import { publishedUrl } from './published-assets.js';

/**
 * Optional photographic catalogue produced by `tools/prepare-catalog-images.ps1`.
 *
 * The photos are used exactly as supplied — cropped, resized and re-encoded, with no
 * colour changes. When the manifest is missing the seed falls back to generating its
 * own SVG placeholders, so a fresh clone still boots with a complete store.
 */
export interface CatalogManifest {
  generatedAt: string;
  /** Cache-busting token from the generator; appended to every asset URL. */
  version?: string;
  recoloured: boolean;
  note: string;
  sources: Record<string, string>;
  /** Filename -> "WxH -> WxH" render note. Keys are `<sourceKey><crop>.jpg`. */
  product: Record<string, string>;
  category: string[];
  collection: string[];
  banner: string[];
}

const CATALOG_DIR = path.resolve(process.cwd(), 'uploads', 'catalog');
const PUBLIC_PREFIX = '/uploads/catalog';
const MANIFEST_PATH = path.join(CATALOG_DIR, 'manifest.json');

/**
 * Which source photo represents which category. Each product's gallery is three
 * crops of a single source, so the gallery shows one item from several angles
 * rather than three unrelated photographs. Sources without a true match for the
 * category (anklets, hair accessories) deliberately reuse the closest shots.
 */
const CATEGORY_SOURCES: Record<string, string[]> = {
  earrings: ['g', 'm', 'j'],
  necklaces: ['a', 'b', 'k', 'l', 'h', 'n'],
  'bangles-and-bracelets': ['i', 'c', 'j'],
  rings: ['e', 'j', 'd'],
  anklets: ['b', 'l', 'a'],
  'maang-tikka': ['j', 'h', 'm'],
  'hair-accessories': ['h', 'n', 'd'],
};

let cached: CatalogManifest | null | undefined;

export function loadCatalog(): CatalogManifest | null {
  if (cached !== undefined) {
    return cached;
  }

  try {
    if (!fs.existsSync(MANIFEST_PATH)) {
      cached = null;

      return cached;
    }

    // The generator runs under PowerShell on Windows, which can emit a UTF-8 BOM.
    // `JSON.parse` rejects a leading BOM, so strip it before parsing.
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw) as CatalogManifest;

    cached = Array.isArray(parsed.category) && parsed.category.length > 0 ? parsed : null;
  } catch {
    cached = null;
  }

  return cached;
}

export function catalogImageCount(): number {
  const catalog = loadCatalog();

  if (!catalog) {
    return 0;
  }

  return Object.keys(catalog.product).length;
}

/**
 * Prefers the Cloudinary URL published by `seed/assets.ts` (required on hosts with an
 * ephemeral disk), and otherwise falls back to the locally served file.
 *
 * The local path is what needs the cache-busting token: `/uploads` is served with a 7-day
 * max-age and catalogue filenames are stable, so a regenerated photo would stay hidden
 * behind the browser cache. Cloudinary URLs are invalidated at upload instead.
 */
function urlFor(fileName: string): string {
  const remote = publishedUrl(fileName);

  if (remote) {
    return remote;
  }

  const version = loadCatalog()?.version;

  return version
    ? `${PUBLIC_PREFIX}/${fileName}?v=${encodeURIComponent(version)}`
    : `${PUBLIC_PREFIX}/${fileName}`;
}

/**
 * Deliberate tile per category so the strip shows the right kind of piece instead of
 * cycling by index. There is no true anklet or hair-accessory shot in the source set,
 * so those two reuse the closest available photograph.
 */
const CATEGORY_TILES: Record<string, string> = {
  earrings: 'g',
  necklaces: 'a',
  'bangles-and-bracelets': 'i',
  rings: 'e',
  anklets: 'b',
  'maang-tikka': 'j',
  'hair-accessories': 'h',
};

export interface CatalogImage {
  url: string;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
}

/**
 * Three crops of one source photo for a product gallery.
 * `offset` rotates which crop is shown first so products sharing a source at least
 * open on a different frame.
 */
export function productGallery(
  categorySlug: string,
  productIndex: number,
  alt: string,
): CatalogImage[] | null {
  const catalog = loadCatalog();

  if (!catalog) {
    return null;
  }

  const candidates = (CATEGORY_SOURCES[categorySlug] ?? ['a', 'b', 'c']).filter((key) =>
    [1, 2, 3].every((crop) => `${key}${crop}.jpg` in catalog.product),
  );

  if (candidates.length === 0) {
    return null;
  }

  const sourceKey = candidates[productIndex % candidates.length] as string;
  const offset = productIndex % 3;

  return [1, 2, 3].map((_, position) => {
    const crop = ((offset + position) % 3) + 1;

    return {
      url: urlFor(`${sourceKey}${crop}.jpg`),
      alt: `${alt} — view ${position + 1}`,
      isPrimary: position === 0,
      sortOrder: position,
    };
  });
}

export function categoryImage(slug: string, index: number): string | null {
  const catalog = loadCatalog();

  if (!catalog || catalog.category.length === 0) {
    return null;
  }

  const preferred = CATEGORY_TILES[slug];
  if (preferred && catalog.category.includes(`cat-${preferred}.jpg`)) {
    return urlFor(`cat-${preferred}.jpg`);
  }

  return urlFor(catalog.category[index % catalog.category.length] as string);
}

export function collectionImage(index: number): string | null {
  const catalog = loadCatalog();

  if (!catalog || catalog.collection.length === 0) {
    return null;
  }

  return urlFor(catalog.collection[index % catalog.collection.length] as string);
}

export function bannerImage(index: number): string | null {
  const catalog = loadCatalog();

  if (!catalog || catalog.banner.length === 0) {
    return null;
  }

  return urlFor(catalog.banner[index % catalog.banner.length] as string);
}
