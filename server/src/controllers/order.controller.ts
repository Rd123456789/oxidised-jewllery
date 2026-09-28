import type { Request, Response } from 'express';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import { validateCoupon } from '../services/coupon.service.js';
import { buildOrderItems, placeOrder as placeOrderService, cancelOrderByCustomer, getOrderForCustomer, listCustomerOrders, markPaymentSucceeded, trackOrder } from '../services/order.service.js';
import { computePricing, round2 } from '../services/pricing.service.js';
import { getSettings } from '../services/settings.service.js';
import { isFirstOrder } from '../services/auth.service.js';
import type { PlaceOrderInput } from '../validators/order.validator.js';
import type { z } from 'zod';
import type { orderQuerySchema } from '../validators/order.validator.js';

function orderQuery(req: Request): z.infer<typeof orderQuerySchema> {
  return (req.validatedQuery ?? {}) as z.infer<typeof orderQuerySchema>;
}

export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as PlaceOrderInput;

  const result = await placeOrderService(input, {
    userId: req.auth?.userId ?? null,
    sessionId: (req.headers['x-cart-session'] as string | undefined) ?? null,
  });

  sendSuccess(
    res,
    {
      order: result.order,
      nextStep:
        input.paymentMethod === 'cod'
          ? 'We will confirm your order shortly.'
          : 'Complete the payment to confirm your order.',
    },
    { status: 201, message: 'Order placed' },
  );
});

export const quoteOrder = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    items?: { productId: string; variantSku?: string; quantity: number }[];
    couponCode?: string;
    paymentMethod?: string;
  };

  if (!body.items || body.items.length === 0) {
    throw ApiError.badRequest('Add at least one item to get a quote');
  }

  const settings = await getSettings();
  const items = await buildOrderItems(body.items);
  const subtotal = round2(items.reduce((total, item) => total + item.lineTotal, 0));

  let coupon = null;

  if (body.couponCode) {
    const validation = await validateCoupon(body.couponCode, {
      subtotal,
      productIds: items.map((item) => String(item.product)),
      userId: req.auth?.userId ?? null,
      isFirstOrder: req.auth?.userId ? await isFirstOrder(req.auth.userId) : true,
      paymentMethod: body.paymentMethod,
    });

    coupon = validation.coupon;
  }

  const pricing = computePricing({
    lines: items.map((item) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    settings,
    coupon,
    paymentMethod: body.paymentMethod,
  });

  sendSuccess(res, {
    items: items.map((item) => ({
      productId: String(item.product),
      name: item.name,
      sku: item.sku,
      image: item.image,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    pricing,
    codEnabled: settings.codEnabled,
    currency: settings.currency,
  });
});

export const myOrders = asyncHandler(async (req: Request, res: Response) => {
  const result = await listCustomerOrders(req.auth?.userId as string, orderQuery(req));

  sendSuccess(res, result.orders, { meta: result.meta });
});

export const myOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderForCustomer(req.auth?.userId as string, req.params['orderNumber'] as string);

  sendSuccess(res, order);
});

export const cancelMyOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await cancelOrderByCustomer(
    req.auth?.userId as string,
    req.params['orderNumber'] as string,
    (req.body as { reason?: string }).reason,
  );

  sendSuccess(res, order, { message: 'Order cancelled' });
});

export const track = asyncHandler(async (req: Request, res: Response) => {
  const orderNumber = (req.validatedQuery?.['orderNumber'] ?? req.params['orderNumber']) as string;
  const phone = req.validatedQuery?.['phone'] as string | undefined;

  const order = await trackOrder(orderNumber, phone);

  sendSuccess(res, {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt,
    items: order.items,
    pricing: order.pricing,
    tracking: order.tracking,
    statusHistory: order.statusHistory,
    customerName: order.customerName,
  });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    orderNumber: string;
    providerOrderId: string;
    providerPaymentId: string;
    providerSignature: string;
  };

  const order = await markPaymentSucceeded(body.orderNumber, body);

  sendSuccess(res, order, { message: 'Payment confirmed' });
});
