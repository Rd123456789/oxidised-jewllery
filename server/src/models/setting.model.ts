import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

export const SETTINGS_KEY = 'store';

export interface StoreSettingsDocument {
  key: string;
  storeName: string;
  tagline?: string;
  logo?: { url: string; publicId?: string };
  supportEmail: string;
  supportPhone?: string;
  whatsappNumber?: string;
  addressLines: string[];
  gstNumber?: string;
  currency: string;
  taxPercent: number;
  taxLabel: string;
  shippingFlatRate: number;
  freeShippingThreshold: number;
  codEnabled: boolean;
  codFee: number;
  minOrderValue: number;
  announcement: {
    text?: string;
    link?: string;
    isActive: boolean;
  };
  social: {
    instagram?: string;
    facebook?: string;
    pinterest?: string;
    youtube?: string;
  };
  returnsWindowDays: number;
  lowStockThreshold: number;
  maintenanceMode: boolean;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type StoreSettingsHydratedDocument = HydratedDocument<StoreSettingsDocument>;

const settingSchema = new Schema<StoreSettingsDocument>(
  {
    key: { type: String, default: SETTINGS_KEY, unique: true, index: true },
    storeName: { type: String, default: 'Oxidised Jewellery', trim: true, maxlength: 120 },
    tagline: { type: String, trim: true, maxlength: 200 },
    logo: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
    supportEmail: { type: String, default: 'care@oxidisedjewellery.test', lowercase: true, trim: true },
    supportPhone: { type: String, trim: true },
    whatsappNumber: { type: String, trim: true },
    addressLines: { type: [String], default: [] },
    gstNumber: { type: String, trim: true, uppercase: true },
    currency: { type: String, default: 'INR', uppercase: true, trim: true },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    taxLabel: { type: String, default: 'GST', trim: true },
    shippingFlatRate: { type: Number, default: 79, min: 0 },
    freeShippingThreshold: { type: Number, default: 999, min: 0 },
    codEnabled: { type: Boolean, default: true },
    codFee: { type: Number, default: 0, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    announcement: {
      text: { type: String, trim: true, maxlength: 200 },
      link: { type: String, trim: true, maxlength: 300 },
      isActive: { type: Boolean, default: true },
    },
    social: {
      instagram: { type: String, trim: true },
      facebook: { type: String, trim: true },
      pinterest: { type: String, trim: true },
      youtube: { type: String, trim: true },
    },
    returnsWindowDays: { type: Number, default: 7, min: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    maintenanceMode: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

export const StoreSettings = model<StoreSettingsDocument>('StoreSettings', settingSchema);

export async function getStoreSettings(): Promise<StoreSettingsDocument> {
  const settings = await StoreSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  ).lean<StoreSettingsDocument>();

  if (!settings) {
    throw new Error('Unable to load store settings');
  }

  return settings;
}
