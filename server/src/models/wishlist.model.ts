import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

export interface WishlistItem {
  product: Types.ObjectId;
  addedAt: Date;
}

export interface WishlistDocument {
  user: Types.ObjectId;
  products: WishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

export type WishlistHydratedDocument = HydratedDocument<WishlistDocument>;

const wishlistItemSchema = new Schema<WishlistItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    addedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const wishlistSchema = new Schema<WishlistDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    products: { type: [wishlistItemSchema], default: [] },
  },
  schemaOptions,
);

export const Wishlist = model<WishlistDocument>('Wishlist', wishlistSchema);
