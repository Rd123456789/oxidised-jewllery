import type { SortOrder } from 'mongoose';

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  [key: string]: unknown;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 100;

export function parsePagination(query: Record<string, unknown>): Pagination {
  const rawPage = Number(query['page']);
  const rawLimit = Number(query['limit']);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : DEFAULT_PAGE;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

export function buildPaginationMeta(total: number, pagination: Pagination): PaginationMeta {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
  };
}

export type SortDirection = 'asc' | 'desc';

export function buildSort(
  sortBy: string | undefined,
  allowed: string[],
  fallback: Record<string, SortOrder> = { createdAt: -1 },
): Record<string, SortOrder> {
  if (!sortBy) {
    return fallback;
  }

  const descending = sortBy.startsWith('-');
  const field = descending ? sortBy.slice(1) : sortBy;

  if (!allowed.includes(field)) {
    return fallback;
  }

  return { [field]: descending ? -1 : 1 };
}

export function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => String(entry).split(',')).map((entry) => entry.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return undefined;
}
