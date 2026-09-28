import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  [key: string]: unknown;
}

export interface SendOptions {
  status?: number;
  meta?: ResponseMeta;
  message?: string;
}

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function isPlainObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;

  return prototype === Object.prototype || prototype === null;
}

/**
 * Guarantees the "documents expose `id`, never `_id`" contract on the way out.
 *
 * Hydrated documents already get this from the schema `toJSON` transform, but
 * `.lean()` returns plain objects and bypasses schema transforms entirely — so a lean
 * query silently shipped `_id` and clients sent `undefined` back in the URL, which
 * surfaced as "Invalid identifier" when deleting a banner, coupon, page and so on.
 *
 * Normalising in one place means no call site has to remember. Plain objects are
 * mutated in place; documents, Dates, ObjectIds, Buffers and Maps are left alone.
 */
export function normalizeDocumentIds<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) {
      normalizeDocumentIds(entry);
    }

    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(record, key);

  if (hasOwn('_id') && !hasOwn('id')) {
    record['id'] = String(record['_id']);
  }

  delete record['_id'];
  delete record['__v'];

  for (const key of Object.keys(record)) {
    normalizeDocumentIds(record[key]);
  }

  return value;
}

export function sendSuccess<T>(res: Response, data: T, options: SendOptions = {}): void {
  const { status = 200, meta, message } = options;

  res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data: normalizeDocumentIds(data),
    ...(meta ? { meta } : {}),
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: Required<Pick<ResponseMeta, 'page' | 'limit' | 'total' | 'totalPages'>>,
): void {
  sendSuccess(res, data, {
    meta: {
      ...meta,
      hasNextPage: meta.page < meta.totalPages,
      hasPrevPage: meta.page > 1,
    },
  });
}
