import type { Routes } from '@angular/router';
import { adminGuard, authGuard, guestOnlyGuard } from './core/guards/auth.guard';
import { AdminLayout } from './layouts/admin-layout/admin-layout';
import { StorefrontLayout } from './layouts/storefront-layout/storefront-layout';

export const routes: Routes = [
  // NOTE: the admin routes must stay ABOVE the storefront `path: ""` block.
  // That storefront route is a prefix match whose children include a `**` wildcard,
  // so it greedily swallows /admin/** and the panel renders the storefront 404 instead.
  // Angular matches top-level routes in declaration order and only backtracks when a
  // branch fails to match, so the wildcard has to be reached last.
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/admin/login/admin-login.page').then((module) => module.AdminLoginPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    component: AdminLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.page').then((module) => module.DashboardPage),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/admin/products/product-list.page').then(
            (module) => module.AdminProductListPage,
          ),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./features/admin/products/product-form.page').then(
            (module) => module.AdminProductFormPage,
          ),
      },
      {
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./features/admin/products/product-form.page').then(
            (module) => module.AdminProductFormPage,
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/admin/categories/categories.page').then(
            (module) => module.AdminCategoriesPage,
          ),
      },
      {
        path: 'collections',
        loadComponent: () =>
          import('./features/admin/collections/collections.page').then(
            (module) => module.AdminCollectionsPage,
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/admin/orders/order-list.page').then(
            (module) => module.AdminOrderListPage,
          ),
      },
      {
        path: 'orders/:orderNumber',
        loadComponent: () =>
          import('./features/admin/orders/order-detail.page').then(
            (module) => module.AdminOrderDetailPage,
          ),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/admin/customers/customer-list.page').then(
            (module) => module.AdminCustomerListPage,
          ),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./features/admin/reviews/reviews.page').then((module) => module.AdminReviewsPage),
      },
      {
        path: 'coupons',
        loadComponent: () =>
          import('./features/admin/coupons/coupons.page').then((module) => module.AdminCouponsPage),
      },
      {
        path: 'banners',
        loadComponent: () =>
          import('./features/admin/banners/banners.page').then((module) => module.AdminBannersPage),
      },
      {
        path: 'pages',
        loadComponent: () =>
          import('./features/admin/pages/pages.page').then((module) => module.AdminPagesPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/admin/settings/settings.page').then(
            (module) => module.AdminSettingsPage,
          ),
      },
    ],
  },
  {
    path: '',
    component: StorefrontLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/storefront/home/home.page').then((module) => module.HomePage),
      },
      {
        path: 'shop',
        loadComponent: () =>
          import('./features/storefront/shop/shop.page').then((module) => module.ShopPage),
      },
      {
        path: 'product/:slug',
        loadComponent: () =>
          import('./features/storefront/product/product.page').then((module) => module.ProductPage),
      },
      {
        path: 'collections',
        loadComponent: () =>
          import('./features/storefront/collections/collections.page').then(
            (module) => module.CollectionsPage,
          ),
      },
      {
        path: 'collections/:slug',
        loadComponent: () =>
          import('./features/storefront/collections/collection.page').then(
            (module) => module.CollectionPage,
          ),
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('./features/storefront/cart/cart.page').then((module) => module.CartPage),
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./features/storefront/checkout/checkout.page').then(
            (module) => module.CheckoutPage,
          ),
      },
      {
        path: 'order/:orderNumber',
        loadComponent: () =>
          import('./features/storefront/checkout/order-success.page').then(
            (module) => module.OrderSuccessPage,
          ),
      },
      {
        path: 'track-order',
        loadComponent: () =>
          import('./features/storefront/track-order/track-order.page').then(
            (module) => module.TrackOrderPage,
          ),
      },
      {
        // Guests keep a local wishlist that is merged into their account on sign-in.
        path: 'wishlist',
        loadComponent: () =>
          import('./features/storefront/wishlist/wishlist.page').then(
            (module) => module.WishlistPage,
          ),
      },
      {
        path: 'login',
        canActivate: [guestOnlyGuard],
        loadComponent: () =>
          import('./features/storefront/auth/login.page').then((module) => module.LoginPage),
      },
      {
        path: 'register',
        canActivate: [guestOnlyGuard],
        loadComponent: () =>
          import('./features/storefront/auth/register.page').then((module) => module.RegisterPage),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/storefront/auth/forgot-password.page').then(
            (module) => module.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/storefront/auth/reset-password.page').then(
            (module) => module.ResetPasswordPage,
          ),
      },
      {
        path: 'account',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/storefront/account/account.page').then((module) => module.AccountPage),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/storefront/account/profile.page').then(
                (module) => module.AccountProfilePage,
              ),
          },
          {
            path: 'orders',
            loadComponent: () =>
              import('./features/storefront/account/orders.page').then(
                (module) => module.AccountOrdersPage,
              ),
          },
          {
            path: 'orders/:orderNumber',
            loadComponent: () =>
              import('./features/storefront/account/order-detail.page').then(
                (module) => module.AccountOrderDetailPage,
              ),
          },
          {
            path: 'addresses',
            loadComponent: () =>
              import('./features/storefront/account/addresses.page').then(
                (module) => module.AccountAddressesPage,
              ),
          },
        ],
      },
      {
        path: 'pages/:slug',
        loadComponent: () =>
          import('./features/storefront/cms/page-view.page').then((module) => module.PageViewPage),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/storefront/not-found/not-found.page').then(
            (module) => module.NotFoundPage,
          ),
      },
    ],
  },
];
