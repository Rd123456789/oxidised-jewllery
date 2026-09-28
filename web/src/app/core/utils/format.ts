import type { OrderStatus, PaymentStatus } from '../api/api.models';

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
];

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned', 'refunded'],
  cancelled: [],
  returned: ['refunded'],
  refunded: [],
};

export function formatCurrency(
  amount: number | null | undefined,
  currency = 'INR',
  locale = 'en-IN',
): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

export function formatDate(value?: string | Date | null): string {
  if (!value) {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function titleCase(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function relativeTime(value?: string | Date | null): string {
  if (!value) {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return formatDate(date);
}

export function nextOrderStatuses(current: OrderStatus): OrderStatus[] {
  return STATUS_TRANSITIONS[current] ?? [];
}

export type Tone = 'neutral' | 'info' | 'progress' | 'success' | 'danger';

export function orderStatusTone(status: OrderStatus): Tone {
  switch (status) {
    case 'pending':
      return 'neutral';
    case 'confirmed':
    case 'processing':
    case 'packed':
      return 'info';
    case 'shipped':
      return 'progress';
    case 'delivered':
      return 'success';
    case 'cancelled':
    case 'returned':
    case 'refunded':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function paymentStatusTone(status: PaymentStatus): Tone {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'neutral';
    case 'failed':
      return 'danger';
    case 'refunded':
    case 'partially_refunded':
      return 'progress';
    default:
      return 'neutral';
  }
}

export function statusProgressIndex(status: OrderStatus): number {
  return ORDER_STATUS_FLOW.indexOf(status);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function trackingUrlFor(carrier: string | undefined, trackingNumber: string | undefined): string | null {
  if (!trackingNumber) {
    return null;
  }

  const normalized = (carrier ?? '').toLowerCase();

  if (normalized.includes('delhivery')) {
    return `https://www.delhivery.com/track/package/${trackingNumber}`;
  }

  if (normalized.includes('bluedart')) {
    return `https://www.bluedart.com/tracking/${trackingNumber}`;
  }

  if (normalized.includes('indiapost') || normalized.includes('speed post')) {
    return `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`;
  }

  return null;
}
