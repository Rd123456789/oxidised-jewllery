import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { Icon, type IconName } from '../../shared/components/icon/icon';

interface AdminNavItem {
  label: string;
  link: string;
  icon: IconName;
  exact?: boolean;
}

const NAV_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', link: '/admin/dashboard', icon: 'dashboard' },
  { label: 'Products', link: '/admin/products', icon: 'box' },
  { label: 'Categories', link: '/admin/categories', icon: 'tag' },
  { label: 'Collections', link: '/admin/collections', icon: 'sparkles' },
  { label: 'Orders', link: '/admin/orders', icon: 'truck' },
  { label: 'Customers', link: '/admin/customers', icon: 'users' },
  { label: 'Reviews', link: '/admin/reviews', icon: 'star' },
  { label: 'Coupons', link: '/admin/coupons', icon: 'tag' },
  { label: 'Banners', link: '/admin/banners', icon: 'image' },
  { label: 'Pages', link: '/admin/pages', icon: 'page' },
  { label: 'Settings', link: '/admin/settings', icon: 'settings' },
];

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './admin-layout.html',
})
export class AdminLayout {
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly navItems = NAV_ITEMS;
  readonly sidebarOpen = signal(false);
  readonly userMenuOpen = signal(false);

  readonly userName = computed(() => this.session.user()?.name ?? 'Admin');
  readonly userEmail = computed(() => this.session.user()?.email ?? '');
  readonly role = computed(() => this.session.user()?.role ?? 'admin');
  readonly initials = computed(() =>
    this.session
      .displayName()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  async signOut(): Promise<void> {
    await this.session.logout();
    this.toast.info('Signed out of the admin panel');
    await this.router.navigate(['/admin/login']);
    this.cdr.markForCheck();
  }
}
