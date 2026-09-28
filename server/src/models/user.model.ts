import bcrypt from 'bcryptjs';
import { Schema, Types, model, type HydratedDocument, type Model } from 'mongoose';
import { env } from '../config/env.js';
import { schemaOptions, subdocumentOptions } from './common.js';

export type UserRole = 'customer' | 'manager' | 'admin';

export interface AddressDocument {
  _id?: Types.ObjectId;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface UserDocument {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  marketingOptIn: boolean;
  lastLoginAt?: Date;
  refreshTokenHash?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  addresses: AddressDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export interface UserStatics {
  hashPassword(plain: string): Promise<string>;
}

export type UserHydratedDocument = HydratedDocument<UserDocument, UserMethods>;

export type UserModel = Model<UserDocument, Record<string, never>, UserMethods> & UserStatics;

const addressSchema = new Schema<AddressDocument>(
  {
    label: { type: String, default: 'Home', trim: true, maxlength: 30 },
    fullName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line1: { type: String, required: true, trim: true, maxlength: 160 },
    line2: { type: String, trim: true, maxlength: 160 },
    landmark: { type: String, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, maxlength: 12 },
    country: { type: String, default: 'India', trim: true, maxlength: 80 },
    isDefault: { type: Boolean, default: false },
  },
  subdocumentOptions,
);

const userSchema = new Schema<UserDocument, UserModel, UserMethods>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['customer', 'manager', 'admin'] satisfies UserRole[],
      default: 'customer',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    emailVerified: { type: Boolean, default: false },
    marketingOptIn: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    refreshTokenHash: { type: String, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    addresses: { type: [addressSchema], default: [] },
  },
  schemaOptions,
);

userSchema.index({ name: 'text', email: 'text' });
userSchema.index({ createdAt: -1 });

userSchema.methods.comparePassword = function comparePassword(candidate: string): Promise<boolean> {
  const document = this as unknown as UserDocument;

  return bcrypt.compare(candidate, document.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
};

export const User = model<UserDocument, UserModel>('User', userSchema);

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  emailVerified: boolean;
  marketingOptIn: boolean;
  isActive: boolean;
  addresses: AddressDocument[];
  lastLoginAt?: Date;
  createdAt: Date;
}

export function toPublicUser(user: UserDocument & { _id?: Types.ObjectId }): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    marketingOptIn: user.marketingOptIn,
    isActive: user.isActive,
    addresses: user.addresses ?? [],
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
