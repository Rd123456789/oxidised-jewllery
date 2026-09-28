import { User, toPublicUser, type PublicUser, type UserDocument } from '../models/user.model.js';
import { Order } from '../models/order.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  hashToken,
  randomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccountType,
} from '../utils/tokens.js';
import type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from '../validators/auth.validator.js';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

const ADMIN_ROLES = ['admin', 'manager'];

function accountTypeFor(role: string): AccountType {
  return ADMIN_ROLES.includes(role) ? 'admin' : 'customer';
}

function issueTokens(user: UserDocument & { _id: unknown }): {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
} {
  const payload = {
    sub: String(user._id),
    email: user.email,
    role: user.role,
    accountType: accountTypeFor(user.role),
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return { accessToken, refreshToken, refreshTokenHash: hashToken(refreshToken) };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });

  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await User.hashPassword(input.password);

  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    marketingOptIn: input.marketingOptIn ?? false,
    role: 'customer',
  });

  const tokens = issueTokens(user);

  user.refreshTokenHash = tokens.refreshTokenHash;
  await user.save();

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: '15m',
  };
}

export async function login(input: LoginInput, requiredAccountType?: AccountType): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  if (!user || !(await user.comparePassword(input.password))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been disabled. Contact support for help.');
  }

  if (requiredAccountType === 'admin' && !ADMIN_ROLES.includes(user.role)) {
    throw ApiError.forbidden('This account does not have admin access');
  }

  const tokens = issueTokens(user);

  user.refreshTokenHash = tokens.refreshTokenHash;
  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: '15m',
  };
}

export async function refreshSession(refreshToken: string | undefined): Promise<AuthResult> {
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token is missing');
  }

  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub).select('+refreshTokenHash');

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw ApiError.unauthorized('Session is no longer valid, please sign in again');
  }

  const tokens = issueTokens(user);

  user.refreshTokenHash = tokens.refreshTokenHash;
  await user.save();

  return {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: '15m',
  };
}

export async function logout(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
}

export interface ForgotPasswordResult {
  message: string;
  resetToken?: string;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const user = await User.findOne({ email });
  const message = 'If an account exists for that email, a reset link has been sent.';

  if (!user) {
    return { message };
  }

  const token = randomToken(32);

  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  // No SMTP integration is configured, so the token is surfaced outside production
  // to keep the flow testable. Wire Nodemailer here when SMTP credentials exist.
  return process.env['NODE_ENV'] === 'production' ? { message } : { message, resetToken: token };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    throw ApiError.badRequest('This reset link is invalid or has expired');
  }

  user.passwordHash = await User.hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.refreshTokenHash = undefined;
  await user.save();
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    throw ApiError.notFound('Account not found');
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.refreshTokenHash = undefined;
  await user.save();
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  );

  if (!user) {
    throw ApiError.notFound('Account not found');
  }

  return toPublicUser(user);
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('Account not found');
  }

  return toPublicUser(user);
}

export async function isFirstOrder(userId: string): Promise<boolean> {
  const count = await Order.countDocuments({
    user: userId,
    status: { $nin: ['cancelled', 'returned'] },
  });

  return count === 0;
}
