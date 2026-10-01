import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { SeoService } from '../../../core/services/seo.service';
import { SessionService } from '../../../core/services/session.service';
import { SignOutService } from '../../../core/services/sign-out.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency, formatDate } from '../../../core/utils/format';
import { Icon, type IconName } from '../../../shared/components/icon/icon';

interface AccountTab {
  label: string;
  link: string;
  icon: IconName;
  exact: boolean;
}

@Component({
  selector: 'account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './account.page.html',
})
export class AccountPage {
  private readonly session = inject(SessionService);
  private readonly orders = inject(OrderService);
  private readonly signOutFlow = inject(SignOutService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly user = this.session.user;
  readonly orderCount = signal(0);
  readonly lifetimeValue = signal(0);
  readonly statsLoading = signal(true);

  readonly tabs: AccountTab[] = [
    { label: 'Profile', link: './', icon: 'user', exact: true },
    { label: 'Orders', link: 'orders', icon: 'box', exact: false },
    { label: 'Addresses', link: 'addresses', icon: 'truck', exact: false },
  ];

  readonly memberSince = computed(() => formatDate(this.session.user()?.createdAt));
  readonly formattedLifetime = computed(() => formatCurrency(this.lifetimeValue()));

  constructor() {
    this.seo.set({
      title: 'My account',
      description: 'Manage your profile, orders and delivery addresses.',
      canonicalPath: '/account',
    });

    void this.loadStats();
  }

  async loadStats(): Promise<void> {
    this.statsLoading.set(true);

    try {
      const result = await this.orders.myOrders({ limit: 100 });
      this.orderCount.set(result.meta.total ?? result.orders.length);
      this.lifetimeValue.set(
        result.orders.reduce((sum, order) => sum + (order.pricing?.total ?? 0), 0),
      );
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.statsLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  async signOut(): Promise<void> {
    await this.signOutFlow.signOut();
    this.toast.info('You have been signed out');
    this.cdr.markForCheck();
  }
}
