import { Types } from 'mongoose';
import { Coupon, type CouponDocument } from '../models/coupon.model.js';
import { Order } from '../models/order.model.js';
import { ApiError } from '../utils/apiError.js';
import { computeCouponDiscount } from './pricing.service.js';

export interface CouponValidationContext {
  subtotal: number;
  productIds?: string[];
  categoryIds?: string[];
  userId?: string | null;
  isFirstOrder?: boolean;
  paymentMethod?: string;
}

export interface CouponValidationResult {
  coupon: CouponDocument;
  discount: number;
  freeShipping: boolean;
}

function isWithinWindow(coupon: CouponDocument, now = Date.now()): boolean {
  if (coupon.startsAt && coupon.startsAt.getTime() > now) {
    return false;
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() < now) {
    return false;
  }

  return true;
}

async function countUserRedemptions(coupon: CouponDocument, userId: string): Promise<number> {
  return Order.countDocuments({
    user: new Types.ObjectId(userId),
    'pricing.couponCode': coupon.code,
    status: { $nin: ['cancelled', 'returned'] },
  });
}

export async function validateCoupon(
  code: string,
  context: CouponValidationContext,
): Promise<CouponValidationResult> {
  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });

  if (!coupon || !coupon.isActive) {
    throw ApiError.badRequest('This coupon code is not valid');
  }

  if (!isWithinWindow(coupon)) {
    throw ApiError.badRequest('This coupon has expired');
  }

  if (coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest('This coupon has reached its usage limit');
  }

  if (context.subtotal < coupon.minOrderValue) {
    throw ApiError.badRequest(
      `Add items worth ₹${coupon.minOrderValue - context.subtotal} more to use this coupon`,
    );
  }

  if (
    coupon.applicableProducts.length > 0 &&
    !(context.productIds ?? []).some((id) =>
      coupon.applicableProducts.some((productId) => String(productId) === String(id)),
    )
  ) {
    throw ApiError.badRequest('This coupon is not applicable to the items in your bag');
  }

  if (
    coupon.applicableCategories.length > 0 &&
    !(context.categoryIds ?? []).some((id) =>
      coupon.applicableCategories.some((categoryId) => String(categoryId) === String(id)),
    )
  ) {
    throw ApiError.badRequest('This coupon is not applicable to the items in your bag');
  }

  if (coupon.firstOrderOnly && context.isFirstOrder === false) {
    throw ApiError.badRequest('This coupon is valid only on your first order');
  }

  if (context.userId) {
    const redemptions = await countUserRedemptions(coupon, context.userId);

    if (redemptions >= coupon.perUserLimit) {
      throw ApiError.badRequest('You have already used this coupon');
    }
  }

  if (coupon.type === 'free_shipping' && context.paymentMethod === 'cod') {
    // Free shipping coupons waive the shipping fee only; COD fee still applies.
    return { coupon, discount: 0, freeShipping: true };
  }

  return {
    coupon,
    discount: computeCouponDiscount(coupon, context.subtotal),
    freeShipping: coupon.type === 'free_shipping',
  };
}

export async function incrementCouponUsage(code: string): Promise<void> {
  await Coupon.updateOne({ code: code.trim().toUpperCase() }, { $inc: { usedCount: 1 } });
}
