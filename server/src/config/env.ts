import 'dotenv/config';
import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('/api/v1'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required (MongoDB Atlas connection string)'),
  MONGODB_DB_NAME: optionalString,

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  COOKIE_SECRET: z.string().min(8).default('dev-cookie-secret-change-me'),
  COOKIE_DOMAIN: optionalString,
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(400),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(25),

  /** Override when the storefront build is not at `web/dist/web/browser` relative to the repo. */
  WEB_DIST_DIR: optionalString,

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_FOLDER: z.string().default('oxidised-jewellery'),
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),

  SEED_ADMIN_NAME: z.string().default('Store Admin'),
  SEED_ADMIN_EMAIL: z.string().default('admin@oxidisedjewellery.test'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@12345'),
  SEED_CUSTOMER_EMAIL: z.string().default('customer@oxidisedjewellery.test'),
  SEED_CUSTOMER_PASSWORD: z.string().default('Customer@12345'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  console.error(
    [
      '',
      'Invalid environment configuration:',
      issues,
      '',
      'Copy server/.env.example to server/.env and fill in the values.',
      'For MongoDB Atlas, create a free M0 cluster and paste the connection string into MONGODB_URI.',
      '',
    ].join('\n'),
  );

  process.exit(1);
}

const value = parsed.data;

const cloudinaryEnabled = Boolean(
  value.CLOUDINARY_CLOUD_NAME && value.CLOUDINARY_API_KEY && value.CLOUDINARY_API_SECRET,
);

export const env = {
  ...value,
  isProduction: value.NODE_ENV === 'production',
  isDevelopment: value.NODE_ENV === 'development',
  isTest: value.NODE_ENV === 'test',
  corsOrigins: value.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cloudinaryEnabled,
  uploadMaxFileSizeBytes: Math.round(value.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024),
} as const;

export type Env = typeof env;
