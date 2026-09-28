import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { Product } from './product.model.js';
import { schemaOptions } from './common.js';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewDocument {
  product: Types.ObjectId;
  user: Types.ObjectId;
  order?: Types.ObjectId;
  authorName: string;
  rating: number;
  title?: string;
  body?: string;
  images: string[];
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  adminReply?: {
    message: string;
    repliedAt: Date;
    repliedBy?: Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewHydratedDocument = HydratedDocument<ReviewDocument>;

const reviewSchema = new Schema<ReviewDocument>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    authorName: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 140 },
    body: { type: String, trim: true, maxlength: 3000 },
    images: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'] satisfies ReviewStatus[],
      default: 'pending',
      index: true,
    },
    isVerifiedPurchase: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0, min: 0 },
    adminReply: {
      message: { type: String, trim: true, maxlength: 1500 },
      repliedAt: { type: Date },
      repliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  schemaOptions,
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

export const Review = model<ReviewDocument>('Review', reviewSchema);

export async function recalculateProductRating(productId: Types.ObjectId | string): Promise<void> {
  const objectId = typeof productId === 'string' ? new Types.ObjectId(productId) : productId;

  const aggregated = await Review.aggregate<{ average: number; count: number }>([
    { $match: { product: objectId, status: 'approved' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const stats = aggregated[0];

  await Product.updateOne(
    { _id: objectId },
    {
      ratingsAverage: Number((stats?.average ?? 0).toFixed(1)),
      ratingsCount: stats?.count ?? 0,
    },
  );
}
