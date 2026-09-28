import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

/** Single place that defines how e-mail addresses are normalised and validated. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), {
    message: 'Enter a valid email address',
  });

/** Accepts `?color=gold,silver` and also `?color=gold&color=silver`. */
export const csvStringSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    const list = Array.isArray(value) ? value : [value];

    return list
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);
  });

export const booleanQuerySchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }

    return undefined;
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sort: z.string().trim().max(60).optional(),
  q: z.string().trim().max(140).optional(),
});

export const imageInputSchema = z.object({
  url: z.string().trim().min(1).max(600),
  publicId: z.string().trim().max(300).optional(),
  alt: z.string().trim().max(160).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const seoInputSchema = z.object({
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(160).optional(),
  keywords: z.array(z.string().trim().max(60)).max(20).optional(),
});

export const addressInputSchema = z.object({
  label: z.string().trim().max(30).optional(),
  fullName: z.string().trim().min(2, 'Name is required').max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{6,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(3, 'Address is required').max(160),
  line2: z.string().trim().max(160).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6 digit pincode'),
  country: z.string().trim().max(80).default('India'),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressInputSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const idParamSchema = z.object({ id: objectIdSchema });
export const slugParamSchema = z.object({ slug: z.string().trim().min(1).max(200) });
