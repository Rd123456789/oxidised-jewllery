import { Router } from 'express';
import * as controller from '../controllers/cart.controller.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { objectIdSchema } from '../validators/common.validator.js';
import {
  addToCartSchema,
  applyCouponSchema,
  cartItemParamSchema,
  updateCartItemSchema,
} from '../validators/order.validator.js';
import { z } from 'zod';

const router = Router();

router.get('/cart/session', controller.getCartSession);
router.get('/cart', optionalAuthenticate(), controller.getCart);
router.post(
  '/cart/items',
  optionalAuthenticate(),
  writeLimiter,
  validate({ body: addToCartSchema }),
  controller.addCartItem,
);
router.patch(
  '/cart/items/:itemId',
  optionalAuthenticate(),
  writeLimiter,
  validate({ params: cartItemParamSchema, body: updateCartItemSchema }),
  controller.updateCartItem,
);
router.delete(
  '/cart/items/:itemId',
  optionalAuthenticate(),
  writeLimiter,
  validate({ params: cartItemParamSchema }),
  controller.removeCartItem,
);
router.delete('/cart', optionalAuthenticate(), writeLimiter, controller.clearCart);
router.post(
  '/cart/coupon',
  optionalAuthenticate(),
  writeLimiter,
  validate({ body: applyCouponSchema }),
  controller.applyCoupon,
);
router.delete('/cart/coupon', optionalAuthenticate(), writeLimiter, controller.removeCoupon);
router.post(
  '/cart/merge',
  authenticate(),
  validate({ body: z.object({ sessionId: z.string().min(6).max(120) }) }),
  controller.mergeCart,
);

router.get('/wishlist', authenticate(), controller.getWishlist);
router.delete('/wishlist', authenticate(), writeLimiter, controller.clearWishlist);
router.post(
  '/wishlist/toggle',
  authenticate(),
  writeLimiter,
  validate({ body: z.object({ productId: objectIdSchema }) }),
  controller.toggleWishlistItem,
);

export default router;
