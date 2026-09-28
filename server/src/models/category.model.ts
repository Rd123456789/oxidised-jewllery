import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';
import { schemaOptions, seoFields } from './common.js';

export interface CategoryDocument {
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  image?: { url: string; publicId?: string; alt?: string };
  icon?: string;
  parent: Types.ObjectId | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  productCount: number;
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryHydratedDocument = HydratedDocument<CategoryDocument>;

const categorySchema = new Schema<CategoryDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, maxlength: 2000 },
    shortDescription: { type: String, trim: true, maxlength: 300 },
    image: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      alt: { type: String, trim: true, maxlength: 160 },
    },
    icon: { type: String, trim: true, maxlength: 60 },
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    productCount: { type: Number, default: 0, min: 0 },
    ...seoFields,
  },
  schemaOptions,
);

categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ name: 'text', description: 'text' });

export const Category = model<CategoryDocument>('Category', categorySchema);

export function toCategorySummary(category: CategoryDocument & { _id: unknown }) {
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    shortDescription: category.shortDescription,
    image: category.image,
    icon: category.icon,
    productCount: category.productCount,
  };
}
