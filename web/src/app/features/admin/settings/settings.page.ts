import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { NewsletterSubscriber, StoreSettings } from '../../../core/api/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate } from '../../../core/utils/format';
import {
  ImageUploader,
  type UploadedImage,
} from '../../../shared/components/image-uploader/image-uploader';
import { Icon } from '../../../shared/components/icon/icon';

function blankSettings(): StoreSettings {
  return {
    storeName: '',
    tagline: '',
    supportEmail: '',
    supportPhone: '',
    whatsappNumber: '',
    addressLines: [''],
    currency: 'INR',
    taxPercent: 0,
    taxLabel: 'GST',
    shippingFlatRate: 0,
    freeShippingThreshold: 0,
    codEnabled: true,
    codFee: 0,
    minOrderValue: 0,
    returnsWindowDays: 7,
    announcement: { text: '', link: '', isActive: false },
    social: { instagram: '', facebook: '', pinterest: '', youtube: '' },
    gstNumber: '',
    lowStockThreshold: 5,
    maintenanceMode: false,
  };
}

@Component({
  selector: 'admin-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, ImageUploader],
  templateUrl: './settings.page.html',
})
export class AdminSettingsPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly settings = signal<StoreSettings>(blankSettings());
  private readonly snapshot = signal('');
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly saving = signal(false);

  readonly subscribers = signal<NewsletterSubscriber[]>([]);
  readonly subscriberTotal = signal(0);
  readonly subscribersLoading = signal(false);
  readonly confirmingSubscriberId = signal<string | null>(null);

  readonly formatDate = formatDate;

  readonly dirty = computed(() => this.snapshot() !== JSON.stringify(this.settings()));

  readonly logoImages = computed<UploadedImage[]>(() => {
    const logo = this.settings().logo;

    return logo ? [{ url: logo.url, publicId: logo.publicId }] : [];
  });

  constructor() {
    this.seo.set({ title: 'Settings', description: 'Store configuration.' });
    void this.load();
    void this.loadSubscribers();
  }

  patch(patch: Partial<StoreSettings>): void {
    this.settings.update((settings) => ({ ...settings, ...patch }));
  }

  patchAnnouncement(patch: Partial<StoreSettings['announcement']>): void {
    this.settings.update((settings) => ({
      ...settings,
      announcement: { ...settings.announcement, ...patch },
    }));
  }

  patchSocial(patch: Partial<StoreSettings['social']>): void {
    this.settings.update((settings) => ({
      ...settings,
      social: { ...settings.social, ...patch },
    }));
  }

  setLogo(images: UploadedImage[]): void {
    const image = images[0];

    this.patch({ logo: image ? { url: image.url, publicId: image.publicId } : undefined });
  }

  setAddressLine(index: number, value: string): void {
    this.settings.update((settings) => {
      const addressLines = [...settings.addressLines];
      addressLines[index] = value;

      return { ...settings, addressLines };
    });
  }

  addAddressLine(): void {
    this.settings.update((settings) => ({
      ...settings,
      addressLines: [...settings.addressLines, ''],
    }));
  }

  removeAddressLine(index: number): void {
    this.settings.update((settings) => ({
      ...settings,
      addressLines: settings.addressLines.filter((_, position) => position !== index),
    }));
  }

  async save(): Promise<void> {
    const current = this.settings();
    const payload: StoreSettings = {
      ...current,
      storeName: current.storeName.trim(),
      tagline: current.tagline?.trim() || undefined,
      supportEmail: current.supportEmail.trim(),
      supportPhone: current.supportPhone?.trim() || undefined,
      whatsappNumber: current.whatsappNumber?.trim() || undefined,
      addressLines: current.addressLines.map((line) => line.trim()).filter((line) => line !== ''),
      gstNumber: current.gstNumber?.trim() || undefined,
      currency: current.currency.trim().toUpperCase(),
    };

    this.saving.set(true);

    try {
      const saved = await this.admin.saveSettings(payload);
      this.settings.set(saved);
      this.snapshot.set(JSON.stringify(saved));
      this.toast.success('Settings saved');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  reset(): void {
    void this.load();
    void this.loadSubscribers();
  }

  async deleteSubscriber(subscriber: NewsletterSubscriber): Promise<void> {
    try {
      await this.admin.deleteSubscriber(subscriber.id);
      this.toast.success('Subscriber removed');
      this.confirmingSubscriberId.set(null);
      await this.loadSubscribers();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      const settings = await this.admin.settings();
      this.settings.set(settings);
      this.snapshot.set(JSON.stringify(settings));
    } catch (error) {
      this.failed.set(true);
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadSubscribers(): Promise<void> {
    this.subscribersLoading.set(true);

    try {
      const result = await this.admin.subscribers({ limit: 10 });
      this.subscribers.set(result.items);
      this.subscriberTotal.set(Number(result.meta.total ?? result.items.length));
    } catch {
      this.subscribers.set([]);
      this.subscriberTotal.set(0);
    } finally {
      this.subscribersLoading.set(false);
      this.cdr.markForCheck();
    }
  }
}
