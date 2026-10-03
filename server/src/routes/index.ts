import { Router } from 'express';
import authRoutes from './auth.routes.js';
import catalogRoutes from './catalog.routes.js';
import cartRoutes from './cart.routes.js';
import orderRoutes from './order.routes.js';
import contentRoutes from './content.routes.js';
import chatRoutes from './chat.routes.js';
import adminRoutes from './admin/index.js';
import portfolioRoutes from './portfolio.routes.js';
import { databaseStatus } from '../config/db.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: databaseStatus(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/', catalogRoutes);
router.use('/', cartRoutes);
router.use('/', orderRoutes);
router.use('/', contentRoutes);
router.use('/', chatRoutes);
router.use('/admin', adminRoutes);
router.use('/portfolio', portfolioRoutes);

export default router;
