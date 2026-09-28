import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

export interface UploadedAsset {
  url: string;
  secureUrl: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export const cloudinaryEnabled = env.cloudinaryEnabled;

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  logger.info(`Cloudinary enabled (folder: ${env.CLOUDINARY_FOLDER})`);
} else {
  logger.warn('Cloudinary credentials missing - falling back to local disk uploads under server/uploads');
}

export interface UploadImageOptions {
  /**
   * Full public id including any folder. Supplying one makes the upload deterministic and
   * idempotent — re-running the seed replaces the same asset instead of orphaning the old
   * one — which is why the seed uses it and ordinary admin uploads do not.
   */
  publicId?: string;
}

export async function uploadImageBuffer(
  buffer: Buffer,
  folder: string = env.CLOUDINARY_FOLDER,
  options: UploadImageOptions = {},
): Promise<UploadedAsset> {
  if (!cloudinaryEnabled) {
    throw ApiError.internal('Cloudinary is not configured. Set CLOUDINARY_* variables in server/.env');
  }

  return new Promise<UploadedAsset>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options.publicId
        ? {
            public_id: options.publicId,
            resource_type: 'image',
            unique_filename: false,
            overwrite: true,
            invalidate: true,
          }
        : {
            folder,
            resource_type: 'image',
            unique_filename: true,
            overwrite: false,
          },
      (error, result) => {
        if (error || !result) {
          reject(ApiError.internal(`Cloudinary upload failed: ${error?.message ?? 'unknown error'}`));
          return;
        }

        resolve({
          url: result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );

    stream.end(buffer);
  });
}

export interface DestroyResult {
  publicId: string;
  result: string;
}

export async function destroyImage(publicId: string): Promise<DestroyResult> {
  if (!cloudinaryEnabled || !publicId) {
    return { publicId, result: 'skipped' };
  }

  // `invalidate: true` purges Cloudinary's CDN cache. Without it a deleted image keeps
  // being served from the edge for a while, which looks like a failed delete.
  const response = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });

  return { publicId, result: response.result ?? 'unknown' };
}

export function buildSrcSet(secureUrl: string, widths: number[] = [400, 800, 1200]): string {
  return widths.map((width) => `${secureUrl.replace('/upload/', `/upload/w_${width},c_limit/`)} ${width}w`).join(', ');
}
