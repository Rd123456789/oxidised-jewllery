import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { clearDatabase, seedDatabase } from './data.js';
import { catalogImageCount } from './catalog.js';
import { publishCatalogAssets } from './assets.js';
import { cloudinaryEnabled } from '../config/cloudinary.js';

/**
 * `autoIndex` creates missing indexes but never drops stale ones, so an index
 * changed in a schema would silently linger. syncIndexes() reconciles the drift.
 */
async function syncIndexes(): Promise<void> {
  for (const name of mongoose.modelNames()) {
    await mongoose.model(name).syncIndexes();
  }
}

async function main(): Promise<void> {
  const shouldDestroy = process.argv.includes('--destroy');

  await connectDatabase();

  if (shouldDestroy) {
    logger.warn('Clearing all collections...');
    await clearDatabase();
    logger.info('Database cleared.');
  } else {
    const catalogCount = catalogImageCount();

    logger.info(
      catalogCount > 0
        ? `Seeding store data (using ${catalogCount} photo crops from uploads/catalog)...`
        : 'Seeding store data (no photo catalogue found - generating SVG placeholders)...',
    );

    if (cloudinaryEnabled) {
      logger.info('Cloudinary configured - publishing seed images before writing records...');
      await publishCatalogAssets();
    }

    const summary = await seedDatabase();

    logger.info('Seed complete:');
    logger.info(`  admin login     : ${env.SEED_ADMIN_EMAIL} / ${env.SEED_ADMIN_PASSWORD}`);
    logger.info(`  customer login  : ${env.SEED_CUSTOMER_EMAIL} / ${env.SEED_CUSTOMER_PASSWORD}`);
    logger.info(`  users           : ${summary.users}`);
    logger.info(`  categories      : ${summary.categories}`);
    logger.info(`  collections     : ${summary.collections}`);
    logger.info(`  products        : ${summary.products}`);
    logger.info(`  banners         : ${summary.banners}`);
    logger.info(`  pages           : ${summary.pages}`);
    logger.info(`  coupons         : ${summary.coupons}`);
    logger.info(`  reviews         : ${summary.reviews}`);
  }

  logger.info('Syncing indexes...');
  await syncIndexes();

  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error('Seed failed', error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
