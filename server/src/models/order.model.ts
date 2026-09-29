import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { schemaOptions } from './common.js';

export type PaymentMethod = 'cod' | 'razorpay' | 'upi' | 'manual';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
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

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
];

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
];

export interface OrderAddress {
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
}

export interface OrderItem {
  product: Types.ObjectId;
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

export interface OrderPricing {
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  taxAmount: number;
  total: number;
  currency: string;
  couponCode?: string;
  freeShipping: boolean;
}

export interface PaymentDetails {
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSignature?: string;
  paidAt?: Date;
  failureReason?: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  note?: string;
  changedBy?: Types.ObjectId;
  changedAt: Date;
}

export interface OrderTracking {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface OrderDocument {
  orderNumber: string;
  invoiceNumber?: string;
  user: Types.ObjectId | null;
  guestEmail?: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  shippingAddress: OrderAddress;
  billingAddress?: OrderAddress;
  pricing: OrderPricing;
  payment: PaymentDetails;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  tracking: OrderTracking;
  customerNote?: string;
  adminNote?: string;
  cancelReason?: string;
  cancelledAt?: Date;
  placedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderHydratedDocument = HydratedDocument<OrderDocument>;

const orderAddressSchema = new Schema<OrderAddress>(
  {
    label: { type: String, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'India' },
  },
  { _id: false },
);

const orderItemSchema = new Schema<OrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    image: { type: String, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    unitPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDocument>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    invoiceNumber: { type: String, trim: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestEmail: { type: String, lowercase: true, trim: true, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    items: { type: [orderItemSchema], default: [] },
    shippingAddress: { type: orderAddressSchema, required: true },
    billingAddress: { type: orderAddressSchema },
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      shippingFee: { type: Number, default: 0, min: 0 },
      codFee: { type: Number, default: 0, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'INR', uppercase: true },
      couponCode: { type: String, trim: true, uppercase: true },
      freeShipping: { type: Boolean, default: false },
    },
    payment: {
      method: { type: String, enum: ['cod', 'razorpay', 'upi', 'manual'], default: 'cod' },
      status: {
        type: String,
        enum: PAYMENT_STATUSES,
        default: 'pending',
        index: true,
      },
      amount: { type: Number, default: 0, min: 0 },
      providerOrderId: { type: String, trim: true },
      providerPaymentId: { type: String, trim: true },
      providerSignature: { type: String, trim: true },
      paidAt: { type: Date },
      failureReason: { type: String, trim: true },
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
      index: true,
    },
    statusHistory: {
      type: [
        new Schema<StatusHistoryEntry>(
          {
            status: { type: String, enum: ORDER_STATUSES, required: true },
            note: { type: String, trim: true },
            changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
            changedAt: { type: Date, default: () => new Date() },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    tracking: {
      carrier: { type: String, trim: true },
      trackingNumber: { type: String, trim: true },
      trackingUrl: { type: String, trim: true },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
    },
    customerNote: { type: String, trim: true, maxlength: 1000 },
    adminNote: { type: String, trim: true, maxlength: 2000 },
    cancelReason: { type: String, trim: true, maxlength: 500 },
    cancelledAt: { type: Date },
    placedAt: { type: Date, default: () => new Date(), index: true },
  },
  schemaOptions,
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'pricing.total': 1 });
orderSchema.index({ customerPhone: 1 });

export const Order = model<OrderDocument>('Order', orderSchema);
