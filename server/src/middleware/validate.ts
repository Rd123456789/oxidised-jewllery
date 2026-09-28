import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/apiError.js';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function formatIssues(error: {
  issues: { path: PropertyKey[]; message: string; code: string }[];
}): { field: string; message: string; code: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map((segment) => String(segment)).join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Validates and coerces request input.
 *
 * Express 5 exposes `req.query` as a read-only getter, so validated query
 * values are exposed on `req.validatedQuery` instead of mutating `req.query`.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);

      if (!result.success) {
        next(ApiError.validation('Invalid route parameters', formatIssues(result.error)));
        return;
      }

      req.validatedParams = result.data as Record<string, unknown>;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);

      if (!result.success) {
        next(ApiError.validation('Invalid query parameters', formatIssues(result.error)));
        return;
      }

      req.validatedQuery = result.data as Record<string, unknown>;
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);

      if (!result.success) {
        next(ApiError.validation('Invalid request body', formatIssues(result.error)));
        return;
      }

      req.body = result.data;
    }

    next();
  };
}
