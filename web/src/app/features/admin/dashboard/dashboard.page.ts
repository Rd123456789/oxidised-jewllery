import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { DashboardStats, InventoryRow } from '../../../core/api/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { SeoService } from '../../../core/services/seo.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  formatCurrency,
  formatDate,
  orderStatusTone,
  relativeTime,
  titleCase,
} from '../../../core/utils/format';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { Icon } from '../../../shared/components/icon/icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

@Component({
  selector: 'dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StatusBadge, EmptyState],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly stats = signal<DashboardStats | null>(null);
  readonly inventory = signal<InventoryRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly relativeTime = relativeTime;
  readonly titleCase = titleCase;
  readonly orderStatusTone = orderStatusTone;

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly maxRevenue = computed(() =>
    Math.max(1, ...(this.stats()?.salesSeries ?? []).map((point) => point.revenue)),
  );

  readonly labelStep = computed(() => {
    const length = this.stats()?.salesSeries.length ?? 0;

    return length <= 6 ? 1 : Math.ceil(length / 6);
  });

  readonly statusMax = computed(() =>
    Math.max(1, ...(this.stats()?.orders.byStatus ?? []).map((entry) => entry.count)),
  );

  constructor() {
    this.seo.set({
      title: 'Dashboard',
      description: 'Store performance at a glance.',
      canonicalPath: '/admin/dashboard',
    });

    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const stats = await this.admin.dashboardStats(30);
      this.stats.set(stats);
      void this.loadInventory();
    } catch (error) {
      this.error.set('We could not load the dashboard. Please try again.');
      this.toast.error(error);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  barPercent(revenue: number): number {
    return Math.round((revenue / this.maxRevenue()) * 100);
  }

  showLabel(index: number): boolean {
    return index % this.labelStep() === 0;
  }

  statusWidth(count: number): number {
    return Math.round((count / this.statusMax()) * 100);
  }

  private async loadInventory(): Promise<void> {
    try {
      const rows = await this.admin.inventory();
      this.inventory.set(rows);
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.cdr.markForCheck();
    }
  }
}
