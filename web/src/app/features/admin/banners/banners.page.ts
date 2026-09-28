import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Banner } from '../../../core/api/api.models';
import { AdminService, type BannerInput } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate, titleCase } from '../../../core/utils/format';
import {
  ImageUploader,
  type UploadedImage,
} from '../../../shared/components/image-uploader/image-uploader';
import { Icon } from '../../../shared/components/icon/icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type BannerPosition = Banner['position'];

interface BannerPayload extends BannerInput {
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  startsAt?: string;
  endsAt?: string;
}

interface BannerForm {
  title: string;
  subtitle: string;
  description: string;
  image: UploadedImage | null;
  mobileImage: UploadedImage | null;
  ctaLabel: string;
  ctaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  position: BannerPosition;
  textAlign: Banner['textAlign'];
  theme: Banner['theme'];
  sortOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const POSITIONS: { value: BannerPosition; label: string }[] = [
  { value: 'hero', label: 'Hero' },
  { value: 'category_strip', label: 'Category strip' },
  { value: 'promo_strip', label: 'Promo strip' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'checkout', label: 'Checkout' },
];

const TEXT_ALIGNS: Banner['textAlign'][] = ['left', 'center', 'right'];

const THEMES: Banner['theme'][] = ['light', 'dark'];

function blankForm(position: BannerPosition, sortOrder: number): BannerForm {
  return {
    title: '',
    subtitle: '',
    description: '',
    image: null,
    mobileImage: null,
    ctaLabel: '',
    ctaUrl: '',
    secondaryCtaLabel: '',
    secondaryCtaUrl: '',
    position,
    textAlign: 'left',
    theme: 'light',
    sortOrder,
    isActive: true,
    startsAt: '',
    endsAt: '',
  };
}

@Component({
  selector: 'admin-banners-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ImageUploader, Icon, StatusBadge],
  templateUrl: './banners.page.html',
})
export class AdminBannersPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly positions = POSITIONS;
  readonly textAligns = TEXT_ALIGNS;
  readonly themes = THEMES;

  readonly banners = signal<Banner[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly saving = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly confirmingId = signal<string | null>(null);

  readonly panelOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<BannerForm>(blankForm('hero', 10));

  readonly formatDate = formatDate;
  readonly titleCase = titleCase;

  readonly formImages = computed<UploadedImage[]>(() => {
    const image = this.form().image;

    return image ? [image] : [];
  });

  readonly formMobileImages = computed<UploadedImage[]>(() => {
    const image = this.form().mobileImage;

    return image ? [image] : [];
  });

  readonly groups = computed(() => {
    const banners = this.banners();

    return POSITIONS.map((position) => ({
      position: position.value,
      label: position.label,
      banners: banners
        .filter((banner) => banner.position === position.value)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  });

  constructor() {
    this.seo.set({ title: 'Banners', description: 'Manage storefront banners.' });
    void this.load();
  }

  reload(): void {
    void this.load();
  }

  openCreate(position: BannerPosition): void {
    this.editingId.set(null);
    this.form.set(blankForm(position, this.nextSortOrder(position)));
    this.panelOpen.set(true);
  }

  openEdit(banner: Banner): void {
    this.editingId.set(banner.id);
    this.form.set({
      title: banner.title,
      subtitle: banner.subtitle ?? '',
      description: banner.description ?? '',
      image: banner.image,
      mobileImage: banner.mobileImage ?? null,
      ctaLabel: banner.ctaLabel ?? '',
      ctaUrl: banner.ctaUrl ?? '',
      secondaryCtaLabel: banner.secondaryCtaLabel ?? '',
      secondaryCtaUrl: banner.secondaryCtaUrl ?? '',
      position: banner.position,
      textAlign: banner.textAlign,
      theme: banner.theme,
      sortOrder: banner.sortOrder,
      isActive: banner.isActive,
      startsAt: banner.startsAt ? banner.startsAt.slice(0, 10) : '',
      endsAt: banner.endsAt ? banner.endsAt.slice(0, 10) : '',
    });
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.editingId.set(null);
  }

  patch(patch: Partial<BannerForm>): void {
    this.form.update((form) => ({ ...form, ...patch }));
  }

  setImage(images: UploadedImage[]): void {
    this.patch({ image: images[0] ?? null });
  }

  setMobileImage(images: UploadedImage[]): void {
    this.patch({ mobileImage: images[0] ?? null });
  }

  async save(): Promise<void> {
    const form = this.form();

    if (!form.title.trim()) {
      this.toast.error('Banner title is required');
      return;
    }

    if (!form.image) {
      this.toast.error('Banner image is required');
      return;
    }

    const payload: BannerPayload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      description: form.description.trim() || undefined,
      image: form.image,
      mobileImage: form.mobileImage ?? undefined,
      ctaLabel: form.ctaLabel.trim() || undefined,
      ctaUrl: form.ctaUrl.trim() || undefined,
      secondaryCtaLabel: form.secondaryCtaLabel.trim() || undefined,
      secondaryCtaUrl: form.secondaryCtaUrl.trim() || undefined,
      position: form.position,
      textAlign: form.textAlign,
      theme: form.theme,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined,
    };

    this.saving.set(true);

    try {
      const id = this.editingId();

      if (id) {
        await this.admin.updateBanner(id, payload);
        this.toast.success('Banner updated');
      } else {
        await this.admin.createBanner(payload);
        this.toast.success('Banner created');
      }

      this.closePanel();
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  async move(banner: Banner, direction: number): Promise<void> {
    const group = this.groups().find((entry) => entry.position === banner.position);

    if (!group) {
      return;
    }

    const index = group.banners.findIndex((entry) => entry.id === banner.id);
    const target = group.banners[index + direction];

    if (index < 0 || !target) {
      return;
    }

    const reordered = [...group.banners];
    reordered[index] = target;
    reordered[index + direction] = banner;
    this.busyId.set(banner.id);

    try {
      await Promise.all(
        reordered.map((entry, position) =>
          this.admin.updateBanner(entry.id, { sortOrder: (position + 1) * 10 }),
        ),
      );
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  async toggleActive(banner: Banner): Promise<void> {
    this.busyId.set(banner.id);

    try {
      await this.admin.updateBanner(banner.id, { isActive: !banner.isActive });
      this.toast.success(banner.isActive ? 'Banner hidden' : 'Banner shown');
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  async remove(banner: Banner): Promise<void> {
    this.busyId.set(banner.id);

    try {
      await this.admin.deleteBanner(banner.id);
      this.toast.success('Banner deleted');
      this.confirmingId.set(null);
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.busyId.set(null);
      this.cdr.markForCheck();
    }
  }

  private nextSortOrder(position: BannerPosition): number {
    const group = this.banners().filter((banner) => banner.position === position);

    if (group.length === 0) {
      return 10;
    }

    return Math.max(...group.map((banner) => banner.sortOrder)) + 10;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      this.banners.set(await this.admin.banners());
    } catch (error) {
      this.failed.set(true);
      this.banners.set([]);
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
