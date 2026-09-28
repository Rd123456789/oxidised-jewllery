import type { Request, Response } from 'express';
import { Newsletter } from '../models/newsletter.model.js';
import { Page } from '../models/page.model.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import { getSettings, toPublicSettings } from '../services/settings.service.js';

export const getPublicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();

  sendSuccess(res, toPublicSettings(settings));
});

export const getPage = asyncHandler(async (req: Request, res: Response) => {
  const page = await Page.findOne({
    slug: req.params['slug'] as string,
    isPublished: true,
  }).lean();

  if (!page) {
    throw ApiError.notFound('Page not found');
  }

  sendSuccess(res, page);
});

export const listFooterPages = asyncHandler(async (_req: Request, res: Response) => {
  const pages = await Page.find({ isPublished: true, showInFooter: true })
    .sort({ sortOrder: 1, title: 1 })
    .select('title slug sortOrder')
    .lean();

  sendSuccess(res, pages);
});

export const listHeaderPages = asyncHandler(async (_req: Request, res: Response) => {
  const pages = await Page.find({ isPublished: true, showInHeader: true })
    .sort({ sortOrder: 1, title: 1 })
    .select('title slug sortOrder')
    .lean();

  sendSuccess(res, pages);
});

export const subscribeNewsletter = asyncHandler(async (req: Request, res: Response) => {
  const { email, source } = req.body as { email: string; source?: string };

  const subscriber = await Newsletter.findOneAndUpdate(
    { email },
    { $set: { isSubscribed: true, source: source ?? 'footer' }, $unset: { unsubscribedAt: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  );

  sendSuccess(res, { email: subscriber.email }, { status: 201, message: 'You are on the list' });
});

export const unsubscribeNewsletter = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };

  await Newsletter.updateOne(
    { email },
    { $set: { isSubscribed: false, unsubscribedAt: new Date() } },
  );

  sendSuccess(res, { unsubscribed: true });
});
