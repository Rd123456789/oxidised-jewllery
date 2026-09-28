import { z } from 'zod';
import { addressInputSchema, emailSchema, objectIdSchema, paginationSchema } from './common.validator.js';

export const addToCartSchema = z
  .object({
    productId: objectIdSchema,
    variantSku: z.string().trim().max(60).optional(),
    quantity: z.coerce.number().int().min(1).max(50).default(1),
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    quantity: z.coerce.number().int().min(1).max(50),
  })
  .strict();

export const applyCouponSchema = z
  .object({
    code: z.string().trim().min(2).max(40).toUpperCase(),
  })
  .strict();

export const cartItemParamSchema = z.object({ itemId: objectIdSchema });

export const placeOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: objectIdSchema,
          variantSku: z.string().trim().max(60).optional(),
          quantity: z.coerce.number().int().min(1).max(50),
        }),
      )
      .max(60)
      .optional(),
    shippingAddress: addressInputSchema,
    billingAddress: addressInputSchema.optional(),
    paymentMethod: z.enum(['cod', 'razorpay', 'upi', 'manual']).default('cod'),
    couponCode: z.string().trim().max(40).toUpperCase().optional(),
    customerNote: z.string().trim().max(1000).optional(),
    guestEmail: emailSchema.optional(),
    saveAddress: z.boolean().optional(),
  })
  .strict();

export const verifyPaymentSchema = z
  .object({
    orderNumber: z.string().trim().min(4).max(40),
    providerOrderId: z.string().trim().max(120),
    providerPaymentId: z.string().trim().max(120),
    providerSignature: z.string().trim().max(300),
  })
  .strict();

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  phone: z.string().trim().max(20).optional(),
});

export const orderQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      'pending',
      'confirmed',
      'processing',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
      'refunded',
    ])
    .optional(),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded']).optional(),
  paymentMethod: z.enum(['cod', 'razorpay', 'upi', 'manual']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  customerId: objectIdSchema.optional(),
});

export const updateOrderStatusSchema = z
  .object({
    status: z.enum([
      'pending',
      'confirmed',
      'processing',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
      'refunded',
    ]),
    note: z.string().trim().max(500).optional(),
    cancelReason: z.string().trim().max(500).optional(),
    tracking: z
      .object({
        carrier: z.string().trim().max(80).optional(),
        trackingNumber: z.string().trim().max(120).optional(),
        trackingUrl: z.string().trim().max(300).optional(),
      })
      .optional(),
    paymentStatus: z
      .enum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])
      .optional(),
    adminNote: z.string().trim().max(2000).optional(),
  })
  .strict();

export const cancelOrderSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
