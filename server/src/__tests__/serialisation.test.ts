import { describe, expect, it } from 'vitest';
import { Cart } from '../models/cart.model.js';
import { User } from '../models/user.model.js';

/**
 * Every subdocument declared with `{ _id: true }` must serialise its id as `id`.
 * When one does not, the API leaks `_id`, clients read `undefined` and send it back
 * in a URL - which surfaced as "Invalid identifier" when removing a cart item.
 */
interface SerialisedSubdocument {
  id?: string;
  _id?: unknown;
}

interface SerialisedParent {
  id?: string;
  _id?: unknown;
  items?: SerialisedSubdocument[];
  addresses?: SerialisedSubdocument[];
}

describe('serialisation shape', () => {
  it('exposes cart item ids as `id`, never `_id`', () => {
    const cart = new Cart({
      sessionId: 'test-session',
      items: [
        {
          product: '6aa65d86c608d16d386a14c1',
          name: 'Oxidised test piece',
          slug: 'oxidised-test-piece',
          unitPrice: 749,
          quantity: 2,
          lineTotal: 1498,
        },
      ],
    });

    const json = cart.toJSON() as unknown as SerialisedParent;
    const item = json.items?.[0];

    expect(item).toBeDefined();
    // `id` is an ObjectId instance here and becomes a 24-char hex string once
    // Express serialises the response with JSON.stringify.
    expect(String(item?.id)).toMatch(/^[0-9a-f]{24}$/);
    expect(item?._id).toBeUndefined();
    expect(json.id).toBeDefined();
    expect(json._id).toBeUndefined();
  });

  it('exposes address ids as `id`, never `_id`', () => {
    const user = new User({
      name: 'Test Shopper',
      email: 'serialisation@example.com',
      passwordHash: 'not-a-real-hash',
      addresses: [
        {
          fullName: 'Test Shopper',
          phone: '98******90',
          line1: '1 Test Lane',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pincode: '302003',
        },
      ],
    });

    const json = user.toJSON() as unknown as SerialisedParent;
    const address = json.addresses?.[0];

    expect(address?.id).toBeDefined();
    expect(address?._id).toBeUndefined();
  });

  it('does not leak `__v` on serialised documents', () => {
    const cart = new Cart({ sessionId: 'test-session', items: [] });
    const json = cart.toJSON() as unknown as Record<string, unknown>;

    expect(json['__v']).toBeUndefined();
  });
});
