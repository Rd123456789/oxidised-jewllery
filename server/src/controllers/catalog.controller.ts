import { Types, type QueryFilter } from 'mongoose';
import type { Request, Response } from 'express';
import { Banner, type BannerDocument, type BannerPosition } from '../models/banner.model.js';
import { Product } from '../models/product.model.js';
import { Review } from '../models/review.model.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import * as catalogService from '../services/catalog.service.js';
import type { ProductQueryInput } from '../validators/catalog.validator.js';

function query(req: Request): ProductQueryInput {
  return (req.validatedQuery ?? {}) as ProductQueryInput;
}

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.listProducts(query(req));

  sendSuccess(res, result.items, { meta: result.meta });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await catalogService.getProductBySlug(req.params['slug'] as string);

  sendSuccess(res, product);
});

export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query['limit'] ?? 8) || 8, 16);
  const products = await catalogService.getRelatedProducts(req.params['slug'] as string, limit);

  sendSuccess(res, products);
});

export const suggest = asyncHandler(async (req: Request, res: Response) => {
  const input = (req.validatedQuery ?? {}) as { q: string; limit?: number };
  const suggestions = await catalogService.suggestSearch(input.q, input.limit ?? 6);

  res.set('Cache-Control', 'public, max-age=60');

  sendSuccess(res, suggestions);
});

export const getFacets = asyncHandler(async (req: Request, res: Response) => {
  const facets = await catalogService.getProductFacets(req.query['category'] as string | undefined);

  sendSuccess(res, facets);
});

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await catalogService.listCategories();

  sendSuccess(res, categories);
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.getCategoryBySlug(req.params['slug'] as string);

  sendSuccess(res, result);
});

export const listCollections = asyncHandler(async (_req: Request, res: Response) => {
  const collections = await catalogService.listCollections();

  sendSuccess(res, collections);
});

export const getCollection = asyncHandler(async (req: Request, res: Response) => {
  const result = await catalogService.getCollectionBySlug(req.params['slug'] as string);

  sendSuccess(res, result);
});

export const listProductReviews = asyncHandler(async (req: Request, res: Response) => {
  const reference = req.params['id'] as string;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(reference);

  let productId = reference;

  if (!isObjectId) {
    const product = await Product.findOne({ slug: reference }).select('_id');

    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    productId = String(product._id);
  }

  const reviews = await Review.find({ product: productId, status: 'approved' })
    .sort({ createdAt: -1 })
    .limit(50)
    .select('rating title body images authorName isVerifiedPurchase helpfulCount adminReply createdAt')
    .lean();

  const summary = await Review.aggregate<{ average: number; count: number; breakdown: Record<string, number> }>([
    { $match: { product: new Types.ObjectId(productId), status: 'approved' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  sendSuccess(res, {
    reviews,
    summary: {
      average: Number((summary[0]?.average ?? 0).toFixed(1)),
      count: summary[0]?.count ?? 0,
      breakdown: reviews.reduce<Record<string, number>>((accumulator, review) => {
        const key = String(review.rating);
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {}),
    },
  });
});

export const listBanners = asyncHandler(async (req: Request, res: Response) => {
  const position = req.query['position'] as BannerPosition | undefined;
  const now = new Date();

  const filter = {
    isActive: true,
    ...(position ? { position } : {}),
    $and: [
      {
        $or: [
          { startsAt: { $exists: false } },
          { startsAt: null },
          { startsAt: { $lte: now } },
        ],
      },
      {
        $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }],
      },
    ],
  } as unknown as QueryFilter<BannerDocument>;

  const banners = await Banner.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();

  sendSuccess(res, banners);
});

export const getProductByIdForAdminPreview = asyncHandler(async (req: Request, res: Response) => {
  const product = await catalogService.getProductById(req.params['id'] as string);

  if (!product.isActive) {
    throw ApiError.notFound('Product not found');
  }

  sendSuccess(res, product);
});
