import { z } from 'zod';
import { addressInputSchema, emailSchema, passwordSchema } from './common.validator.js';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(80),
    email: emailSchema,
    password: passwordSchema,
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{6,20}$/, 'Enter a valid phone number')
      .optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(10).optional(),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Reset token is required'),
    password: passwordSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s]{6,20}$/, 'Enter a valid phone number')
      .optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

export const addAddressSchema = addressInputSchema;

export const updateAddressSchema = addressInputSchema.partial();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
