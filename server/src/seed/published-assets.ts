/**
 * Seed-time registry of assets that were pushed to Cloudinary, keyed by the local file
 * name the seed data already uses (`a1.jpg`, `<slug>-0.svg`).
 *
 * Kept in its own import-free module so `catalog.ts`, `placeholders.ts` and `assets.ts`
 * can share it without an import cycle.
 */
const urls = new Map<string, string>();

export function publishedUrl(fileName: string): string | undefined {
  return urls.get(fileName);
}

export function setPublishedUrl(fileName: string, url: string): void {
  urls.set(fileName, url);
}

export function clearPublishedUrls(): void {
  urls.clear();
}

export function publishedCount(): number {
  return urls.size;
}
