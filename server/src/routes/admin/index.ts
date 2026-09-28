import { Router } from 'express';
import catalogRoutes from './catalog.routes.js';
import orderRoutes from './orders.routes.js';
import contentRoutes from './content.routes.js';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();

router.use(requireAdmin());

router.use('/', catalogRoutes);
router.use('/', orderRoutes);
router.use('/', contentRoutes);

export default router;
