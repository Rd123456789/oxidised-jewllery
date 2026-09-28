import { Router } from 'express';
import * as controller from '../controllers/content.controller.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { slugParamSchema } from '../validators/common.validator.js';
import { newsletterSubscribeSchema } from '../validators/content.validator.js';
import { z } from 'zod';
import { emailSchema } from '../validators/common.validator.js';

const router = Router();

router.get('/settings/public', controller.getPublicSettings);

router.get('/pages', controller.listFooterPages);
router.get('/pages/header', controller.listHeaderPages);
router.get('/pages/:slug', validate({ params: slugParamSchema }), controller.getPage);

router.post(
  '/newsletter/subscribe',
  writeLimiter,
  validate({ body: newsletterSubscribeSchema }),
  controller.subscribeNewsletter,
);
router.post(
  '/newsletter/unsubscribe',
  writeLimiter,
  validate({ body: z.object({ email: emailSchema }) }),
  controller.unsubscribeNewsletter,
);

export default router;
