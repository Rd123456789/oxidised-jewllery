import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from './api.config';
import { ApiError } from './api-error';
import type { ApiMeta } from './api.models';

export type QueryValue = string | number | boolean | null | undefined | (string | number)[];
export type QueryParams = Record<string, QueryValue>;

export interface ApiResult<T> {
  data: T;
  meta?: ApiMeta;
  message?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
  message?: string;
  error?: { code: string; message: string; details?: unknown };
}

export function toHttpParams(params?: QueryParams): HttpParams {
  let httpParams = new HttpParams();

  if (!params) {
    return httpParams;
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        httpParams = httpParams.append(key, String(entry));
      }

      continue;
    }

    httpParams = httpParams.set(key, String(value));
  }

  return httpParams;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiEnvelope<unknown> | { error?: ApiError['details'] } | null;

    if (body && typeof body === 'object' && 'error' in body && body.error) {
      const payload = body.error as { code: string; message: string; details?: unknown };

      return new ApiError(error.status, payload.code ?? 'HTTP_ERROR', payload.message, payload.details);
    }

    if (error.status === 0) {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'Cannot reach the store server. Make sure the API is running on port 5000.',
      );
    }

    return new ApiError(
      error.status,
      'HTTP_ERROR',
      error.message || `Request failed with status ${error.status}`,
    );
  }

  return new ApiError(
    0,
    'UNKNOWN_ERROR',
    error instanceof Error ? error.message : 'Something went wrong',
  );
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams): Promise<T> {
    return this.getWithMeta<T>(path, params).then((result) => result.data);
  }

  getWithMeta<T>(path: string, params?: QueryParams): Promise<ApiResult<T>> {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(
    path: string,
    body?: unknown,
    params?: QueryParams,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('POST', path, body, params, headers).then((result) => result.data);
  }

  postWithMeta<T>(path: string, body?: unknown, params?: QueryParams): Promise<ApiResult<T>> {
    return this.request<T>('POST', path, body, params);
  }

  put<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>('PUT', path, body, params).then((result) => result.data);
  }

  patch<T>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this.request<T>('PATCH', path, body, params).then((result) => result.data);
  }

  delete<T>(path: string, params?: QueryParams): Promise<T> {
    return this.request<T>('DELETE', path, undefined, params).then((result) => result.data);
  }

  upload<T>(path: string, files: File[], params?: QueryParams): Promise<T> {
    const formData = new FormData();

    for (const file of files) {
      formData.append('images', file, file.name);
    }

    return this.request<T>('POST', path, formData, params).then((result) => result.data);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    params?: QueryParams,
    headers?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    try {
      const envelope = await firstValueFrom(
        this.http.request<ApiEnvelope<T>>(method, `${API_PREFIX}${path}`, {
          body,
          params: toHttpParams(params),
          headers,
          withCredentials: true,
        }),
      );

      if (!envelope) {
        throw new ApiError(500, 'EMPTY_RESPONSE', 'The server returned an empty response');
      }

      return { data: envelope.data, meta: envelope.meta, message: envelope.message };
    } catch (error) {
      throw toApiError(error);
    }
  }
}
