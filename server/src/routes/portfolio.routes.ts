import { Router } from 'express';
import {
  submitContactInquiry,
  getPortfolioCv,
  portfolioAdminLogin,
  requirePortfolioAdmin,
  listPortfolioInquiries,
  markPortfolioInquiryRead,
  deletePortfolioInquiry,
} from '../controllers/portfolio.controller.js';
import { validate } from '../middleware/validate.js';
import { contactInquirySchema } from '../validators/portfolio.validator.js';
import { authLimiter, writeLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Public routes
router.post('/contact', writeLimiter, validate({ body: contactInquirySchema }), submitContactInquiry);
router.get('/cv', getPortfolioCv);
router.get('/resume', getPortfolioCv);

// Admin routes
router.post('/admin/login', authLimiter, portfolioAdminLogin);
router.get('/admin/inquiries', requirePortfolioAdmin, listPortfolioInquiries);
router.patch('/admin/inquiries/:id/read', requirePortfolioAdmin, markPortfolioInquiryRead);
router.delete('/admin/inquiries/:id', requirePortfolioAdmin, deletePortfolioInquiry);

export default router;
