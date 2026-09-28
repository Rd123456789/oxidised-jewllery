import { Router } from 'express';
import { Category } from '../models/category.model.js';
import { Collection } from '../models/collection.model.js';
import { Page } from '../models/page.model.js';
import { Product } from '../models/product.model.js';
import { logger } from '../utils/logger.js';

const router = Router();

interface SitemapUrl {
  loc: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
  lastmod?: string;
}

const STATIC_URLS: Omit<SitemapUrl, 'loc'>[] = [
  { changefreq: 'daily', priority: '1.0' },
  { changefreq: 'daily', priority: '0.9' },
  { changefreq: 'weekly', priority: '0.8' },
  { changefreq: 'monthly', priority: '0.3' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toLastmod(value: Date | undefined): string | undefined {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().split('T')[0]
    : undefined;
}

async function buildUrls(base: string): Promise<SitemapUrl[]> {
  const [categories, collections, products, pages] = await Promise.all([
    Category.find({ isActive: true }).select('slug updatedAt').lean(),
    Collection.find({ isActive: true }).select('slug updatedAt').lean(),
    Product.find({ isActive: true }).select('slug updatedAt').sort({ createdAt: -1 }).lean(),
    Page.find({ isPublished: true }).select('slug updatedAt').lean(),
  ]);

  const staticEntries: SitemapUrl[] = [
    { loc: `${base}/`, ...STATIC_URLS[0]! },
    { loc: `${base}/shop`, ...STATIC_URLS[1]! },
    { loc: `${base}/collections`, ...STATIC_URLS[2]! },
    { loc: `${base}/track-order`, ...STATIC_URLS[3]! },
  ];

  return [
    ...staticEntries,
    ...categories.map((category) => ({
      loc: `${base}/shop?category=${encodeURIComponent(category.slug)}`,
      changefreq: 'weekly' as const,
      priority: '0.7',
      lastmod: toLastmod(category.updatedAt),
    })),
    ...collections.map((collection) => ({
      loc: `${base}/collections/${encodeURIComponent(collection.slug)}`,
      changefreq: 'weekly' as const,
      priority: '0.7',
      lastmod: toLastmod(collection.updatedAt),
    })),
    ...products.map((product) => ({
      loc: `${base}/product/${encodeURIComponent(product.slug)}`,
      changefreq: 'weekly' as const,
      priority: '0.8',
      lastmod: toLastmod(product.updatedAt),
    })),
    ...pages.map((page) => ({
      loc: `${base}/pages/${encodeURIComponent(page.slug)}`,
      changefreq: 'monthly' as const,
      priority: '0.5',
      lastmod: toLastmod(page.updatedAt),
    })),
  ];
}

function renderSitemap(urls: SitemapUrl[]): string {
  const body = urls
    .map((url) =>
      [
        '  <url>',
        `    <loc>${escapeXml(url.loc)}</loc>`,
        url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>` : null,
        `    <changefreq>${url.changefreq}</changefreq>`,
        `    <priority>${url.priority}</priority>`,
        '  </url>',
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Served at the site root (not under the API prefix) so crawlers find it at `/sitemap.xml`.
 * A database hiccup degrades to the static entries rather than a 500.
 */
router.get('/sitemap.xml', async (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;

  let urls: SitemapUrl[];

  try {
    urls = await buildUrls(base);
  } catch (error) {
    logger.warn(`Sitemap generation fell back to static entries: ${(error as Error).message}`);
    urls = [{ loc: `${base}/`, ...STATIC_URLS[0]! }, { loc: `${base}/shop`, ...STATIC_URLS[1]! }];
  }

  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/xml').send(renderSitemap(urls));
});

export default router;
