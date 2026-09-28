import { Injectable, inject } from '@angular/core';
import { ApiClient, type QueryParams } from '../api/api-client';
import type {
  ApiMeta,
  Banner,
  Category,
  Collection,
  Coupon,
  CmsPage,
  CustomerSummary,
  DashboardStats,
  InventoryRow,
  ManagedReview,
  NewsletterSubscriber,
  Order,
  OrderStats,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductQuery,
  ProductSummary,
  StoreSettings,
} from '../api/api.models';

export interface Paged<T> {
  items: T[];
  meta: ApiMeta;
}

export interface ProductInput {
  name: string;
  slug?: string;
  sku?: string;
  shortDescription?: string;
  description?: string;
  category: string;
  collections?: string[];
  tags?: string[];
  price: number;
  mrp?: number;
  costPrice?: number;
  stock?: number;
  lowStockThreshold?: number;
  images?: { url: string; publicId?: string; alt?: string; isPrimary?: boolean; sortOrder?: number }[];
  variants?: {
    name: string;
    sku: string;
    price: number;
    mrp?: number;
    stock: number;
    image?: string;
    isActive?: boolean;
  }[];
  colors?: string[];
  materials?: string[];
  stones?: string[];
  occasions?: string[];
  specifications?: { label: string; value: string }[];
  weightGrams?: number;
  careInstructions?: string;
  badges?: string[];
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isActive?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
}

export interface CategoryInput {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  image?: { url: string; publicId?: string; alt?: string };
  icon?: string;
  parent?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface CollectionInput {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  heroImage?: { url: string; publicId?: string; alt?: string };
  thumbnail?: { url: string; publicId?: string; alt?: string };
  themeColor?: string;
  products?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CouponInput {
  code: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startsAt?: string;
  expiresAt?: string;
  firstOrderOnly?: boolean;
  isActive?: boolean;
}

export interface BannerInput {
  title: string;
  subtitle?: string;
  description?: string;
  image: { url: string; publicId?: string; alt?: string };
  mobileImage?: { url: string; publicId?: string; alt?: string };
  ctaLabel?: string;
  ctaUrl?: string;
  position?: Banner['position'];
  textAlign?: Banner['textAlign'];
  theme?: Banner['theme'];
  sortOrder?: number;
  isActive?: boolean;
}

export interface PageInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  isPublished?: boolean;
  showInFooter?: boolean;
  showInHeader?: boolean;
  sortOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiClient);

  // --- dashboard -----------------------------------------------------------
  dashboardStats(days = 30): Promise<DashboardStats> {
    return this.api.get<DashboardStats>('/admin/dashboard/stats', { days });
  }

  inventory(): Promise<InventoryRow[]> {
    return this.api.get<InventoryRow[]>('/admin/dashboard/inventory');
  }

  // --- products ------------------------------------------------------------
  async products(query: ProductQuery = {}): Promise<Paged<ProductSummary>> {
    const result = await this.api.getWithMeta<ProductSummary[]>(
      '/admin/products',
      query as QueryParams,
    );

    return { items: result.data, meta: result.meta ?? {} };
  }

  product(id: string): Promise<Product> {
    return this.api.get<Product>(`/admin/products/${id}`);
  }

  createProduct(payload: ProductInput): Promise<Product> {
    return this.api.post<Product>('/admin/products', payload);
  }

  updateProduct(id: string, payload: Partial<ProductInput>): Promise<Product> {
    return this.api.put<Product>(`/admin/products/${id}`, payload);
  }

  deleteProduct(id: string, hard = false): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/products/${id}`, { hard });
  }

  duplicateProduct(id: string): Promise<Product> {
    return this.api.post<Product>(`/admin/products/${id}/duplicate`);
  }

  updateStock(id: string, stock: number, lowStockThreshold?: number): Promise<Product> {
    return this.api.patch<Product>(`/admin/products/${id}/stock`, { stock, lowStockThreshold });
  }

  updateVariantStock(id: string, sku: string, stock: number): Promise<Product> {
    return this.api.patch<Product>(`/admin/products/${id}/variant-stock`, { sku, stock });
  }

  updateProductFlags(
    id: string,
    flags: Partial<Pick<Product, 'isActive' | 'isFeatured' | 'isNewArrival' | 'isBestSeller'>>,
  ): Promise<Product> {
    return this.api.patch<Product>(`/admin/products/${id}/flags`, flags);
  }

  // --- categories ----------------------------------------------------------
  categories(): Promise<Category[]> {
    return this.api.get<Category[]>('/admin/categories');
  }

  createCategory(payload: CategoryInput): Promise<Category> {
    return this.api.post<Category>('/admin/categories', payload);
  }

  updateCategory(id: string, payload: Partial<CategoryInput>): Promise<Category> {
    return this.api.put<Category>(`/admin/categories/${id}`, payload);
  }

  deleteCategory(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/categories/${id}`);
  }

  reorderCategories(items: { id: string; sortOrder: number }[]): Promise<unknown> {
    return this.api.patch('/admin/categories/reorder', { items });
  }

  // --- collections ---------------------------------------------------------
  collections(): Promise<Collection[]> {
    return this.api.get<Collection[]>('/admin/collections');
  }

  createCollection(payload: CollectionInput): Promise<Collection> {
    return this.api.post<Collection>('/admin/collections', payload);
  }

  updateCollection(id: string, payload: Partial<CollectionInput>): Promise<Collection> {
    return this.api.put<Collection>(`/admin/collections/${id}`, payload);
  }

  deleteCollection(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/collections/${id}`);
  }

  // --- orders --------------------------------------------------------------
  async orders(query: Record<string, unknown> = {}): Promise<Paged<Order>> {
    const result = await this.api.getWithMeta<Order[]>(
      '/admin/orders',
      query as QueryParams,
    );

    return { items: result.data, meta: result.meta ?? {} };
  }

  orderStats(): Promise<OrderStats> {
    return this.api.get<OrderStats>('/admin/orders/stats');
  }

  order(orderNumber: string): Promise<Order> {
    return this.api.get<Order>(`/admin/orders/${orderNumber}`);
  }

  updateOrderStatus(
    orderNumber: string,
    payload: {
      status: OrderStatus;
      note?: string;
      cancelReason?: string;
      paymentStatus?: PaymentStatus;
      adminNote?: string;
      tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string };
    },
  ): Promise<Order> {
    return this.api.patch<Order>(`/admin/orders/${orderNumber}/status`, payload);
  }

  orderExportUrl(query: Record<string, unknown> = {}): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }

    const suffix = params.toString();

    return `/api/v1/admin/orders/export${suffix ? `?${suffix}` : ''}`;
  }

  // --- customers -----------------------------------------------------------
  async customers(query: Record<string, unknown> = {}): Promise<Paged<CustomerSummary>> {
    const result = await this.api.getWithMeta<CustomerSummary[]>(
      '/admin/customers',
      query as QueryParams,
    );

    return { items: result.data, meta: result.meta ?? {} };
  }

  customer(id: string): Promise<{
    customer: CustomerSummary & { addresses: unknown[] };
    stats: { orderCount: number; lifetimeValue: number };
    orders: Order[];
  }> {
    return this.api.get(`/admin/customers/${id}`);
  }

  updateCustomer(id: string, payload: Record<string, unknown>): Promise<CustomerSummary> {
    return this.api.patch<CustomerSummary>(`/admin/customers/${id}`, payload);
  }

  deleteCustomer(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/customers/${id}`);
  }

  // --- reviews -------------------------------------------------------------
  async reviews(query: Record<string, unknown> = {}): Promise<Paged<ManagedReview>> {
    const result = await this.api.getWithMeta<ManagedReview[]>(
      '/admin/reviews',
      query as QueryParams,
    );

    return { items: result.data, meta: result.meta ?? {} };
  }

  moderateReview(
    id: string,
    payload: { status: ManagedReview['status']; adminReply?: string },
  ): Promise<ManagedReview> {
    return this.api.patch<ManagedReview>(`/admin/reviews/${id}`, payload);
  }

  deleteReview(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/reviews/${id}`);
  }

  // --- coupons -------------------------------------------------------------
  async coupons(query: Record<string, unknown> = {}): Promise<Paged<Coupon>> {
    const result = await this.api.getWithMeta<Coupon[]>('/admin/coupons', query as QueryParams);

    return { items: result.data, meta: result.meta ?? {} };
  }

  createCoupon(payload: CouponInput): Promise<Coupon> {
    return this.api.post<Coupon>('/admin/coupons', payload);
  }

  updateCoupon(id: string, payload: Partial<CouponInput>): Promise<Coupon> {
    return this.api.put<Coupon>(`/admin/coupons/${id}`, payload);
  }

  deleteCoupon(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/coupons/${id}`);
  }

  // --- banners -------------------------------------------------------------
  banners(): Promise<Banner[]> {
    return this.api.get<Banner[]>('/admin/banners');
  }

  createBanner(payload: BannerInput): Promise<Banner> {
    return this.api.post<Banner>('/admin/banners', payload);
  }

  updateBanner(id: string, payload: Partial<BannerInput>): Promise<Banner> {
    return this.api.put<Banner>(`/admin/banners/${id}`, payload);
  }

  deleteBanner(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/banners/${id}`);
  }

  // --- pages ---------------------------------------------------------------
  pages(): Promise<CmsPage[]> {
    return this.api.get<CmsPage[]>('/admin/pages');
  }

  createPage(payload: PageInput): Promise<CmsPage> {
    return this.api.post<CmsPage>('/admin/pages', payload);
  }

  updatePage(id: string, payload: Partial<PageInput>): Promise<CmsPage> {
    return this.api.put<CmsPage>(`/admin/pages/${id}`, payload);
  }

  deletePage(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/pages/${id}`);
  }

  // --- settings ------------------------------------------------------------
  settings(): Promise<StoreSettings> {
    return this.api.get<StoreSettings>('/admin/settings');
  }

  saveSettings(payload: Partial<StoreSettings>): Promise<StoreSettings> {
    return this.api.put<StoreSettings>('/admin/settings', payload);
  }

  // --- newsletter ----------------------------------------------------------
  async subscribers(query: Record<string, unknown> = {}): Promise<Paged<NewsletterSubscriber>> {
    const result = await this.api.getWithMeta<NewsletterSubscriber[]>(
      '/admin/newsletter',
      query as QueryParams,
    );

    return { items: result.data, meta: result.meta ?? {} };
  }

  deleteSubscriber(id: string): Promise<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/admin/newsletter/${id}`);
  }
}
