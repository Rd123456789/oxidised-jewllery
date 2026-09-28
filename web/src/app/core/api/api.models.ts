export type ID = string;

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  sessionId?: string;
  [key: string]: unknown;
}

export interface ImageAsset {
  url: string;
  publicId?: string;
  alt?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface Category {
  id: ID;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  image?: ImageAsset;
  icon?: string;
  parent?: ID | { id: ID; name: string; slug: string } | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  productCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Collection {
  id: ID;
  name: string;
  slug: string;
  tagline?: string;
  description?: string;
  heroImage?: ImageAsset;
  thumbnail?: ImageAsset;
  themeColor?: string;
  products?: (ID | { id: ID; name: string; slug: string; price?: number })[];
  productCount?: number;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface ProductVariant {
  name: string;
  sku: string;
  price: number;
  mrp?: number;
  stock: number;
  image?: string;
  isActive: boolean;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductSummary {
  id: ID;
  name: string;
  slug: string;
  sku: string;
  price: number;
  mrp?: number;
  discountPercent: number;
  currency: string;
  image?: string;
  inStock: boolean;
  stock: number;
  lowStockThreshold?: number;
  rating: number;
  ratingCount: number;
  badges: string[];
  colors: string[];
  occasions: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  category?: { id: ID; name: string; slug: string };
  createdAt?: string;
}

export interface Product {
  id: ID;
  name: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  category: { id: ID; name: string; slug: string };
  collections?: { id: ID; name: string; slug: string; themeColor?: string }[];
  tags: string[];
  price: number;
  mrp?: number;
  costPrice?: number;
  currency: string;
  stock: number;
  lowStockThreshold: number;
  images: ImageAsset[];
  variants: ProductVariant[];
  colors: string[];
  materials: string[];
  stones: string[];
  occasions: string[];
  specifications: ProductSpecification[];
  weightGrams?: number;
  dimensions?: { lengthCm?: number; widthCm?: number; heightCm?: number };
  careInstructions?: string;
  badges: string[];
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  publishedAt?: string;
  ratingsAverage: number;
  ratingsCount: number;
  soldCount: number;
  viewCount: number;
  inStock: boolean;
  discountPercent: number;
  primaryImage?: ImageAsset;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductFacets {
  colors: string[];
  materials: string[];
  stones: string[];
  occasions: string[];
  tags: string[];
  priceRange: { min: number; max: number };
}

export interface ProductReview {
  id: ID;
  rating: number;
  title?: string;
  body?: string;
  images: string[];
  authorName: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  adminReply?: { message: string; repliedAt: string };
  createdAt: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
  breakdown: Record<string, number>;
}

export interface ProductReviewsResponse {
  reviews: ProductReview[];
  summary: ReviewSummary;
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
  category?: string;
  collection?: string;
  minPrice?: number;
  maxPrice?: number;
  colors?: string[];
  materials?: string[];
  stones?: string[];
  occasions?: string[];
  tags?: string[];
  inStock?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
  onSale?: boolean;
  minRating?: number;
  status?: 'all' | 'active' | 'draft' | 'out_of_stock';
}

export interface PricingBreakdown {
  subtotal: number;
  discount: number;
  shippingFee: number;
  taxAmount: number;
  total: number;
  currency: string;
  couponCode?: string;
  freeShipping: boolean;
}

export interface CartItem {
  id: ID;
  product: ID;
  variantSku?: string;
  name: string;
  slug: string;
  image?: string;
  unitPrice: number;
  mrp?: number;
  quantity: number;
  lineTotal: number;
}

export interface CartView {
  id: ID;
  sessionId?: string;
  items: CartItem[];
  itemCount: number;
  couponCode?: string;
  pricing: PricingBreakdown;
}

export interface Address {
  id?: ID;
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault?: boolean;
}

export type UserRole = 'customer' | 'manager' | 'admin';

export interface AuthUser {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  emailVerified: boolean;
  marketingOptIn: boolean;
  isActive: boolean;
  addresses: Address[];
  lastLoginAt?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'cod' | 'razorpay' | 'upi' | 'manual';

export interface OrderItem {
  product: ID;
  variantSku?: string;
  name: string;
  slug: string;
  image?: string;
  sku: string;
  unitPrice: number;
  mrp?: number;
  quantity: number;
  lineTotal: number;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  note?: string;
  changedAt: string;
}

export interface OrderTracking {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface Order {
  id: ID;
  orderNumber: string;
  invoiceNumber?: string;
  user?: ID | { id: ID; name: string; email: string; phone?: string } | null;
  guestEmail?: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address;
  pricing: PricingBreakdown;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    providerOrderId?: string;
    providerPaymentId?: string;
    paidAt?: string;
  };
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  tracking: OrderTracking;
  customerNote?: string;
  adminNote?: string;
  cancelReason?: string;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOrderPayload {
  items?: { productId: ID; variantSku?: string; quantity: number }[];
  shippingAddress: Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };
  billingAddress?: Omit<Address, 'id' | 'isDefault'>;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  customerNote?: string;
  guestEmail?: string;
  saveAddress?: boolean;
}

export interface OrderQuote {
  items: {
    productId: ID;
    name: string;
    sku: string;
    image?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  pricing: PricingBreakdown;
  codEnabled: boolean;
  currency: string;
}

export interface Banner {
  id: ID;
  title: string;
  subtitle?: string;
  description?: string;
  image: ImageAsset;
  mobileImage?: ImageAsset;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  position: 'hero' | 'category_strip' | 'promo_strip' | 'sidebar' | 'checkout';
  textAlign: 'left' | 'center' | 'right';
  theme: 'light' | 'dark';
  sortOrder: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface CmsPage {
  id: ID;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  isPublished: boolean;
  showInFooter: boolean;
  showInHeader: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface PageLink {
  id: ID;
  title: string;
  slug: string;
  sortOrder: number;
}

export interface Coupon {
  id: ID;
  code: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
  startsAt?: string;
  expiresAt?: string;
  firstOrderOnly: boolean;
  isActive: boolean;
}

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

export interface StoreSettings extends PublicSettings {
  logo?: { url: string; publicId?: string };
  gstNumber?: string;
  lowStockThreshold: number;
  maintenanceMode: boolean;
}

export interface ManagedReview {
  id: ID;
  rating: number;
  title?: string;
  body?: string;
  images: string[];
  authorName: string;
  status: 'pending' | 'approved' | 'rejected';
  isVerifiedPurchase: boolean;
  product?: { id: ID; name: string; slug: string };
  user?: { id: ID; name: string; email: string };
  adminReply?: { message: string; repliedAt: string };
  createdAt: string;
}

export interface NewsletterSubscriber {
  id: ID;
  email: string;
  isSubscribed: boolean;
  source?: string;
  createdAt: string;
}

export interface CustomerSummary {
  id: ID;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  marketingOptIn: boolean;
  createdAt: string;
  lastLoginAt?: string;
  orderCount: number;
  lifetimeValue: number;
}

export interface SalesPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface DashboardStats {
  revenue: { total: number; averageOrderValue: number; currency: string };
  orders: { total: number; pending: number; byStatus: { status: string; count: number }[] };
  customers: { total: number; newInRange: number };
  catalogue: { products: number; lowStock: number; outOfStock: number };
  reviews: { pending: number };
  newsletter: { subscribers: number };
  recentOrders: Order[];
    topProducts: {
      id: ID;
      name: string;
      slug: string;
      image?: string;
      quantity: number;
      revenue: number;
    }[];
  salesSeries: SalesPoint[];
}

export interface InventoryRow {
  id: ID;
  name: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  price: number;
  category?: { id: ID; name: string };
  variantCount: number;
  lowStock: boolean;
}

export interface OrderStats {
  today: { count: number; revenue: number };
  week: { count: number; revenue: number };
  month: { count: number; revenue: number };
  byStatus: { status: string; count: number }[];
  byPaymentMethod: { method: string; count: number }[];
}

export interface UploadResult {
  provider: 'cloudinary' | 'local';
  maxFileSizeMb: number;
  assets: {
    url: string;
    publicId: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
  }[];
}

export interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  placedAt: string;
  items: OrderItem[];
  pricing: PricingBreakdown;
  tracking: OrderTracking;
  statusHistory: StatusHistoryEntry[];
  customerName: string;
}

export interface SearchSuggestProduct {
  id: ID;
  name: string;
  slug: string;
  image?: string;
  price: number;
  mrp?: number;
  currency: string;
  inStock: boolean;
}

export interface SearchSuggestCategory {
  id: ID;
  name: string;
  slug: string;
  productCount: number;
}

export interface SearchSuggestCollection {
  id: ID;
  name: string;
  slug: string;
}

export interface SearchSuggestions {
  query: string;
  products: SearchSuggestProduct[];
  categories: SearchSuggestCategory[];
  collections: SearchSuggestCollection[];
}
