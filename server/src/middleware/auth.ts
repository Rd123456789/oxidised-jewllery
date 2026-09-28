import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { User, type UserHydratedDocument, type UserRole } from '../models/user.model.js';
import { ApiError } from '../utils/apiError.js';
import { verifyAccessToken, type AccountType } from '../utils/tokens.js';

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  accountType: AccountType;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
      currentUser?: UserHydratedDocument;
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
    }
  }
}

const ADMIN_ROLES: UserRole[] = ['admin', 'manager'];

function extractAccessToken(req: Request): string | undefined {
  const header = req.headers.authorization;

  if (header && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }

  const cookies = req.cookies as Record<string, string> | undefined;

  return cookies?.['accessToken'];
}

async function resolveAuth(req: Request, required: boolean): Promise<void> {
  const token = extractAccessToken(req);

  if (!token) {
    if (required) {
      throw ApiError.unauthorized('Sign in to continue');
    }

    return;
  }

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);

  if (!user || !user.isActive) {
    if (required) {
      throw ApiError.unauthorized('Account is inactive or no longer exists');
    }

    return;
  }

  req.auth = {
    userId: String(user._id),
    email: user.email,
    role: user.role,
    accountType: ADMIN_ROLES.includes(user.role) ? 'admin' : 'customer',
  };

  req.currentUser = user;
}

export function authenticate(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await resolveAuth(req, true);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function optionalAuthenticate(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await resolveAuth(req, false);
      next();
    } catch {
      next();
    }
  };
}

export function authorize(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(ApiError.unauthorized('Sign in to continue'));
      return;
    }

    if (roles.length > 0 && !roles.includes(req.auth.role)) {
      next(ApiError.forbidden());
      return;
    }

    next();
  };
}

export function requireAdmin(): RequestHandler[] {
  return [authenticate(), authorize('admin', 'manager')];
}

export function requireCustomer(): RequestHandler[] {
  return [authenticate()];
}

export function requireRole(role: UserRole): RequestHandler[] {
  return [authenticate(), authorize(role)];
}
