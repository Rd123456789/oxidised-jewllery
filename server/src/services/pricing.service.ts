import type { CouponDocument } from '../models/coupon.model.js';
import type { StoreSettingsDocument } from '../models/setting.model.js';

export interface PricedLine {
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface PricingInput {
  lines: PricedLine[];
  settings: Pick<
    StoreSettingsDocument,
    'currency' | 'taxPercent' | 'shippingFlatRate' | 'freeShippingThreshold' | 'codFee'
  >;
  coupon?: CouponDocument | null;
  paymentMethod?: string;
}

export interface PricingBreakdown {
  subtotal: number;
  discount: number;
  shippingFee: number;
  taxAmount: number;
  total: number;
  currency: string;
  couponCode?: string;
  freeShipping: boolean;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeCouponDiscount(
  coupon: CouponDocument | null | undefined,
  subtotal: number,
): number {
  if (!coupon || coupon.type === 'free_shipping') {
    return 0;
  }

  if (coupon.type === 'fixed') {
    return round2(Math.min(coupon.value, subtotal));
  }

  const raw = (subtotal * coupon.value) / 100;
  const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;

  return round2(Math.min(capped, subtotal));
}

export function computePricing({
  lines,
  settings,
  coupon,
  paymentMethod = 'cod',
}: PricingInput): PricingBreakdown {
  const subtotal = round2(lines.reduce((total, line) => total + line.lineTotal, 0));
  const discount = computeCouponDiscount(coupon, subtotal);
  const taxableAmount = Math.max(0, round2(subtotal - discount));

  const freeShippingByCoupon = coupon?.type === 'free_shipping';
  const freeShippingByThreshold =
    settings.freeShippingThreshold > 0 && taxableAmount >= settings.freeShippingThreshold;
  const freeShipping = freeShippingByCoupon || freeShippingByThreshold;

  let shippingFee = freeShipping ? 0 : settings.shippingFlatRate;

  if (paymentMethod === 'cod') {
    shippingFee += settings.codFee ?? 0;
  }

  shippingFee = round2(shippingFee);

  const taxAmount = round2((taxableAmount * settings.taxPercent) / 100);
  const total = round2(taxableAmount + shippingFee + taxAmount);

  return {
    subtotal,
    discount,
    shippingFee,
    taxAmount,
    total,
    currency: settings.currency,
    couponCode: coupon?.code,
    freeShipping,
  };
}
