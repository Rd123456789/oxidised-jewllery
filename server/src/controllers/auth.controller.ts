import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env.js';
import { toPublicUser, type AddressDocument, type UserHydratedDocument } from '../models/user.model.js';
import * as authService from '../services/auth.service.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler, sendSuccess } from '../utils/http.js';
import { hashToken } from '../utils/tokens.js';
import type { AddressInput } from '../validators/common.validator.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge: REFRESH_MAX_AGE_MS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function currentUser(req: Request): UserHydratedDocument {
  if (!req.currentUser) {
    throw ApiError.unauthorized();
  }

  return req.currentUser;
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  setRefreshCookie(res, result.refreshToken);

  sendSuccess(
    res,
    { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn },
    { status: 201, message: 'Your account is ready' },
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  });
});

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, 'admin');
  setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = (req.body as { refreshToken?: string }).refreshToken ?? cookies?.[REFRESH_COOKIE];
  const result = await authService.refreshSession(token);
  setRefreshCookie(res, result.refreshToken);

  sendSuccess(res, {
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.auth) {
    await authService.logout(req.auth.userId);
  }

  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });

  sendSuccess(res, { loggedOut: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, { user: toPublicUser(currentUser(req)) });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile(currentUser(req).id, req.body);
  sendSuccess(res, { user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(currentUser(req).id, body.currentPassword, body.newPassword);

  sendSuccess(res, { updated: true }, { message: 'Password updated. Please sign in again.' });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword((req.body as { email: string }).email);
  sendSuccess(res, result);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { token: string; password: string };
  await authService.resetPassword(body.token, body.password);

  sendSuccess(res, { reset: true }, { message: 'Password reset. You can sign in now.' });
});

export const listAddresses = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, currentUser(req).addresses ?? []);
});

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const input = req.body as AddressInput;

  const shouldBeDefault = input.isDefault || user.addresses.length === 0;

  if (shouldBeDefault) {
    user.addresses.forEach((address) => {
      address.isDefault = false;
    });
  }

  user.addresses.push({
    ...input,
    label: input.label ?? 'Home',
    isDefault: shouldBeDefault,
  } as AddressDocument);

  await user.save();

  sendSuccess(res, user.addresses, { status: 201 });
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { id } = req.params;
  const input = req.body as Partial<AddressInput>;

  const address = user.addresses.find((entry) => String(entry['_id']) === id);

  if (!address) {
    throw ApiError.notFound('Address not found');
  }

  if (input.isDefault) {
    user.addresses.forEach((entry) => {
      entry.isDefault = false;
    });
  }

  Object.assign(address, input);
  await user.save();

  sendSuccess(res, user.addresses);
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { id } = req.params;

  const address = user.addresses.find((entry) => String(entry['_id']) === id);

  if (!address) {
    throw ApiError.notFound('Address not found');
  }

  const wasDefault = address.isDefault;

  user.addresses = user.addresses.filter((entry) => String(entry._id) !== id) as AddressDocument[];

  if (wasDefault) {
    const first = user.addresses[0];

    if (first) {
      first.isDefault = true;
    }
  }

  await user.save();

  sendSuccess(res, user.addresses);
});

export const setDefaultAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { id } = req.params;

  const address = user.addresses.find((entry) => String(entry['_id']) === id);

  if (!address) {
    throw ApiError.notFound('Address not found');
  }

  user.addresses.forEach((entry) => {
    entry.isDefault = String(entry['_id']) === id;
  });

  await user.save();

  sendSuccess(res, user.addresses);
});

export const sessionDebug = asyncHandler(async (req: Request, res: Response) => {
  if (env.isProduction) {
    throw ApiError.notFound();
  }

  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[REFRESH_COOKIE];

  sendSuccess(res, {
    hasRefreshCookie: Boolean(token),
    refreshTokenHash: token ? hashToken(token).slice(0, 12) : null,
  });
});
