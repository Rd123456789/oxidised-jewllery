import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions, subdocumentOptions } from './common.js';

export type CartStatus = 'active' | 'converted' | 'abandoned';

export interface CartItem {
  _id?: Types.ObjectId;
  product: Types.ObjectId;
  variantSku?: string;
  name: string;
  slug: string;
  image?: string;
  unitPrice: number;
  mrp?: number;
  quantity: number;
  lineTotal: number;
  addedAt: Date;
}

export interface CartDocument {
  user: Types.ObjectId | null;
  sessionId?: string;
  items: CartItem[];
  couponCode?: string;
  status: CartStatus;
  lastActivityAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  itemCount?: number;
  subtotal?: number;
}

export type CartHydratedDocument = HydratedDocument<CartDocument>;

const cartItemSchema = new Schema<CartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    image: { type: String, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 50 },
    lineTotal: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: () => new Date() },
  },
  subdocumentOptions,
);

const cartSchema = new Schema<CartDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId: { type: String, trim: true, index: true },
    items: { type: [cartItemSchema], default: [] },
    couponCode: { type: String, trim: true, uppercase: true },
    status: { type: String, enum: ['active', 'converted', 'abandoned'], default: 'active', index: true },
    lastActivityAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date },
  },
  schemaOptions,
);

cartSchema.index({ updatedAt: -1 });

cartSchema.virtual('itemCount').get(function itemCount(this: CartDocument): number {
  return (this.items ?? []).reduce((total, item) => total + item.quantity, 0);
});

cartSchema.virtual('subtotal').get(function subtotal(this: CartDocument): number {
  return (this.items ?? []).reduce((total, item) => total + item.lineTotal, 0);
});

export const Cart = model<CartDocument>('Cart', cartSchema);
