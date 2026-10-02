import { Router } from 'express';
import * as controller from '../controllers/order.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  cancelOrderSchema,
  orderQuerySchema,
  placeOrderSchema,
  trackOrderSchema,
  verifyPaymentSchema,
} from '../validators/order.validator.js';
import { z } from 'zod';
import { objectIdSchema } from '../validators/common.validator.js';

const router = Router();

// An order has to belong to someone. With `optionalAuthenticate` a guest could place one, and the
// result was an orphan: no `user`, no history, and no way for the buyer to cancel it, because
// cancellation requires ownership. Quoting stays open — it prices a bag and creates nothing.
router.post(
  '/orders',
  authenticate(),
  idempotency(),
  writeLimiter,
  validate({ body: placeOrderSchema }),
  controller.placeOrder,
);
router.post('/orders/quote', optionalAuthenticate(), validate({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: objectIdSchema,
          variantSku: z.string().trim().max(60).optional(),
          quantity: z.coerce.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(60),
    couponCode: z.string().trim().max(40).toUpperCase().optional(),
    paymentMethod: z.enum(['cod', 'razorpay', 'upi', 'manual']).optional(),
  }),
}), controller.quoteOrder);

router.get('/orders/track', validate({ query: trackOrderSchema }), controller.track);
router.post('/orders/verify-payment', validate({ body: verifyPaymentSchema }), controller.verifyPayment);

router.get('/orders', authenticate(), validate({ query: orderQuerySchema }), controller.myOrders);
router.get('/orders/:orderNumber', authenticate(), controller.myOrder);
router.post(
  '/orders/:orderNumber/cancel',
  authenticate(),
  writeLimiter,
  validate({ body: cancelOrderSchema }),
  controller.cancelMyOrder,
);

export default router;
