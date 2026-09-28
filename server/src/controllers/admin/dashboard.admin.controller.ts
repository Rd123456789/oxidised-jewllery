import { Types } from 'mongoose';
import type { Request, Response } from 'express';
import { cloudinaryEnabled, destroyImage } from '../../config/cloudinary.js';
import { env } from '../../config/env.js';
import { Order } from '../../models/order.model.js';
import { Product } from '../../models/product.model.js';
import { User } from '../../models/user.model.js';
import { persistUploads, requestFiles, upload } from '../../middleware/upload.js';
import { getDashboardStats } from '../../services/dashboard.service.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../../utils/http.js';

export const uploadMiddleware = upload.array('images', 8);

export const stats = asyncHandler(async (req: Request, res: Response) => {
  const rangeDays = Math.min(Number(req.query['days'] ?? 30) || 30, 365);
  const stats = await getDashboardStats(rangeDays);

  sendSuccess(res, stats);
});

export const uploadImages = asyncHandler(async (req: Request, res: Response) => {
  const files = requestFiles(req);
  const folder = `oxidised-jewellery/${(req.query['folder'] as string) ?? 'products'}`;

  const assets = await persistUploads(files, folder);

  sendSuccess(res, {
    provider: cloudinaryEnabled ? 'cloudinary' : 'local',
    maxFileSizeMb: env.UPLOAD_MAX_FILE_SIZE_MB,
    assets: assets.map((asset) => ({
      url: asset.secureUrl,
      publicId: asset.publicId,
      width: asset.width,
      height: asset.height,
      format: asset.format,
      bytes: asset.bytes,
    })),
  }, { status: 201 });
});

export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const publicId = (req.body as { publicId?: string }).publicId;

  if (!publicId) {
    throw ApiError.badRequest('publicId is required');
  }

  const result = await destroyImage(publicId);

  sendSuccess(res, {
    deleted: result.result === 'ok',
    result: result.result,
  });
});

export const inventoryReport = asyncHandler(async (_req: Request, res: Response) => {
  const products = await Product.find({ isActive: true })
    .sort({ stock: 1 })
    .limit(100)
    .select('name sku stock lowStockThreshold price images variants category')
    .populate('category', 'name')
    .lean();

  sendSuccess(
    res,
    products.map((product) => ({
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      price: product.price,
      category: product.category,
      variantCount: product.variants?.length ?? 0,
      lowStock: product.stock <= product.lowStockThreshold,
    })),
  );
});

export const customerSummary = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params['id'] as string;

  const [user, orderStats, recentOrders] = await Promise.all([
    User.findById(userId).lean(),
    Order.aggregate<{ count: number; spend: number }>([
      { $match: { user: new Types.ObjectId(userId) } },
      { $group: { _id: null, count: { $sum: 1 }, spend: { $sum: '$pricing.total' } } },
    ]),
    Order.find({ user: userId }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  if (!user) {
    throw ApiError.notFound('Customer not found');
  }

  const stats = orderStats[0];

  sendSuccess(res, {
    customer: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      marketingOptIn: user.marketingOptIn,
      addresses: user.addresses,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    orderCount: stats?.count ?? 0,
    lifetimeValue: Math.round(stats?.spend ?? 0),
    recentOrders,
  });
});
