import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

export type BannerPosition = 'hero' | 'category_strip' | 'promo_strip' | 'sidebar' | 'checkout';
export type BannerTextAlign = 'left' | 'center' | 'right';
export type BannerTheme = 'light' | 'dark';

export interface BannerDocument {
  title: string;
  subtitle?: string;
  description?: string;
  image: { url: string; publicId?: string; alt?: string };
  mobileImage?: { url: string; publicId?: string; alt?: string };
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  position: BannerPosition;
  textAlign: BannerTextAlign;
  theme: BannerTheme;
  sortOrder: number;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type BannerHydratedDocument = HydratedDocument<BannerDocument>;

const imageSchema = new Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
    alt: { type: String, trim: true, maxlength: 160 },
  },
  { _id: false },
);

const bannerSchema = new Schema<BannerDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 600 },
    image: { type: imageSchema, required: true },
    mobileImage: { type: imageSchema },
    ctaLabel: { type: String, trim: true, maxlength: 60 },
    ctaUrl: { type: String, trim: true, maxlength: 300 },
    secondaryCtaLabel: { type: String, trim: true, maxlength: 60 },
    secondaryCtaUrl: { type: String, trim: true, maxlength: 300 },
    position: {
      type: String,
      enum: ['hero', 'category_strip', 'promo_strip', 'sidebar', 'checkout'] satisfies BannerPosition[],
      default: 'hero',
      index: true,
    },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

bannerSchema.index({ position: 1, isActive: 1, sortOrder: 1 });

export const Banner = model<BannerDocument>('Banner', bannerSchema);
