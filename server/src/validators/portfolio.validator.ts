import { z } from 'zod';

export const contactInquirySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().email('Please provide a valid email address'),
  message: z.string().trim().min(20, 'Message must be at least 20 characters').max(5000),
  source: z.string().trim().optional(),
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;
