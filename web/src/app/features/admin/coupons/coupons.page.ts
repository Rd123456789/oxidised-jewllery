import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ApiMeta, Coupon } from '../../../core/api/api.models';
import { AdminService, type CouponInput } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency, formatDate, titleCase } from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type CouponType = CouponInput['type'];

interface CouponForm {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minOrderValue: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  startsAt: string;
  expiresAt: string;
  firstOrderOnly: boolean;
  isActive: boolean;
}

const COUPON_TYPES: { value: CouponType; label: string }[] = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'free_shipping', label: 'Free shipping' },
];

const PAGE_SIZE = 20;

function blankForm(): CouponForm {
  return {
    code: '',
    description: '',
    type: 'percentage',
    value: 10,
    minOrderValue: 0,
    maxDiscount: null,
    usageLimit: null,
    perUserLimit: 0,
    startsAt: '',
    expiresAt: '',
    firstOrderOnly: false,
    isActive: true,
  };
}

@Component({
  selector: 'admin-coupons-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, StatusBadge, Pagination, EmptyState],
  templateUrl: './coupons.page.html',
})
export class AdminCouponsPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly couponTypes = COUPON_TYPES;

  readonly coupons = signal<Coupon[]>([]);
  readonly meta = signal<ApiMeta>({});
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly page = signal(1);
  readonly activeFilter = signal<'all' | 'active' | 'inactive'>('all');
  readonly confirmingId = signal<string | null>(null);
  readonly saving = signal(false);

  readonly panelOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<CouponForm>(blankForm());

  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly titleCase = titleCase;

  readonly totalPages = computed(() => Number(this.meta().totalPages ?? 1) || 1);
  readonly total = computed(() => Number(this.meta().total ?? 0));

  readonly query = computed<Record<string, unknown>>(() => {
    const filter = this.activeFilter();
    const query: Record<string, unknown> = { page: this.page(), limit: PAGE_SIZE };

    if (filter !== 'all') {
      query['isActive'] = filter === 'active';
    }

    return query;
  });

  readonly valueError = computed<string | null>(() => {
    const form = this.form();

    if (!form.code.trim()) {
      return 'Coupon code is required.';
    }

    if (form.type === 'percentage') {
      if (form.value <= 0) {
        return 'Discount value must be greater than 0.';
      }

      if (form.value > 100) {
        return 'Percentage discount cannot exceed 100.';
      }
    }

    if (form.type === 'fixed' && form.value <= 0) {
      return 'Discount amount must be greater than 0.';
    }

    if (form.startsAt && form.expiresAt && form.startsAt > form.expiresAt) {
      return 'Expiry date must be after the start date.';
    }

    return null;
  });

  constructor() {
    this.seo.set({ title: 'Coupons', description: 'Manage discount coupons.' });
    void this.load();
  }

  setActiveFilter(filter: 'all' | 'active' | 'inactive'): void {
    this.activeFilter.set(filter);
    this.page.set(1);
    void this.load();
  }

  goToPage(page: number): void {
    this.page.set(page);
    void this.load();
  }

  reload(): void {
    void this.load();
  }

  valueLabel(coupon: Coupon): string {
    switch (coupon.type) {
      case 'percentage':
        return `${coupon.value}%`;
      case 'fixed':
        return formatCurrency(coupon.value);
      default:
        return 'Free shipping';
    }
  }

  typeLabel(type: CouponType): string {
    return COUPON_TYPES.find((entry) => entry.value === type)?.label ?? titleCase(type);
  }

  isExpired(coupon: Coupon): boolean {
    return !!coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now();
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form.set(blankForm());
    this.panelOpen.set(true);
  }

  openEdit(coupon: Coupon): void {
    this.editingId.set(coupon.id);
    this.form.set({
      code: coupon.code,
      description: coupon.description ?? '',
      type: coupon.type,
      value: coupon.value,
      minOrderValue: coupon.minOrderValue ?? 0,
      maxDiscount: coupon.maxDiscount ?? null,
      usageLimit: coupon.usageLimit ?? null,
      perUserLimit: coupon.perUserLimit ?? 0,
      startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 10) : '',
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : '',
      firstOrderOnly: coupon.firstOrderOnly,
      isActive: coupon.isActive,
    });
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.editingId.set(null);
  }

  patch(patch: Partial<CouponForm>): void {
    this.form.update((form) => ({ ...form, ...patch }));
  }

  setType(type: CouponType): void {
    this.form.update((form) => ({
      ...form,
      type,
      value: type === 'free_shipping' ? 0 : form.value,
    }));
  }

  async save(): Promise<void> {
    if (this.valueError()) {
      return;
    }

    const form = this.form();
    const payload: CouponInput = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : Number(form.value),
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
      maxDiscount: form.type === 'percentage' && form.maxDiscount ? Number(form.maxDiscount) : undefined,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
      firstOrderOnly: form.firstOrderOnly,
      isActive: form.isActive,
    };

    this.saving.set(true);

    try {
      const id = this.editingId();

      if (id) {
        await this.admin.updateCoupon(id, payload);
        this.toast.success('Coupon updated');
      } else {
        await this.admin.createCoupon(payload);
        this.toast.success('Coupon created');
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

  async toggleActive(coupon: Coupon): Promise<void> {
    try {
      await this.admin.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      this.toast.success(coupon.isActive ? 'Coupon disabled' : 'Coupon enabled');
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }

  async remove(coupon: Coupon): Promise<void> {
    try {
      await this.admin.deleteCoupon(coupon.id);
      this.toast.success(`Coupon ${coupon.code} deleted`);
      this.confirmingId.set(null);
      await this.load();
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
      const result = await this.admin.coupons(this.query());
      this.coupons.set(result.items);
      this.meta.set(result.meta);
    } catch (error) {
      this.failed.set(true);
      this.coupons.set([]);
      this.meta.set({});
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
