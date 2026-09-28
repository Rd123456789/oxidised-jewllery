import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions, seoFields } from './common.js';

export interface CollectionDocument {
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  heroImage?: { url: string; publicId?: string; alt?: string };
  thumbnail?: { url: string; publicId?: string; alt?: string };
  themeColor?: string;
  products: Types.ObjectId[];
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  startsAt?: Date;
  endsAt?: Date;
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type CollectionHydratedDocument = HydratedDocument<CollectionDocument>;

const collectionSchema = new Schema<CollectionDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tagline: { type: String, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 3000 },
    heroImage: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      alt: { type: String, trim: true, maxlength: 160 },
    },
    thumbnail: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      alt: { type: String, trim: true, maxlength: 160 },
    },
    themeColor: { type: String, trim: true, default: '#8a5a2b' },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product', index: true }],
    isFeatured: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
    ...seoFields,
  },
  schemaOptions,
);

collectionSchema.index({ isActive: 1, sortOrder: 1 });

export const Collection = model<CollectionDocument>('Collection', collectionSchema);
