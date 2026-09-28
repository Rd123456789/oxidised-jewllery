import { Types } from 'mongoose';
import { Newsletter } from '../models/newsletter.model.js';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.model.js';
import { Review } from '../models/review.model.js';
import { User } from '../models/user.model.js';
import { getSettings } from './settings.service.js';

export interface DashboardTopProduct {
  id: string;
  name: string;
  slug: string;
  image?: string;
  quantity: number;
  revenue: number;
}

export interface DashboardStats {
  revenue: { total: number; averageOrderValue: number; currency: string };
  orders: { total: number; pending: number; byStatus: { status: string; count: number }[] };
  customers: { total: number; newInRange: number };
  catalogue: { products: number; lowStock: number; outOfStock: number };
  reviews: { pending: number };
  newsletter: { subscribers: number };
  recentOrders: unknown[];
  topProducts: DashboardTopProduct[];
  salesSeries: { date: string; revenue: number; orders: number }[];
}

const ACTIVE_ORDER_STATUSES = { $nin: ['cancelled', 'returned'] };

export async function getDashboardStats(rangeDays = 30): Promise<DashboardStats> {
  const settings = await getSettings();
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const [
    revenueAggregation,
    orderCount,
    pendingOrders,
    statusBreakdown,
    customerCount,
    newCustomers,
    productCount,
    lowStockCount,
    outOfStockCount,
    pendingReviews,
    subscriberCount,
    recentOrders,
    topProducts,
    salesSeries,
  ] = await Promise.all([
    Order.aggregate<{ total: number; average: number }>([
      { $match: { status: ACTIVE_ORDER_STATUSES } },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.total' },
          average: { $avg: '$pricing.total' },
        },
      },
    ]),
    Order.countDocuments({}),
    Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'processing', 'packed'] } }),
    Order.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'customer', createdAt: { $gte: since } }),
    Product.countDocuments({}),
    Product.countDocuments({ isActive: true, stock: { $lte: settings.lowStockThreshold } }),
    Product.countDocuments({ isActive: true, stock: { $lte: 0 } }),
    Review.countDocuments({ status: 'pending' }),
    Newsletter.countDocuments({ isSubscribed: true }),
    Order.find().sort({ createdAt: -1 }).limit(8).lean(),
    Order.aggregate<{
      _id: Types.ObjectId;
      name: string;
      slug: string;
      image?: string;
      quantity: number;
      revenue: number;
    }>([
      { $match: { status: ACTIVE_ORDER_STATUSES } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          slug: { $first: '$items.slug' },
          image: { $first: '$items.image' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 6 },
    ]),
    Order.aggregate<{ _id: string; revenue: number; orders: number }>([
      { $match: { createdAt: { $gte: since }, status: ACTIVE_ORDER_STATUSES } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$pricing.total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const revenue = revenueAggregation[0];

  return {
    revenue: {
      total: Math.round(revenue?.total ?? 0),
      averageOrderValue: Math.round(revenue?.average ?? 0),
      currency: settings.currency,
    },
    orders: {
      total: orderCount,
      pending: pendingOrders,
      byStatus: statusBreakdown.map((entry) => ({ status: entry._id, count: entry.count })),
    },
    customers: { total: customerCount, newInRange: newCustomers },
    catalogue: {
      products: productCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
    },
    reviews: { pending: pendingReviews },
    newsletter: { subscribers: subscriberCount },
    recentOrders,
    topProducts: topProducts.map((entry) => ({
      id: String(entry._id),
      name: entry.name,
      slug: entry.slug,
      image: entry.image,
      quantity: entry.quantity,
      revenue: entry.revenue,
    })),
    salesSeries: salesSeries.map((entry) => ({
      date: entry._id,
      revenue: Math.round(entry.revenue),
      orders: entry.orders,
    })),
  };
}
