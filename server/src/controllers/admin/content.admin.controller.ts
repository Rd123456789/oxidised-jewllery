import { Types, type QueryFilter } from 'mongoose';
import type { Request, Response } from 'express';
import { Banner } from '../../models/banner.model.js';
import { Coupon } from '../../models/coupon.model.js';
import { Newsletter } from '../../models/newsletter.model.js';
import { Page } from '../../models/page.model.js';
import { Review, recalculateProductRating } from '../../models/review.model.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../../utils/http.js';
import { buildPaginationMeta, buildSort, parsePagination, toBoolean } from '../../utils/query.js';
import { ensureUniqueSlug } from '../../utils/slug.js';
import { getSettings, updateSettings } from '../../services/settings.service.js';
import type { BannerCreateInput, CouponCreateInput, PageCreateInput } from '../../validators/content.validator.js';

export const listCoupons = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.validatedQuery ?? {});
  const filter: QueryFilter<typeof Coupon> = {};

  const active = toBoolean(req.validatedQuery?.['active']);
  if (active !== undefined) {
    filter.isActive = active;
  }

  const [coupons, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Coupon.countDocuments(filter),
  ]);

  sendSuccess(res, coupons, { meta: buildPaginationMeta(total, pagination) });
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CouponCreateInput;
  const existing = await Coupon.findOne({ code: input.code });

  if (existing) {
    throw ApiError.conflict('A coupon with this code already exists');
  }

  const coupon = await Coupon.create(input);

  sendSuccess(res, coupon, { status: 201, message: 'Coupon created' });
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await Coupon.findByIdAndUpdate(
    req.params['id'],
    { $set: req.body },
    { returnDocument: 'after', runValidators: true },
  );

  if (!coupon) {
    throw ApiError.notFound('Coupon not found');
  }

  sendSuccess(res, coupon, { message: 'Coupon updated' });
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await Coupon.findByIdAndDelete(req.params['id']);

  if (!coupon) {
    throw ApiError.notFound('Coupon not found');
  }

  sendSuccess(res, { deleted: true });
});

export const listBanners = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await Banner.find().sort({ position: 1, sortOrder: 1, createdAt: -1 }).lean();

  sendSuccess(res, banners);
});

export const createBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.create({
    ...(req.body as BannerCreateInput),
    createdBy: req.auth?.userId,
  });

  sendSuccess(res, banner, { status: 201, message: 'Banner created' });
});

export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findByIdAndUpdate(
    req.params['id'],
    { $set: req.body },
    { returnDocument: 'after', runValidators: true },
  );

  if (!banner) {
    throw ApiError.notFound('Banner not found');
  }

  sendSuccess(res, banner, { message: 'Banner updated' });
});

export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
  const banner = await Banner.findByIdAndDelete(req.params['id']);

  if (!banner) {
    throw ApiError.notFound('Banner not found');
  }

  sendSuccess(res, { deleted: true });
});

export const listPages = asyncHandler(async (_req: Request, res: Response) => {
  const pages = await Page.find().sort({ sortOrder: 1, title: 1 }).lean();

  sendSuccess(res, pages);
});

export const createPage = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as PageCreateInput;

  const page = await Page.create({
    ...input,
    slug: await ensureUniqueSlug(Page, input.slug ?? input.title),
  });

  sendSuccess(res, page, { status: 201, message: 'Page created' });
});

export const updatePage = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as Partial<PageCreateInput>;
  const page = await Page.findById(req.params['id']);

  if (!page) {
    throw ApiError.notFound('Page not found');
  }

  if (input.slug && input.slug !== page.slug) {
    input.slug = await ensureUniqueSlug(Page, input.slug, String(page._id));
  }

  Object.assign(page, input);
  await page.save();

  sendSuccess(res, page, { message: 'Page updated' });
});

export const deletePage = asyncHandler(async (req: Request, res: Response) => {
  const page = await Page.findByIdAndDelete(req.params['id']);

  if (!page) {
    throw ApiError.notFound('Page not found');
  }

  sendSuccess(res, { deleted: true });
});

export const listReviews = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.validatedQuery ?? {});
  const query = req.validatedQuery ?? {};
  const filter: QueryFilter<typeof Review> = {};

  const status = query['status'] as string | undefined;
  if (status && status !== 'all') {
    filter.status = status;
  }
  if (query['productId']) {
    filter.product = query['productId'];
  }
  if (query['rating']) {
    filter.rating = query['rating'];
  }

  const sort = buildSort(query['sort'] as string | undefined, ['createdAt', 'rating'], {
    createdAt: -1,
  });

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('product', 'name slug')
      .populate('user', 'name email')
      .lean(),
    Review.countDocuments(filter),
  ]);

  sendSuccess(res, reviews, { meta: buildPaginationMeta(total, pagination) });
});

export const moderateReview = asyncHandler(async (req: Request, res: Response) => {
  const { status, adminReply } = req.body as { status: 'pending' | 'approved' | 'rejected'; adminReply?: string };

  const review = await Review.findById(req.params['id']);

  if (!review) {
    throw ApiError.notFound('Review not found');
  }

  review.status = status;

  if (adminReply) {
    review.adminReply = {
      message: adminReply,
      repliedAt: new Date(),
      repliedBy: req.auth ? new Types.ObjectId(req.auth.userId) : undefined,
    };
  }

  await review.save();
  await recalculateProductRating(review.product);

  sendSuccess(res, review, { message: `Review ${status}` });
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await Review.findByIdAndDelete(req.params['id']);

  if (!review) {
    throw ApiError.notFound('Review not found');
  }

  await recalculateProductRating(review.product);

  sendSuccess(res, { deleted: true });
});

export const readSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();

  sendSuccess(res, settings);
});

export const writeSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await updateSettings(req.body, req.auth?.userId);

  sendSuccess(res, settings, { message: 'Settings saved' });
});

export const listSubscribers = asyncHandler(async (req: Request, res: Response) => {
  const pagination = parsePagination(req.validatedQuery ?? {});
  const query = req.validatedQuery ?? {};
  const filter: QueryFilter<typeof Newsletter> = {};

  const subscribed = toBoolean(query['isSubscribed']);
  if (subscribed !== undefined) {
    filter.isSubscribed = subscribed;
  }

  const [subscribers, total] = await Promise.all([
    Newsletter.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    Newsletter.countDocuments(filter),
  ]);

  sendSuccess(res, subscribers, { meta: buildPaginationMeta(total, pagination) });
});

export const deleteSubscriber = asyncHandler(async (req: Request, res: Response) => {
  await Newsletter.findByIdAndDelete(req.params['id']);

  sendSuccess(res, { deleted: true });
});
