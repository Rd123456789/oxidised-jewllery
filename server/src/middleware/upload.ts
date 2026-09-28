import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { cloudinaryEnabled, uploadImageBuffer, type UploadedAsset } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: env.uploadMaxFileSizeBytes,
    files: 8,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(ApiError.badRequest(`Unsupported file type: ${file.mimetype}. Use JPEG, PNG, WebP or AVIF`));
      return;
    }

    callback(null, true);
  },
});

async function persistLocally(file: Express.Multer.File, folder: string): Promise<UploadedAsset> {
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '');
  const targetDir = path.join(LOCAL_UPLOAD_DIR, safeFolder);

  await fs.mkdir(targetDir, { recursive: true });

  const extension = path.extname(file.originalname) || '.jpg';
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  const filePath = path.join(targetDir, fileName);

  await fs.writeFile(filePath, file.buffer);

  const relative = `/uploads/${safeFolder ? `${safeFolder}/` : ''}${fileName}`;

  return {
    url: relative,
    secureUrl: relative,
    publicId: relative,
    bytes: file.size,
    format: extension.replace('.', ''),
  };
}

export async function persistUploads(
  files: Express.Multer.File[],
  folder = env.CLOUDINARY_FOLDER,
): Promise<UploadedAsset[]> {
  if (files.length === 0) {
    return [];
  }

  const results: UploadedAsset[] = [];

  for (const file of files) {
    if (cloudinaryEnabled) {
      results.push(await uploadImageBuffer(file.buffer, folder));
    } else {
      results.push(await persistLocally(file, folder));
    }
  }

  logger.debug(`Stored ${results.length} upload(s) in ${cloudinaryEnabled ? 'Cloudinary' : 'local disk'}`);

  return results;
}

export function firstFile(req: { file?: Express.Multer.File }): Express.Multer.File | undefined {
  return req.file;
}

export function requestFiles(req: { files?: Express.Multer.File[] | { [field: string]: Express.Multer.File[] } }): Express.Multer.File[] {
  if (!req.files) {
    return [];
  }

  if (Array.isArray(req.files)) {
    return req.files;
  }

  return Object.values(req.files).flat();
}
