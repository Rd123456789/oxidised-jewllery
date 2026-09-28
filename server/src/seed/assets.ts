import fs from 'node:fs';
import path from 'node:path';
import { cloudinaryEnabled, uploadImageBuffer } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { loadCatalog } from './catalog.js';
import { setPublishedUrl } from './published-assets.js';

const CATALOG_DIR = path.resolve(process.cwd(), 'uploads', 'catalog');

/**
 * Free hosts give the API an ephemeral filesystem, so a seed that only writes
 * `/uploads/...` produces a store whose images vanish on the next restart. When Cloudinary
 * is configured every seed asset is uploaded first and the stored URLs point there.
 *
 * Uploads are deterministic (`<folder>/seed/<name>`, overwrite + invalidate) so re-seeding
 * refreshes the same asset instead of piling up orphans.
 */
function seedPublicId(fileName: string): string {
  return `${env.CLOUDINARY_FOLDER}/seed/${fileName.replace(/\.[^.]+$/, '')}`;
}

let catalogPublishAttempted = false;

export async function publishCatalogAssets(): Promise<void> {
  if (!cloudinaryEnabled || catalogPublishAttempted) {
    return;
  }

  catalogPublishAttempted = true;

  const catalog = loadCatalog();

  if (!catalog) {
    return;
  }

  const fileNames = new Set<string>([
    ...Object.keys(catalog.product),
    ...catalog.category,
    ...catalog.collection,
    ...catalog.banner,
  ]);

  const staged: { fileName: string; url: string }[] = [];

  for (const fileName of fileNames) {
    const filePath = path.join(CATALOG_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const asset = await uploadImageBuffer(fs.readFileSync(filePath), undefined, {
        publicId: seedPublicId(fileName),
      });

      staged.push({ fileName, url: asset.secureUrl });
    } catch (error) {
      // All-or-nothing: a half-published catalogue would leave some products pointing at
      // Cloudinary and others at files that do not exist on the host.
      logger.warn(
        `Cloudinary publish failed for ${fileName} (${(error as Error).message}); ` +
          'seeding will keep every asset on local disk.',
      );

      return;
    }
  }

  for (const entry of staged) {
    setPublishedUrl(entry.fileName, entry.url);
  }

  logger.info(`Published ${staged.length} catalogue image(s) to Cloudinary`);
}

/** Publishes one generated SVG placeholder, returning the Cloudinary URL when available. */
export async function publishSvgAsset(
  fileName: string,
  svg: string,
): Promise<string | undefined> {
  if (!cloudinaryEnabled) {
    return undefined;
  }

  try {
    const asset = await uploadImageBuffer(Buffer.from(svg, 'utf8'), undefined, {
      publicId: seedPublicId(fileName),
    });

    setPublishedUrl(fileName, asset.secureUrl);

    return asset.secureUrl;
  } catch (error) {
    logger.warn(
      `Cloudinary publish failed for ${fileName} (${(error as Error).message}); ` +
        'run `npm run catalog:images` for photographic placeholders instead.',
    );

    return undefined;
  }
}
