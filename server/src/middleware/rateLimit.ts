import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
};

export const generalLimiter = rateLimit({
  ...base,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please slow down' },
  },
});

export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts, try again in a few minutes',
    },
  },
});

export const writeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 60,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many write requests, please slow down' },
  },
});
