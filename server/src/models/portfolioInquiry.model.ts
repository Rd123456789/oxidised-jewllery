import { Schema, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

export interface PortfolioInquiryDocument {
  name: string;
  email: string;
  message: string;
  source?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PortfolioInquiryHydratedDocument = HydratedDocument<PortfolioInquiryDocument>;

const portfolioInquirySchema = new Schema<PortfolioInquiryDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    source: { type: String, trim: true, default: 'portfolio-3d' },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  schemaOptions,
);

export const PortfolioInquiry = model<PortfolioInquiryDocument>(
  'PortfolioInquiry',
  portfolioInquirySchema,
);
