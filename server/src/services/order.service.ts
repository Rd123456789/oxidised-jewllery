import { Types, type QueryFilter } from 'mongoose';
import { Cart } from '../models/cart.model.js';
import { nextSequence } from '../models/counter.model.js';
import {
  Order,
  type OrderDocument,
  type OrderItem,
  type OrderStatus,
  type StatusHistoryEntry,
} from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { buildPaginationMeta, buildSort, parsePagination } from '../utils/query.js';
import { isFirstOrder } from './auth.service.js';
import { incrementCouponUsage, validateCoupon } from './coupon.service.js';
import { computePricing, round2 } from './pricing.service.js';
import { getSettings } from './settings.service.js';
import type {
  PlaceOrderInput,
  UpdateOrderStatusInput,
  orderQuerySchema,
} from '../validators/order.validator.js';
import type { z } from 'zod';

export interface RequestedLine {
  productId: string;
  variantSku?: string;
  quantity: number;
}

export interface PlaceOrderContext {
  userId?: string | null;
  sessionId?: string | null;
}

interface StockReservation {
  productId: Types.ObjectId;
  variantSku?: string;
  quantity: number;
  usesVariants: boolean;
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned', 'refunded'],
  cancelled: [],
  returned: ['refunded'],
  refunded: [],
};

export async function generateOrderNumber(): Promise<{ orderNumber: string; invoiceNumber: string }> {
  const now = new Date();
  const stamp = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');

  const sequence = await nextSequence(`order-${stamp}`);

  return {
    orderNumber: `OX-${stamp}-${String(sequence).padStart(4, '0')}`,
    invoiceNumber: `INV-${stamp}-${String(sequence).padStart(4, '0')}`,
  };
}

export async function buildOrderItems(lines: RequestedLine[]): Promise<OrderItem[]> {
  const items: OrderItem[] = [];

  for (const line of lines) {
    const product = await Product.findById(line.productId);

    if (!product || !product.isActive) {
      throw ApiError.badRequest('One of the pieces in your bag is no longer available');
    }

    const sku = line.variantSku?.toUpperCase();
    const variant = sku
      ? product.variants?.find((entry) => entry.sku === sku && entry.isActive)
      : undefined;

    if (sku && !variant) {
      throw ApiError.badRequest(`The selected option for ${product.name} is unavailable`);
    }

    const unitPrice = variant?.price ?? product.price;
    const availableStock = variant?.stock ?? product.stock;

    if (line.quantity > availableStock) {
      throw ApiError.badRequest(
        availableStock === 0
          ? `${product.name} is out of stock`
          : `Only ${availableStock} unit(s) of ${product.name} left in stock`,
      );
    }

    const image = variant?.image ?? (product.images?.find((entry) => entry.isPrimary) ?? product.images?.[0])?.url;

    items.push({
      product: product._id,
      variantSku: variant?.sku,
      name: product.name,
      slug: product.slug,
      image,
      sku: variant?.sku ?? product.sku,
      unitPrice,
      mrp: variant?.mrp ?? product.mrp,
      quantity: line.quantity,
      lineTotal: round2(unitPrice * line.quantity),
    });
  }

  return items;
}

async function releaseStock(reservations: StockReservation[]): Promise<void> {
  for (const reservation of reservations) {
    if (reservation.variantSku) {
      await Product.updateOne(
        { _id: reservation.productId, 'variants.sku': reservation.variantSku },
        { $inc: { 'variants.$.stock': reservation.quantity } },
      );
    } else {
      await Product.updateOne({ _id: reservation.productId }, { $inc: { stock: reservation.quantity } });
    }
  }
}

async function reserveStock(items: OrderItem[]): Promise<StockReservation[]> {
  const reservations: StockReservation[] = [];

  try {
    for (const item of items) {
      const usesVariants = Boolean(item.variantSku);

      if (item.variantSku) {
        const updated = await Product.findOneAndUpdate(
          {
            _id: item.product,
            isActive: true,
            variants: {
              $elemMatch: {
                sku: item.variantSku,
                isActive: true,
                stock: { $gte: item.quantity },
              },
            },
          },
          { $inc: { 'variants.$.stock': -item.quantity } },
          { returnDocument: 'after' },
        );

        if (!updated) {
          throw ApiError.conflict(`${item.name} just sold out in the quantity you selected`);
        }
      } else {
        const updated = await Product.findOneAndUpdate(
          { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { returnDocument: 'after' },
        );

        if (!updated) {
          throw ApiError.conflict(`${item.name} just sold out in the quantity you selected`);
        }
      }

      reservations.push({
        productId: item.product,
        variantSku: item.variantSku,
        quantity: item.quantity,
        usesVariants,
      });
    }
  } catch (error) {
    await releaseStock(reservations);
    throw error;
  }

  return reservations;
}

async function finalizeStock(items: OrderItem[]): Promise<void> {
  for (const item of items) {
    await Product.updateOne({ _id: item.product }, { $inc: { soldCount: item.quantity } });

    if (item.variantSku) {
      await Product.updateOne({ _id: item.product }, [
        { $set: { stock: { $sum: '$variants.stock' } } },
      ]);
    }
  }
}

export interface PlaceOrderResult {
  order: OrderDocument & { _id: unknown };
  cartCleared: boolean;
}

export async function placeOrder(
  input: PlaceOrderInput,
  context: PlaceOrderContext,
): Promise<PlaceOrderResult> {
  const settings = await getSettings();

  const requested: RequestedLine[] = (input.items ?? []).map((item) => ({
    productId: item.productId,
    variantSku: item.variantSku,
    quantity: item.quantity,
  }));

  let cart = null;

  if (requested.length === 0) {
    const cartFilter: QueryFilter<typeof Cart> = { status: 'active' };

    if (context.userId) {
      cartFilter['user'] = new Types.ObjectId(context.userId);
    } else if (context.sessionId) {
      cartFilter['sessionId'] = context.sessionId;
    } else {
      throw ApiError.badRequest('Your bag is empty');
    }

    cart = await Cart.findOne(cartFilter);

    if (!cart || cart.items.length === 0) {
      throw ApiError.badRequest('Your bag is empty');
    }

    requested.push(
      ...cart.items.map((item) => ({
        productId: String(item.product),
        variantSku: item.variantSku,
        quantity: item.quantity,
      })),
    );
  }

  if (input.paymentMethod === 'cod' && !settings.codEnabled) {
    throw ApiError.badRequest('Cash on delivery is currently unavailable');
  }

  const items = await buildOrderItems(requested);
  const subtotal = round2(items.reduce((total, item) => total + item.lineTotal, 0));

  if (settings.minOrderValue > 0 && subtotal < settings.minOrderValue) {
    throw ApiError.badRequest(`Minimum order value is ₹${settings.minOrderValue}`);
  }

  const couponCode = input.couponCode ?? cart?.couponCode;
  let coupon = null;

  if (couponCode) {
    const categoryIds = await Product.distinct('category', {
      _id: { $in: items.map((item) => item.product) },
    });

    const validation = await validateCoupon(couponCode, {
      subtotal,
      productIds: items.map((item) => String(item.product)),
      categoryIds: (categoryIds as Types.ObjectId[]).map(String),
      userId: context.userId ?? null,
      isFirstOrder: context.userId ? await isFirstOrder(context.userId) : true,
      paymentMethod: input.paymentMethod,
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
    paymentMethod: input.paymentMethod,
  });

  const reservations = await reserveStock(items);

  const { orderNumber, invoiceNumber } = await generateOrderNumber();

  const initialStatus: OrderStatus = input.paymentMethod === 'cod' ? 'confirmed' : 'pending';
  const statusHistory: StatusHistoryEntry[] = [
    {
      status: initialStatus,
      note: input.paymentMethod === 'cod' ? 'Order placed (cash on delivery)' : 'Order placed, awaiting payment',
      changedAt: new Date(),
    },
  ];

  let order: (OrderDocument & { _id: unknown }) | null = null;

  try {
    order = await Order.create({
      orderNumber,
      invoiceNumber,
      user: context.userId ?? null,
      guestEmail: input.guestEmail,
      customerName: input.shippingAddress.fullName,
      customerPhone: input.shippingAddress.phone,
      items,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress ?? input.shippingAddress,
      pricing,
      payment: {
        method: input.paymentMethod,
        status: 'pending',
        amount: pricing.total,
      },
      status: initialStatus,
      statusHistory,
      customerNote: input.customerNote,
      placedAt: new Date(),
    });
  } catch (error) {
    await releaseStock(reservations);
    throw error;
  }

  await finalizeStock(items);

  if (coupon) {
    await incrementCouponUsage(coupon.code);
  }

  if (cart) {
    cart.status = 'converted';
    cart.items = [];
    await cart.save();
  }

  if (input.saveAddress && context.userId) {
    await User.updateOne(
      { _id: context.userId },
      { $push: { addresses: { ...input.shippingAddress, isDefault: false } } },
    );
  }

  return { order, cartCleared: Boolean(cart) };
}

export async function markPaymentSucceeded(
  orderNumber: string,
  paymentDetails: { providerOrderId: string; providerPaymentId: string; providerSignature?: string },
): Promise<OrderDocument & { _id: unknown }> {
  const order = await Order.findOne({ orderNumber });

  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  // NOTE: signature verification is intentionally centralised here so a real
  // gateway (Razorpay/Stripe) can be dropped in without touching the controllers.
  order.payment.status = 'paid';
  order.payment.providerOrderId = paymentDetails.providerOrderId;
  order.payment.providerPaymentId = paymentDetails.providerPaymentId;
  order.payment.providerSignature = paymentDetails.providerSignature;
  order.payment.paidAt = new Date();

  if (order.status === 'pending') {
    order.status = 'confirmed';
    order.statusHistory.push({
      status: 'confirmed',
      note: 'Payment received',
      changedAt: new Date(),
    });
  }

  await order.save();

  return order;
}

export async function listCustomerOrders(
  userId: string,
  query: z.infer<typeof orderQuerySchema>,
) {
  const pagination = parsePagination(query as Record<string, unknown>);
  const filter: QueryFilter<OrderDocument> = { user: new Types.ObjectId(userId) };

  if (query.status) {
    filter.status = query.status;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, meta: buildPaginationMeta(total, pagination) };
}

export async function listAdminOrders(query: z.infer<typeof orderQuerySchema>) {
  const pagination = parsePagination(query as Record<string, unknown>);
  const filter: QueryFilter<OrderDocument> = {};

  if (query.status) {
    filter.status = query.status;
  }
  if (query.paymentStatus) {
    filter['payment.status'] = query.paymentStatus;
  }
  if (query.paymentMethod) {
    filter['payment.method'] = query.paymentMethod;
  }
  if (query.customerId) {
    filter.user = new Types.ObjectId(query.customerId);
  }
  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};
    if (query.from) {
      createdAt['$gte'] = query.from;
    }
    if (query.to) {
      createdAt['$lte'] = query.to;
    }
    filter.createdAt = createdAt;
  }
  if (query.q) {
    const term = query.q;
    filter.$or = [
      { orderNumber: new RegExp(term, 'i') },
      { customerName: new RegExp(term, 'i') },
      { customerPhone: new RegExp(term, 'i') },
      { guestEmail: new RegExp(term, 'i') },
    ];
  }

  const sort = buildSort(query.sort, ['createdAt', 'pricing.total', 'status'], { createdAt: -1 });

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('user', 'name email phone')
      .lean(),
    Order.countDocuments(filter),
  ]);

  return { orders, meta: buildPaginationMeta(total, pagination) };
}

export async function getOrderByNumber(orderNumber: string) {
  const order = await Order.findOne({ orderNumber }).populate('user', 'name email phone');

  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  return order;
}

export async function trackOrder(orderNumber: string, phone?: string) {
  const order = await Order.findOne({ orderNumber });

  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  if (phone && order.customerPhone.replace(/\D/g, '').slice(-10) !== phone.replace(/\D/g, '').slice(-10)) {
    throw ApiError.unauthorized('Phone number does not match this order');
  }

  return order;
}

export async function getOrderForCustomer(userId: string, orderNumber: string) {
  const order = await Order.findOne({ orderNumber, user: new Types.ObjectId(userId) });

  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  return order;
}

export async function updateOrderStatus(
  orderNumber: string,
  input: UpdateOrderStatusInput,
  changedBy?: string,
) {
  const order = await Order.findOne({ orderNumber });

  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  if (input.status !== order.status) {
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];

    if (!allowed.includes(input.status)) {
      throw ApiError.badRequest(`Cannot move an order from ${order.status} to ${input.status}`);
    }
  }

  if (input.status === 'cancelled') {
    for (const item of order.items) {
      await releaseStock([
        {
          productId: item.product,
          variantSku: item.variantSku,
          quantity: item.quantity,
          usesVariants: Boolean(item.variantSku),
        },
      ]);
    }

    order.cancelledAt = new Date();
    order.cancelReason = input.cancelReason ?? input.note ?? 'Cancelled by store';
  }

  if (input.tracking) {
    order.tracking = { ...order.tracking, ...input.tracking };

    if (input.tracking.trackingNumber) {
      order.tracking.shippedAt = order.tracking.shippedAt ?? new Date();
    }
  }

  if (input.status === 'delivered') {
    order.tracking.deliveredAt = new Date();
  }

  if (input.paymentStatus) {
    order.payment.status = input.paymentStatus;

    if (input.paymentStatus === 'paid') {
      order.payment.paidAt = order.payment.paidAt ?? new Date();
    }
  }

  if (input.adminNote !== undefined) {
    order.adminNote = input.adminNote;
  }

  order.status = input.status;
  order.statusHistory.push({
    status: input.status,
    note: input.note,
    changedBy: changedBy ? new Types.ObjectId(changedBy) : undefined,
    changedAt: new Date(),
  });

  await order.save();

  return order;
}

export async function cancelOrderByCustomer(
  userId: string,
  orderNumber: string,
  reason?: string,
) {
  const order = await Order.findOne({ orderNumber, user: new Types.ObjectId(userId) });

  if (!order) {
    throw ApiError.notFound('Order not found');
  }

  if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
    throw ApiError.badRequest('This order can no longer be cancelled. Please contact support.');
  }

  return updateOrderStatus(
    orderNumber,
    { status: 'cancelled', cancelReason: reason ?? 'Cancelled by customer' },
    userId,
  );
}
