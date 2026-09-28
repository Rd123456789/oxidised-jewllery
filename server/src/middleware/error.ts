import type { NextFunction, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function normalizeZodError(error: ZodError): { message: string; details: unknown } {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));

  return {
    message: 'Validation failed',
    details,
  };
}

function isDuplicateKeyError(error: unknown): error is { code: number; keyValue?: Record<string, unknown> } {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: unknown;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    const normalized = normalizeZodError(error);
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = normalized.message;
    details = normalized.details;
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(error.errors).map((entry) => ({
      field: entry.path,
      message: entry.message,
    }));
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid value for ${error.path}`;
  } else if (isDuplicateKeyError(error)) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    message = `Duplicate value for ${Object.keys(error.keyValue ?? {}).join(', ') || 'field'}`;
    details = error.keyValue;
  } else if (error instanceof multer.MulterError) {
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `File too large. Maximum size is ${env.UPLOAD_MAX_FILE_SIZE_MB}MB`
        : error.message;
  } else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON';
  } else if (error instanceof Error) {
    message = env.isProduction ? 'Something went wrong' : error.message;
  }

  if (statusCode >= 500) {
    logger.error('Unhandled error', error instanceof Error ? error.stack ?? error.message : error);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}
