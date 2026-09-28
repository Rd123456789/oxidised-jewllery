import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { IdempotencyRecord } from '../models/idempotency.model.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

const HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 200;
/** A request that has not produced a status within this window is treated as abandoned. */
const STALE_LOCK_MS = 60_000;

interface IdempotencyScope {
  key: string;
  method: string;
  path: string;
  userId: string;
}

function readKey(req: Request): string | null {
  const raw = req.header(HEADER);

  if (!raw) {
    return null;
  }

  const key = raw.trim();

  return key.length > 0 && key.length <= MAX_KEY_LENGTH ? key : null;
}

function scopeFor(req: Request, key: string): IdempotencyScope {
  const path = (req.originalUrl.split('?')[0] ?? req.path).replace(/\/+$/, '') || '/';

  return {
    key,
    method: req.method.toUpperCase(),
    path,
    userId: req.auth?.userId ?? 'guest',
  };
}

/**
 * Makes a mutating endpoint safe to retry.
 *
 * When the client sends `Idempotency-Key`, the first response is stored for 24 hours and
 * later requests with the same key/method/path/user replay it instead of running the
 * handler again. A placeholder row (`statusCode: 0`) reserves the key while the request
 * is in flight, so a concurrent duplicate gets 409 rather than a second order.
 */
export function idempotency(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = readKey(req);

    if (!key) {
      next();
      return;
    }

    const scope = scopeFor(req, key);

    try {
      const existing = await IdempotencyRecord.findOne(scope).lean();

      if (existing && existing.statusCode > 0) {
        res.set('Idempotent-Replay', 'true');
        res.status(existing.statusCode).json(existing.response);
        return;
      }

      if (existing) {
        const age = Date.now() - new Date(existing.updatedAt).getTime();

        if (age < STALE_LOCK_MS) {
          throw ApiError.conflict('A request with this Idempotency-Key is already in progress');
        }

        await IdempotencyRecord.updateOne(scope, { $set: { statusCode: 0 } });
      } else {
        await IdempotencyRecord.create(scope);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
        return;
      }

      // A duplicate-key error means another instance won the race for this key.
      if ((error as { code?: number }).code === 11000) {
        next(ApiError.conflict('A request with this Idempotency-Key is already in progress'));
        return;
      }

      // Storage trouble must not block a legitimate order; fall through unprotected.
      logger.warn(`Idempotency check skipped: ${(error as Error).message}`);
      next();
      return;
    }

    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      // Only persist outcomes a retry should faithfully reproduce. A 5xx may be transient,
      // so it is dropped and the key released for another attempt.
      if (res.statusCode < 500) {
        void IdempotencyRecord.updateOne(
          scope,
          { $set: { statusCode: res.statusCode, response: body } },
        ).catch(() => undefined);
      } else {
        void IdempotencyRecord.deleteOne(scope).catch(() => undefined);
      }

      return originalJson(body);
    };

    next();
  };
}
