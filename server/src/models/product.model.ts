import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions, seoFields } from './common.js';

export interface ProductImage {
  url: string;
  publicId?: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductVariant {
  name: string;
  sku: string;
  price: number;
  mrp?: number;
  stock: number;
  image?: string;
  isActive: boolean;
}

export interface ProductDocument {
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  category: Types.ObjectId;
  collections: Types.ObjectId[];
  tags: string[];
  price: number;
  mrp?: number;
  costPrice?: number;
  currency: string;
  stock: number;
  lowStockThreshold: number;
  images: ProductImage[];
  variants: ProductVariant[];
  colors: string[];
  materials: string[];
  stones: string[];
  occasions: string[];
  specifications: ProductSpecification[];
  weightGrams?: number;
  dimensions?: { lengthCm?: number; widthCm?: number; heightCm?: number };
  careInstructions?: string;
  badges: string[];
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  publishedAt?: Date;
  ratingsAverage: number;
  ratingsCount: number;
  soldCount: number;
  viewCount: number;
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  inStock?: boolean;
  discountPercent?: number;
  effectivePrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductHydratedDocument = HydratedDocument<ProductDocument>;

const productImageSchema = new Schema<ProductImage>(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    alt: { type: String, trim: true, maxlength: 160 },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const specificationSchema = new Schema<ProductSpecification>(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 240 },
  },
  { _id: false },
);

const variantSchema = new Schema<ProductVariant>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    sku: { type: String, required: true, trim: true, uppercase: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    image: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    shortDescription: { type: String, trim: true, maxlength: 400 },
    description: { type: String, trim: true, maxlength: 8000 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection', index: true }],
    tags: { type: [String], default: [], index: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', trim: true, uppercase: true },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    images: { type: [productImageSchema], default: [] },
    variants: { type: [variantSchema], default: [] },
    colors: { type: [String], default: [], index: true },
    materials: { type: [String], default: [], index: true },
    stones: { type: [String], default: [] },
    occasions: { type: [String], default: [], index: true },
    specifications: { type: [specificationSchema], default: [] },
    weightGrams: { type: Number, min: 0 },
    dimensions: {
      lengthCm: { type: Number, min: 0 },
      widthCm: { type: Number, min: 0 },
      heightCm: { type: Number, min: 0 },
    },
    careInstructions: { type: String, trim: true, maxlength: 1000 },
    badges: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false, index: true },
    isNewArrival: { type: Boolean, default: false, index: true },
    isBestSeller: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: () => new Date() },
    ratingsAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingsCount: { type: Number, default: 0, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    ...seoFields,
  },
  schemaOptions,
);

// `sku` is deliberately NOT part of the text index: seeded SKUs all read "OX-OXIDISED-...",
// so including it made a search for "oxidised jhumka" match the entire catalogue.
productSchema.index({ name: 'text', shortDescription: 'text', tags: 'text' });
productSchema.index({ isActive: 1, price: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, ratingsAverage: -1 });
productSchema.index({ category: 1, isActive: 1, price: 1 });
// NOTE: do not add a compound index spanning several array fields (colors/materials/
// occasions) — MongoDB rejects it with CannotIndexParallelArrays. Each of those paths
// already has its own single-field multikey index declared on the schema path.

productSchema.virtual('inStock').get(function inStock(this: ProductDocument): boolean {
  if (this.variants && this.variants.length > 0) {
    return this.variants.some((variant) => variant.isActive && variant.stock > 0);
  }

  return this.stock > 0;
});

productSchema.virtual('discountPercent').get(function discountPercent(this: ProductDocument): number {
  if (!this.mrp || this.mrp <= this.price) {
    return 0;
  }

  return Math.round(((this.mrp - this.price) / this.mrp) * 100);
});

productSchema.virtual('effectivePrice').get(function effectivePrice(this: ProductDocument): number {
  return this.price;
});

productSchema.virtual('primaryImage').get(function primaryImage(this: ProductDocument) {
  if (!this.images || this.images.length === 0) {
    return undefined;
  }

  return this.images.find((image) => image.isPrimary) ?? this.images[0];
});

productSchema.pre('validate', function normalizeProduct() {
  if (this.variants && this.variants.length > 0) {
    this.stock = this.variants
      .filter((variant) => variant.isActive)
      .reduce((total, variant) => total + (variant.stock ?? 0), 0);
  }

  if (this.images && this.images.length > 0 && !this.images.some((image) => image.isPrimary)) {
    const first = this.images[0];

    if (first) {
      first.isPrimary = true;
    }
  }
});

export const Product = model<ProductDocument>('Product', productSchema);

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  mrp?: number;
  discountPercent: number;
  currency: string;
  image?: string;
  inStock: boolean;
  stock: number;
  lowStockThreshold: number;
  rating: number;
  ratingCount: number;
  badges: string[];
  colors: string[];
  occasions: string[];
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  category?: { id: string; name: string; slug: string };
  createdAt?: Date;
}

export interface ProductListSource {
  _id: unknown;
  name: string;
  slug: string;
  sku: string;
  price: number;
  mrp?: number;
  currency: string;
  stock: number;
  lowStockThreshold?: number;
  images?: ProductImage[];
  variants?: ProductVariant[];
  ratingsAverage: number;
  ratingsCount: number;
  badges?: string[];
  colors?: string[];
  occasions?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  category?: { _id: unknown; name: string; slug: string } | null;
  createdAt?: Date;
}

export function toProductListItem(product: ProductListSource): ProductListItem {
  const primary =
    product.images?.find((image) => image.isPrimary) ?? product.images?.[0] ?? undefined;

  const inStock =
    product.variants && product.variants.length > 0
      ? product.variants.some((variant) => variant.isActive && variant.stock > 0)
      : product.stock > 0;

  const discountPercent =
    product.mrp && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price,
    mrp: product.mrp,
    discountPercent,
    currency: product.currency,
    image: primary?.url,
    inStock,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold ?? 5,
    rating: Number((product.ratingsAverage ?? 0).toFixed(1)),
    ratingCount: product.ratingsCount ?? 0,
    badges: product.badges ?? [],
    colors: product.colors ?? [],
    occasions: product.occasions ?? [],
    isActive: product.isActive ?? true,
    isFeatured: product.isFeatured ?? false,
    isNewArrival: product.isNewArrival ?? false,
    isBestSeller: product.isBestSeller ?? false,
    category: product.category
      ? {
          id: String(product.category._id),
          name: product.category.name,
          slug: product.category.slug,
        }
      : undefined,
    createdAt: product.createdAt,
  };
}
