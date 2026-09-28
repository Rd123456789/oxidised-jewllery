import { Router } from 'express';
import * as controller from '../../controllers/admin/content.admin.controller.js';
import * as dashboard from '../../controllers/admin/dashboard.admin.controller.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../validators/common.validator.js';
import {
  bannerCreateSchema,
  bannerUpdateSchema,
  couponCreateSchema,
  couponQuerySchema,
  couponUpdateSchema,
  pageCreateSchema,
  pageUpdateSchema,
  reviewModerationSchema,
  reviewQuerySchema,
  settingsUpdateSchema,
} from '../../validators/content.validator.js';
import { z } from 'zod';

const router = Router();

router.get('/dashboard/stats', dashboard.stats);
router.get('/dashboard/inventory', dashboard.inventoryReport);
router.post('/uploads', dashboard.uploadMiddleware, dashboard.uploadImages);
router.delete('/uploads', dashboard.deleteImage);

router.get('/coupons', validate({ query: couponQuerySchema }), controller.listCoupons);
router.post('/coupons', validate({ body: couponCreateSchema }), controller.createCoupon);
router.put(
  '/coupons/:id',
  validate({ params: idParamSchema, body: couponUpdateSchema }),
  controller.updateCoupon,
);
router.delete('/coupons/:id', validate({ params: idParamSchema }), controller.deleteCoupon);

router.get('/banners', controller.listBanners);
router.post('/banners', validate({ body: bannerCreateSchema }), controller.createBanner);
router.put(
  '/banners/:id',
  validate({ params: idParamSchema, body: bannerUpdateSchema }),
  controller.updateBanner,
);
router.delete('/banners/:id', validate({ params: idParamSchema }), controller.deleteBanner);

router.get('/pages', controller.listPages);
router.post('/pages', validate({ body: pageCreateSchema }), controller.createPage);
router.put(
  '/pages/:id',
  validate({ params: idParamSchema, body: pageUpdateSchema }),
  controller.updatePage,
);
router.delete('/pages/:id', validate({ params: idParamSchema }), controller.deletePage);

router.get('/reviews', validate({ query: reviewQuerySchema }), controller.listReviews);
router.patch(
  '/reviews/:id',
  validate({ params: idParamSchema, body: reviewModerationSchema }),
  controller.moderateReview,
);
router.delete('/reviews/:id', validate({ params: idParamSchema }), controller.deleteReview);

router.get('/settings', controller.readSettings);
router.put('/settings', validate({ body: settingsUpdateSchema }), controller.writeSettings);

router.get(
  '/newsletter',
  validate({
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      isSubscribed: z.string().optional(),
    }),
  }),
  controller.listSubscribers,
);
router.delete('/newsletter/:id', validate({ params: idParamSchema }), controller.deleteSubscriber);

export default router;
