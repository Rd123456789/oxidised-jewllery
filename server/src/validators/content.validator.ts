import { z } from 'zod';
import {
  booleanQuerySchema,
  emailSchema,
  imageInputSchema,
  objectIdSchema,
  paginationSchema,
  seoInputSchema,
} from './common.validator.js';

const couponBaseSchema = z.object({
  code: z.string().trim().min(2).max(40).toUpperCase(),
  description: z.string().trim().max(240).optional(),
  type: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.coerce.number().min(0).default(0),
  minOrderValue: z.coerce.number().min(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional(),
  usageLimit: z.coerce.number().int().min(1).optional(),
  perUserLimit: z.coerce.number().int().min(1).optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  applicableCategories: z.array(objectIdSchema).max(50).optional(),
  applicableProducts: z.array(objectIdSchema).max(200).optional(),
  firstOrderOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const couponCreateSchema = couponBaseSchema
  .refine((data) => data.type === 'free_shipping' || data.value > 0, {
    message: 'Value must be greater than 0 for percentage and fixed coupons',
    path: ['value'],
  })
  .refine((data) => data.type !== 'percentage' || data.value <= 100, {
    message: 'Percentage discount cannot exceed 100',
    path: ['value'],
  });

export const couponUpdateSchema = couponBaseSchema.partial().strict();

export const couponQuerySchema = paginationSchema.extend({
  active: booleanQuerySchema,
});

export const bannerCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(600).optional(),
  image: imageInputSchema.omit({ isPrimary: true, sortOrder: true }),
  mobileImage: imageInputSchema.omit({ isPrimary: true, sortOrder: true }).optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().max(300).optional(),
  secondaryCtaLabel: z.string().trim().max(60).optional(),
  secondaryCtaUrl: z.string().trim().max(300).optional(),
  position: z.enum(['hero', 'category_strip', 'promo_strip', 'sidebar', 'checkout']).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
}).strict();

export const bannerUpdateSchema = bannerCreateSchema.partial().strict();

export const pageCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(180).optional(),
  excerpt: z.string().trim().max(300).optional(),
  content: z.string().min(1, 'Content is required'),
  isPublished: z.boolean().optional(),
  showInFooter: z.boolean().optional(),
  showInHeader: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  ...seoInputSchema.shape,
});

export const pageUpdateSchema = pageCreateSchema.partial();

export const reviewCreateSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(140).optional(),
  body: z.string().trim().max(3000).optional(),
  images: z.array(z.string().trim().max(600)).max(5).optional(),
});

export const reviewQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional(),
  productId: objectIdSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export const reviewModerationSchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected']),
    adminReply: z.string().trim().max(1500).optional(),
  })
  .strict();

export const newsletterSubscribeSchema = z
  .object({
    email: emailSchema,
    source: z.string().trim().max(80).optional(),
  })
  .strict();

export const customerQuerySchema = paginationSchema.extend({
  role: z.enum(['customer', 'manager', 'admin']).optional(),
  active: booleanQuerySchema,
});

export const customerUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().max(20).optional(),
    role: z.enum(['customer', 'manager', 'admin']).optional(),
    isActive: z.boolean().optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

export const settingsUpdateSchema = z.object({
  storeName: z.string().trim().min(2).max(120).optional(),
  tagline: z.string().trim().max(200).optional(),
  logo: z.object({ url: z.string().trim().max(600), publicId: z.string().trim().max(300).optional() }).optional(),
  supportEmail: emailSchema.optional(),
  supportPhone: z.string().trim().max(20).optional(),
  whatsappNumber: z.string().trim().max(20).optional(),
  addressLines: z.array(z.string().trim().max(160)).max(6).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  currency: z.string().trim().length(3).optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  taxLabel: z.string().trim().max(30).optional(),
  shippingFlatRate: z.coerce.number().min(0).optional(),
  freeShippingThreshold: z.coerce.number().min(0).optional(),
  codEnabled: z.boolean().optional(),
  codFee: z.coerce.number().min(0).optional(),
  minOrderValue: z.coerce.number().min(0).optional(),
  announcement: z
    .object({
      text: z.string().trim().max(200).optional(),
      link: z.string().trim().max(300).optional(),
      isActive: z.boolean().optional(),
    })
    .optional(),
  social: z
    .object({
      instagram: z.string().trim().max(300).optional(),
      facebook: z.string().trim().max(300).optional(),
      pinterest: z.string().trim().max(300).optional(),
      youtube: z.string().trim().max(300).optional(),
    })
    .optional(),
  returnsWindowDays: z.coerce.number().int().min(0).max(90).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  maintenanceMode: z.boolean().optional(),
});

export const uploadFolderSchema = z.enum(['products', 'categories', 'collections', 'banners', 'pages', 'misc']);

export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;
export type PageCreateInput = z.infer<typeof pageCreateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
