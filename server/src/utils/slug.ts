import slugify from 'slugify';

interface ExistenceChecker {
  exists(filter: Record<string, unknown>): Promise<unknown>;
}

export function toSlug(input: string): string {
  return slugify(input, { lower: true, strict: true, trim: true });
}

export async function ensureUniqueSlug(
  model: ExistenceChecker,
  source: string,
  excludeId?: string,
): Promise<string> {
  const base = toSlug(source) || `item-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const filter: Record<string, unknown> = { slug: candidate };

    if (excludeId) {
      filter['_id'] = { $ne: excludeId };
    }

    const taken = await model.exists(filter);

    if (!taken) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export function generateSku(prefix: string, seed: string): string {
  const compact = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6).padEnd(6, 'X');
  const random = Math.floor(Math.random() * 9000 + 1000);

  return `${prefix.toUpperCase()}-${compact}-${random}`;
}
