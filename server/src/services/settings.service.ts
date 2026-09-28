import { getStoreSettings, StoreSettings, type StoreSettingsDocument } from '../models/setting.model.js';
import type { SettingsUpdateInput } from '../validators/content.validator.js';

export interface PublicSettings {
  storeName: string;
  tagline?: string;
  logo?: { url: string; publicId?: string };
  supportEmail: string;
  supportPhone?: string;
  whatsappNumber?: string;
  addressLines: string[];
  currency: string;
  taxPercent: number;
  taxLabel: string;
  shippingFlatRate: number;
  freeShippingThreshold: number;
  codEnabled: boolean;
  codFee: number;
  minOrderValue: number;
  announcement: { text?: string; link?: string; isActive: boolean };
  social: {
    instagram?: string;
    facebook?: string;
    pinterest?: string;
    youtube?: string;
  };
  returnsWindowDays: number;
}

export async function getSettings(): Promise<StoreSettingsDocument> {
  return getStoreSettings();
}

export function toPublicSettings(settings: StoreSettingsDocument): PublicSettings {
  return {
    storeName: settings.storeName,
    tagline: settings.tagline,
    logo: settings.logo,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    whatsappNumber: settings.whatsappNumber,
    addressLines: settings.addressLines ?? [],
    currency: settings.currency,
    taxPercent: settings.taxPercent,
    taxLabel: settings.taxLabel,
    shippingFlatRate: settings.shippingFlatRate,
    freeShippingThreshold: settings.freeShippingThreshold,
    codEnabled: settings.codEnabled,
    codFee: settings.codFee,
    minOrderValue: settings.minOrderValue,
    announcement: {
      text: settings.announcement?.text,
      link: settings.announcement?.link,
      isActive: settings.announcement?.isActive ?? true,
    },
    social: {
      instagram: settings.social?.instagram,
      facebook: settings.social?.facebook,
      pinterest: settings.social?.pinterest,
      youtube: settings.social?.youtube,
    },
    returnsWindowDays: settings.returnsWindowDays,
  };
}

export async function updateSettings(
  input: SettingsUpdateInput,
  updatedBy?: string,
): Promise<StoreSettingsDocument> {
  await getStoreSettings();

  const settings = await StoreSettings.findOneAndUpdate(
    {},
    { $set: { ...input, updatedBy } },
    { returnDocument: 'after', runValidators: true },
  ).lean<StoreSettingsDocument>();

  if (!settings) {
    throw new Error('Unable to update store settings');
  }

  return settings;
}
