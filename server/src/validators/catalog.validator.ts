import { z } from 'zod';
import {
  booleanQuerySchema,
  csvStringSchema,
  imageInputSchema,
  objectIdSchema,
  paginationSchema,
  seoInputSchema,
} from './common.validator.js';

const PRODUCT_SORT_FIELDS = [
  'createdAt',
  'price',
  'ratingsAverage',
  'soldCount',
  'name',
  'viewCount',
] as const;

const specificationInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(240),
});

const variantInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(1).max(60),
  price: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).default(0),
  image: z.string().trim().max(600).optional(),
  isActive: z.boolean().default(true),
});

export const productQuerySchema = paginationSchema.extend({
  category: z.string().trim().max(200).optional(),
  collection: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  colors: csvStringSchema,
  materials: csvStringSchema,
  stones: csvStringSchema,
  occasions: csvStringSchema,
  tags: csvStringSchema,
  inStock: booleanQuerySchema,
  featured: booleanQuerySchema,
  newArrival: booleanQuerySchema,
  bestSeller: booleanQuerySchema,
  onSale: booleanQuerySchema,
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(PRODUCT_SORT_FIELDS.map((field) => [field, `-${field}`]).flat() as [string, ...string[]]).optional(),
  status: z.enum(['all', 'active', 'draft', 'out_of_stock']).optional(),
});

export const searchSuggestQuerySchema = z.object({
  q: z.string().trim().min(1, 'Enter a search term').max(80),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(200).optional(),
  sku: z.string().trim().max(60).optional(),
  shortDescription: z.string().trim().max(400).optional(),
  description: z.string().trim().max(8000).optional(),
  category: objectIdSchema,
  collections: z.array(objectIdSchema).max(20).optional(),
  tags: z.array(z.string().trim().max(40)).max(30).optional(),
  price: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0).optional(),
  costPrice: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  images: z.array(imageInputSchema).max(12).optional(),
  variants: z.array(variantInputSchema).max(30).optional(),
  colors: z.array(z.string().trim().max(40)).max(20).optional(),
  materials: z.array(z.string().trim().max(60)).max(20).optional(),
  stones: z.array(z.string().trim().max(60)).max(20).optional(),
  occasions: z.array(z.string().trim().max(60)).max(20).optional(),
  specifications: z.array(specificationInputSchema).max(30).optional(),
  weightGrams: z.coerce.number().min(0).optional(),
  dimensions: z
    .object({
      lengthCm: z.coerce.number().min(0).optional(),
      widthCm: z.coerce.number().min(0).optional(),
      heightCm: z.coerce.number().min(0).optional(),
    })
    .optional(),
  careInstructions: z.string().trim().max(1000).optional(),
  badges: z.array(z.string().trim().max(30)).max(10).optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isActive: z.boolean().optional(),
  publishedAt: z.coerce.date().optional(),
  ...seoInputSchema.shape,
}).strict();

export const productUpdateSchema = productCreateSchema.partial().strict();

export const productStockUpdateSchema = z
  .object({
    stock: z.coerce.number().int().min(0),
    lowStockThreshold: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const variantStockUpdateSchema = z
  .object({
    sku: z.string().trim().min(1).max(60),
    stock: z.coerce.number().int().min(0),
  })
  .strict();

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(140).optional(),
  description: z.string().trim().max(2000).optional(),
  shortDescription: z.string().trim().max(300).optional(),
  image: imageInputSchema.omit({ isPrimary: true, sortOrder: true }).optional(),
  icon: z.string().trim().max(60).optional(),
  parent: objectIdSchema.nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  ...seoInputSchema.shape,
}).strict();

export const categoryUpdateSchema = categoryCreateSchema.partial().strict();

export const collectionCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(140).optional(),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(3000).optional(),
  heroImage: imageInputSchema.omit({ isPrimary: true, sortOrder: true }).optional(),
  thumbnail: imageInputSchema.omit({ isPrimary: true, sortOrder: true }).optional(),
  themeColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour such as #8a5a2b')
    .optional(),
  products: z.array(objectIdSchema).max(200).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  ...seoInputSchema.shape,
}).strict();

export const collectionUpdateSchema = collectionCreateSchema.partial().strict();

export const catalogReorderSchema = z
  .object({
    items: z
      .array(z.object({ id: objectIdSchema, sortOrder: z.coerce.number().int() }))
      .min(1)
      .max(200),
  })
  .strict();

export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type SearchSuggestQueryInput = z.infer<typeof searchSuggestQuerySchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CollectionCreateInput = z.infer<typeof collectionCreateSchema>;
