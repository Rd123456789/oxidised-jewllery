import { Schema, model, type HydratedDocument } from 'mongoose';
import { schemaOptions, seoFields } from './common.js';

export interface PageDocument {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  isPublished: boolean;
  showInFooter: boolean;
  showInHeader: boolean;
  sortOrder: number;
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type PageHydratedDocument = HydratedDocument<PageDocument>;

const pageSchema = new Schema<PageDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    excerpt: { type: String, trim: true, maxlength: 300 },
    content: { type: String, required: true },
    isPublished: { type: Boolean, default: true, index: true },
    showInFooter: { type: Boolean, default: true },
    showInHeader: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    ...seoFields,
  },
  schemaOptions,
);

export const Page = model<PageDocument>('Page', pageSchema);
