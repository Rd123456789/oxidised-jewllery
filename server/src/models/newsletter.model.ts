import { Schema, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

export interface NewsletterDocument {
  email: string;
  isSubscribed: boolean;
  source?: string;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NewsletterHydratedDocument = HydratedDocument<NewsletterDocument>;

const newsletterSchema = new Schema<NewsletterDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    isSubscribed: { type: Boolean, default: true, index: true },
    source: { type: String, trim: true, maxlength: 80, default: 'footer' },
    unsubscribedAt: { type: Date },
  },
  schemaOptions,
);

export const Newsletter = model<NewsletterDocument>('Newsletter', newsletterSchema);
