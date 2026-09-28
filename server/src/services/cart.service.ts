import { Types, type QueryFilter } from 'mongoose';
import { Cart, type CartDocument, type CartHydratedDocument } from '../models/cart.model.js';
import { Product, type ProductDocument } from '../models/product.model.js';
import { ApiError } from '../utils/apiError.js';
import { validateCoupon } from './coupon.service.js';
import { computePricing, round2, type PricingBreakdown } from './pricing.service.js';
import { getSettings } from './settings.service.js';

export interface CartOwner {
  userId?: string | null;
  sessionId?: string | null;
}

export async function getOrCreateCart(owner: CartOwner): Promise<CartHydratedDocument> {
  if (owner.userId) {
    const existing = await Cart.findOne({ status: 'active', user: owner.userId });

    if (existing) {
      return existing;
    }

    return Cart.create({ user: owner.userId, items: [], status: 'active' });
  }

  if (!owner.sessionId) {
    throw ApiError.badRequest('A cart session is required for guest checkout');
  }

  const existing = await Cart.findOne({ status: 'active', sessionId: owner.sessionId });

  if (existing) {
    return existing;
  }

  return Cart.create({ sessionId: owner.sessionId, items: [], status: 'active' });
}

export async function findCart(owner: CartOwner): Promise<CartHydratedDocument | null> {
  const filter: QueryFilter<CartDocument> = { status: 'active' };

  if (owner.userId) {
    filter.user = new Types.ObjectId(owner.userId);
  } else if (owner.sessionId) {
    filter.sessionId = owner.sessionId;
  } else {
    return null;
  }

  return Cart.findOne(filter);
}

function primaryImage(product: ProductDocument): string | undefined {
  if (!product.images || product.images.length === 0) {
    return undefined;
  }

  return (product.images.find((image) => image.isPrimary) ?? product.images[0])?.url;
}

function resolveVariant(product: ProductDocument, variantSku?: string) {
  if (!variantSku) {
    return undefined;
  }

  return product.variants?.find((variant) => variant.sku === variantSku.toUpperCase() && variant.isActive);
}

export interface AddToCartInput {
  productId: string;
  variantSku?: string;
  quantity: number;
}

export async function addItemToCart(
  owner: CartOwner,
  input: AddToCartInput,
): Promise<CartHydratedDocument> {
  const product = await Product.findById(input.productId);

  if (!product || !product.isActive) {
    throw ApiError.notFound('This piece is no longer available');
  }

  const variant = resolveVariant(product, input.variantSku);

  if (input.variantSku && !variant) {
    throw ApiError.badRequest('The selected option is unavailable');
  }

  const unitPrice = variant?.price ?? product.price;
  const mrp = variant?.mrp ?? product.mrp;
  const availableStock = variant?.stock ?? product.stock;
  const normalizedSku = variant?.sku;

  const cart = await getOrCreateCart(owner);

  const existing = cart.items.find(
    (item) =>
      String(item.product) === String(product._id) && (item.variantSku ?? '') === (normalizedSku ?? ''),
  );

  const nextQuantity = (existing?.quantity ?? 0) + input.quantity;

  if (nextQuantity > availableStock) {
    throw ApiError.badRequest(
      availableStock === 0 ? 'This piece is out of stock' : `Only ${availableStock} left in stock`,
    );
  }

  if (existing) {
    existing.quantity = nextQuantity;
    existing.lineTotal = round2(unitPrice * nextQuantity);
  } else {
    cart.items.push({
      product: product._id,
      variantSku: normalizedSku,
      name: product.name,
      slug: product.slug,
      image: variant?.image ?? primaryImage(product),
      unitPrice,
      mrp,
      quantity: input.quantity,
      lineTotal: round2(unitPrice * input.quantity),
      addedAt: new Date(),
    });
  }

  cart.lastActivityAt = new Date();
  await cart.save();

  return cart;
}

export async function updateCartItemQuantity(
  owner: CartOwner,
  itemId: string,
  quantity: number,
): Promise<CartHydratedDocument> {
  const cart = await findCart(owner);

  if (!cart) {
    throw ApiError.notFound('Your bag is empty');
  }

  const item = cart.items.find((entry) => String(entry._id) === itemId);

  if (!item) {
    throw ApiError.notFound('This item is no longer in your bag');
  }

  const product = await Product.findById(item.product);

  if (!product || !product.isActive) {
    throw ApiError.badRequest('This piece is no longer available');
  }

  const variant = resolveVariant(product, item.variantSku);
  const availableStock = variant?.stock ?? product.stock;
  const unitPrice = variant?.price ?? product.price;

  if (quantity > availableStock) {
    throw ApiError.badRequest(
      availableStock === 0 ? 'This piece is out of stock' : `Only ${availableStock} left in stock`,
    );
  }

  item.quantity = quantity;
  item.unitPrice = unitPrice;
  item.mrp = variant?.mrp ?? product.mrp;
  item.lineTotal = round2(unitPrice * quantity);
  cart.lastActivityAt = new Date();

  await cart.save();

  return cart;
}

export async function removeCartItem(owner: CartOwner, itemId: string): Promise<CartHydratedDocument> {
  const cart = await findCart(owner);

  if (!cart) {
    throw ApiError.notFound('Your bag is empty');
  }

  const index = cart.items.findIndex((entry) => String(entry._id) === itemId);

  if (index === -1) {
    throw ApiError.notFound('This item is no longer in your bag');
  }

  cart.items.splice(index, 1);
  cart.lastActivityAt = new Date();

  await cart.save();

  return cart;
}

export async function clearCart(owner: CartOwner): Promise<CartHydratedDocument | null> {
  const cart = await findCart(owner);

  if (!cart) {
    return null;
  }

  cart.items = [];
  cart.couponCode = undefined;
  cart.lastActivityAt = new Date();

  await cart.save();

  return cart;
}

export async function applyCouponToCart(
  owner: CartOwner,
  code: string | undefined,
): Promise<CartHydratedDocument> {
  const cart = await getOrCreateCart(owner);

  if (!code) {
    cart.couponCode = undefined;
    await cart.save();

    return cart;
  }

  const normalized = code.trim().toUpperCase();

  // Validate before persisting. `getCartView` clears an unusable code silently, which
  // used to turn a bad coupon into a 200 response with `couponCode: undefined` — the
  // client then reported "Coupon undefined applied". Rejecting here surfaces the real
  // reason (not valid / expired / minimum not met) instead.
  await validateCoupon(normalized, {
    subtotal: cart.subtotal ?? 0,
    userId: owner.userId ?? null,
  });

  cart.couponCode = normalized;
  await cart.save();

  return cart;
}

export interface CartView {
  id: string;
  sessionId?: string;
  items: CartHydratedDocument['items'];
  itemCount: number;
  couponCode?: string;
  pricing: PricingBreakdown;
}

export async function getCartView(owner: CartOwner): Promise<CartView> {
  const cart = await getOrCreateCart(owner);
  const settings = await getSettings();

  let coupon = null;

  if (cart.couponCode) {
    try {
      const validation = await validateCoupon(cart.couponCode, {
        subtotal: cart.subtotal ?? 0,
        userId: owner.userId ?? null,
      });

      coupon = validation.coupon;
    } catch {
      cart.couponCode = undefined;
      await cart.save();
    }
  }

  const pricing = computePricing({
    lines: cart.items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    settings,
    coupon,
    // The cart has no payment method yet, so the COD surcharge must not be added here.
    // Otherwise a shopper with free shipping still sees a ₹30 shipping line.
    paymentMethod: 'prepaid',
  });

  return {
    id: String(cart._id),
    sessionId: cart.sessionId,
    items: cart.items,
    itemCount: cart.itemCount ?? 0,
    couponCode: cart.couponCode,
    pricing,
  };
}

export async function mergeGuestCartIntoUser(
  userId: string,
  sessionId: string,
): Promise<CartHydratedDocument | null> {
  const guestCart = await Cart.findOne({ status: 'active', sessionId });

  if (!guestCart || guestCart.items.length === 0) {
    return null;
  }

  const userCart = await getOrCreateCart({ userId });

  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find(
      (item) =>
        String(item.product) === String(guestItem.product) &&
        (item.variantSku ?? '') === (guestItem.variantSku ?? ''),
    );

    if (existing) {
      existing.quantity += guestItem.quantity;
      existing.lineTotal = round2(existing.unitPrice * existing.quantity);
    } else {
      userCart.items.push(guestItem);
    }
  }

  if (guestCart.couponCode && !userCart.couponCode) {
    userCart.couponCode = guestCart.couponCode;
  }

  guestCart.status = 'converted';
  guestCart.items = [];

  await Promise.all([userCart.save(), guestCart.save()]);

  return userCart;
}
