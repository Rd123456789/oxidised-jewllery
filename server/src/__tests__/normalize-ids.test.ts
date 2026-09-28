import { describe, expect, it } from 'vitest';
import { normalizeDocumentIds } from '../utils/http.js';

/**
 * `.lean()` queries bypass the schema `toJSON` transform, so lean documents reached
 * clients with `_id` while every consumer reads `id`. That made the admin UI send
 * `undefined` in delete URLs ("Invalid identifier"). The response layer now rewrites
 * ids, which is what these tests pin down.
 */
describe('normalizeDocumentIds', () => {
  it('renames _id to id and drops __v on a lean document', () => {
    const lean = { _id: '6aa65d86c608d16d386a14c1', title: 'Hero banner', __v: 0 };

    const result = normalizeDocumentIds(lean) as unknown as Record<string, unknown>;

    expect(result['id']).toBe('6aa65d86c608d16d386a14c1');
    expect(result['_id']).toBeUndefined();
    expect(result['__v']).toBeUndefined();
    expect(result['title']).toBe('Hero banner');
  });

  it('walks arrays', () => {
    const result = normalizeDocumentIds([{ _id: 'a' }, { _id: 'b' }]) as unknown as {
      id?: string;
    }[];

    expect(result.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('walks nested subdocuments, not just the top level', () => {
    const result = normalizeDocumentIds({
      _id: 'user-1',
      addresses: [{ _id: 'addr-1', city: 'Jaipur' }],
    }) as unknown as {
      id?: string;
      addresses: { id?: string; _id?: unknown; city: string }[];
    };

    expect(result.id).toBe('user-1');
    expect(result.addresses[0]?.id).toBe('addr-1');
    expect(result.addresses[0]?._id).toBeUndefined();
    expect(result.addresses[0]?.city).toBe('Jaipur');
  });

  it('leaves objects that already expose id untouched', () => {
    expect(normalizeDocumentIds({ id: 'keep', name: 'x' })).toEqual({ id: 'keep', name: 'x' });
  });

  it('stringifies ObjectId-like values', () => {
    const objectIdLike = { toString: () => 'abcdefabcdefabcdefabcdef' };

    const result = normalizeDocumentIds({ _id: objectIdLike }) as unknown as { id?: string };

    expect(result.id).toBe('abcdefabcdefabcdefabcdef');
  });

  it('does not touch Dates or other class instances', () => {
    const when = new Date();

    const result = normalizeDocumentIds({ when }) as unknown as { when: Date };

    expect(result.when).toBe(when);
  });

  it('passes primitives through unchanged', () => {
    expect(normalizeDocumentIds(null)).toBeNull();
    expect(normalizeDocumentIds(42)).toBe(42);
    expect(normalizeDocumentIds('value')).toBe('value');
    expect(normalizeDocumentIds(true)).toBe(true);
  });
});
