import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './apiError.js';

const ISSUER = 'oxidised-jewellery-api';
const AUDIENCE = 'oxidised-jewellery-web';

export type AccountType = 'customer' | 'admin';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  accountType: AccountType;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

function verify(token: string, secret: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, secret, { issuer: ISSUER, audience: AUDIENCE });

    if (typeof decoded === 'string') {
      throw ApiError.unauthorized('Invalid token payload');
    }

    return {
      sub: String(decoded['sub']),
      email: String(decoded['email']),
      role: String(decoded['role']),
      accountType: decoded['accountType'] as AccountType,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const reason = error instanceof Error ? error.message : 'unknown error';

    if (reason.includes('expired')) {
      throw ApiError.unauthorized('Session expired, please sign in again');
    }

    throw ApiError.unauthorized('Invalid or malformed token');
  }
}

export function verifyAccessToken(token: string): TokenPayload {
  return verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token: string): TokenPayload {
  return verify(token, env.JWT_REFRESH_SECRET);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
