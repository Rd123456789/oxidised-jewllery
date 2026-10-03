import { Router } from 'express';
import { submitContactInquiry, getPortfolioCv } from '../controllers/portfolio.controller.js';
import { validate } from '../middleware/validate.js';
import { contactInquirySchema } from '../validators/portfolio.validator.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/contact', writeLimiter, validate({ body: contactInquirySchema }), submitContactInquiry);
router.get('/cv', getPortfolioCv);
router.get('/resume', getPortfolioCv);

export default router;
