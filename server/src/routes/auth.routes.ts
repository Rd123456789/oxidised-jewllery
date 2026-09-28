import { Router } from 'express';
import { env } from '../config/env.js';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import * as schema from '../validators/auth.validator.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: schema.registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: schema.loginSchema }), controller.login);
router.post('/admin/login', authLimiter, validate({ body: schema.loginSchema }), controller.adminLogin);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: schema.forgotPasswordSchema }),
  controller.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: schema.resetPasswordSchema }),
  controller.resetPassword,
);

router.get('/me', authenticate(), controller.me);
router.patch('/me', authenticate(), validate({ body: schema.updateProfileSchema }), controller.updateMe);
router.post(
  '/change-password',
  authenticate(),
  authLimiter,
  validate({ body: schema.changePasswordSchema }),
  controller.changePassword,
);

router.get('/addresses', authenticate(), controller.listAddresses);
router.post(
  '/addresses',
  authenticate(),
  writeLimiter,
  validate({ body: schema.addAddressSchema }),
  controller.addAddress,
);
router.patch(
  '/addresses/:id',
  authenticate(),
  writeLimiter,
  validate({ params: idParamSchema, body: schema.updateAddressSchema }),
  controller.updateAddress,
);
router.delete(
  '/addresses/:id',
  authenticate(),
  writeLimiter,
  validate({ params: idParamSchema }),
  controller.deleteAddress,
);
router.put(
  '/addresses/:id/default',
  authenticate(),
  writeLimiter,
  validate({ params: idParamSchema }),
  controller.setDefaultAddress,
);

if (!env.isProduction) {
  router.get('/session-debug', controller.sessionDebug);
}

export default router;
