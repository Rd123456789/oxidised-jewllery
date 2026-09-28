import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

export type CouponType = 'percentage' | 'fixed' | 'free_shipping';

export interface CouponDocument {
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  startsAt?: Date;
  expiresAt?: Date;
  applicableCategories: Types.ObjectId[];
  applicableProducts: Types.ObjectId[];
  firstOrderOnly: boolean;
  isActive: boolean;
  isExpired?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CouponHydratedDocument = HydratedDocument<CouponDocument>;

const couponSchema = new Schema<CouponDocument>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 240 },
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'free_shipping'] satisfies CouponType[],
      required: true,
    },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    applicableCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    firstOrderOnly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  schemaOptions,
);

couponSchema.index({ isActive: 1, expiresAt: 1 });

couponSchema.virtual('isExpired').get(function isExpired(this: CouponDocument): boolean {
  if (!this.expiresAt) {
    return false;
  }

  return this.expiresAt.getTime() < Date.now();
});

export const Coupon = model<CouponDocument>('Coupon', couponSchema);
