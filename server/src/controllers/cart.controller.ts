import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { Wishlist } from '../models/wishlist.model.js';
import { Product, toProductListItem, type ProductListSource } from '../models/product.model.js';
import * as cartService from '../services/cart.service.js';
import { getSettings } from '../services/settings.service.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';

const SESSION_HEADER = 'x-cart-session';

function ownerFrom(req: Request): cartService.CartOwner {
  if (req.auth?.userId) {
    return { userId: req.auth.userId };
  }

  const header = req.headers[SESSION_HEADER];
  const sessionId = Array.isArray(header) ? header[0] : header;

  return { sessionId: sessionId ?? null };
}

export const getCart = asyncHandler(async (req: Request, res: Response) => {
  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view, { meta: { sessionId: view.sessionId } });
});

export const addCartItem = asyncHandler(async (req: Request, res: Response) => {
  const cart = await cartService.addItemToCart(ownerFrom(req), req.body);
  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view, { status: 201, message: `${cart.items.length} item(s) in your bag` });
});

export const updateCartItem = asyncHandler(async (req: Request, res: Response) => {
  await cartService.updateCartItemQuantity(
    ownerFrom(req),
    req.params['itemId'] as string,
    (req.body as { quantity: number }).quantity,
  );

  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view);
});

export const removeCartItem = asyncHandler(async (req: Request, res: Response) => {
  await cartService.removeCartItem(ownerFrom(req), req.params['itemId'] as string);

  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view);
});

export const clearCart = asyncHandler(async (req: Request, res: Response) => {
  await cartService.clearCart(ownerFrom(req));

  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view);
});

export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  await cartService.applyCouponToCart(ownerFrom(req), code);

  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view, { message: 'Coupon applied' });
});

export const removeCoupon = asyncHandler(async (req: Request, res: Response) => {
  await cartService.applyCouponToCart(ownerFrom(req), undefined);

  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view, { message: 'Coupon removed' });
});

export const mergeCart = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = (req.body as { sessionId?: string }).sessionId;

  if (sessionId && req.auth?.userId) {
    await cartService.mergeGuestCartIntoUser(req.auth.userId, sessionId);
  }

  const view = await cartService.getCartView(ownerFrom(req));

  sendSuccess(res, view);
});

export const getCartSession = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();

  sendSuccess(res, {
    sessionId: crypto.randomUUID(),
    currency: settings.currency,
    freeShippingThreshold: settings.freeShippingThreshold,
  });
});

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await Wishlist.findOne({ user: req.auth?.userId }).lean();

  if (!wishlist || wishlist.products.length === 0) {
    sendSuccess(res, []);
    return;
  }

  const products = await Product.find({
    _id: { $in: wishlist.products.map((entry) => entry.product) },
  })
    .populate('category', 'name slug')
    .lean();

  sendSuccess(
    res,
    products.map((product) => toProductListItem(product as unknown as ProductListSource)),
  );
});

export const toggleWishlistItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.auth?.userId as string;
  const { productId } = req.body as { productId: string };

  const wishlist = await Wishlist.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  const existingIndex = wishlist.products.findIndex(
    (entry) => String(entry.product) === productId,
  );

  if (existingIndex >= 0) {
    wishlist.products.splice(existingIndex, 1);
  } else {
    wishlist.products.push({ product: productId as unknown as never, addedAt: new Date() });
  }

  await wishlist.save();

  sendSuccess(res, {
    inWishlist: existingIndex < 0,
    count: wishlist.products.length,
  });
});

export const clearWishlist = asyncHandler(async (req: Request, res: Response) => {
  await Wishlist.updateOne({ user: req.auth?.userId }, { $set: { products: [] } });

  sendSuccess(res, { cleared: true });
});
