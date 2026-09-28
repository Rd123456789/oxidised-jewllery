import { Types, type QueryFilter } from 'mongoose';
import type { Request, Response } from 'express';
import { Order, type OrderDocument } from '../../models/order.model.js';
import { User } from '../../models/user.model.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../../utils/http.js';
import { buildPaginationMeta, buildSort, escapeRegex, parsePagination, toBoolean } from '../../utils/query.js';
import { getOrderByNumber, listAdminOrders, updateOrderStatus } from '../../services/order.service.js';
import type { z } from 'zod';
import type { orderQuerySchema } from '../../validators/order.validator.js';

function orderQuery(req: Request): z.infer<typeof orderQuerySchema> {
  return (req.validatedQuery ?? {}) as z.infer<typeof orderQuerySchema>;
}

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const result = await listAdminOrders(orderQuery(req));

  sendSuccess(res, result.orders, { meta: result.meta });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await getOrderByNumber(req.params['orderNumber'] as string);

  sendSuccess(res, order);
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await updateOrderStatus(
    req.params['orderNumber'] as string,
    req.body,
    req.auth?.userId,
  );

  sendSuccess(res, order, { message: `Order marked as ${order.status}` });
});

export const orderStats = asyncHandler(async (_req: Request, res: Response) => {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [today, week, month, byStatus, byPayment] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: dayAgo } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: weekAgo }, status: { $nin: ['cancelled', 'returned'] } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: monthAgo }, status: { $nin: ['cancelled', 'returned'] } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: '$payment.method', count: { $sum: 1 } } }]),
  ]);

  sendSuccess(res, {
    today: { count: today[0]?.count ?? 0, revenue: Math.round(today[0]?.revenue ?? 0) },
    week: { count: week[0]?.count ?? 0, revenue: Math.round(week[0]?.revenue ?? 0) },
    month: { count: month[0]?.count ?? 0, revenue: Math.round(month[0]?.revenue ?? 0) },
    byStatus: byStatus.map((entry) => ({ status: entry._id, count: entry.count })),
    byPaymentMethod: byPayment.map((entry) => ({ method: entry._id, count: entry.count })),
  });
});

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.validatedQuery ?? {});
  const query = req.validatedQuery ?? {};
  const filter: QueryFilter<typeof User> = {};

  if (query['role']) {
    filter.role = query['role'];
  }

  const active = toBoolean(query['active']);
  if (active !== undefined) {
    filter.isActive = active;
  }

  if (query['q']) {
    const term = String(query['q']);
    filter.$or = [
      { name: new RegExp(escapeRegex(term), 'i') },
      { email: new RegExp(escapeRegex(term), 'i') },
      { phone: new RegExp(escapeRegex(term), 'i') },
    ];
  }

  const sort = buildSort(query['sort'] as string | undefined, ['createdAt', 'name', 'lastLoginAt'], {
    createdAt: -1,
  });

  const [customers, total] = await Promise.all([
    User.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
    User.countDocuments(filter),
  ]);

  const spendByUser = await Order.aggregate<{ _id: Types.ObjectId; spend: number; orders: number }>([
    { $match: { user: { $in: customers.map((customer) => customer._id) } } },
    {
      $group: {
        _id: '$user',
        spend: { $sum: '$pricing.total' },
        orders: { $sum: 1 },
      },
    },
  ]);

  const spendMap = new Map(
    spendByUser.map((entry) => [String(entry._id), entry] as const),
  );

  sendSuccess(
    res,
    customers.map((customer) => {
      const stats = spendMap.get(String(customer._id));

      return {
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: customer.role,
        isActive: customer.isActive,
        marketingOptIn: customer.marketingOptIn,
        createdAt: customer.createdAt,
        lastLoginAt: customer.lastLoginAt,
        orderCount: stats?.orders ?? 0,
        lifetimeValue: Math.round(stats?.spend ?? 0),
      };
    }),
    { meta: buildPaginationMeta(total, pagination) },
  );
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await User.findById(req.params['id']).lean();

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  const orders = await Order.find({ user: customer._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('orderNumber status pricing placedAt items')
    .lean();

  const lifetimeValue = orders.reduce((total, order) => total + order.pricing.total, 0);

  sendSuccess(res, {
    customer: {
      id: String(customer._id),
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      role: customer.role,
      isActive: customer.isActive,
      marketingOptIn: customer.marketingOptIn,
      addresses: customer.addresses,
      createdAt: customer.createdAt,
      lastLoginAt: customer.lastLoginAt,
    },
    stats: {
      orderCount: orders.length,
      lifetimeValue: Math.round(lifetimeValue),
    },
    orders,
  });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await User.findByIdAndUpdate(
    req.params['id'],
    { $set: req.body },
    { returnDocument: 'after', runValidators: true },
  );

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  sendSuccess(res, customer, { message: 'Customer updated' });
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params['id'];

  if (id === req.auth?.userId) {
    throw ApiError.badRequest('You cannot delete your own account');
  }

  const customer = await User.findById(id);

  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  if (customer.role !== 'customer') {
    throw ApiError.badRequest('Admin and manager accounts cannot be deleted here');
  }

  await customer.deleteOne();

  sendSuccess(res, { deleted: true });
});

export const exportOrders = asyncHandler(async (req: Request, res: Response) => {
  const result = await listAdminOrders({ ...orderQuery(req), limit: 100 } as z.infer<
    typeof orderQuerySchema
  >);

  const header = 'Order,Customer,Phone,Status,Payment,Total,Placed\n';

  const rows = (result.orders as (OrderDocument & { _id: unknown })[])
    .map((order) =>
      [
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        order.status,
        order.payment.status,
        order.pricing.total,
        order.placedAt?.toISOString() ?? '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  res.send(header + rows);
});
