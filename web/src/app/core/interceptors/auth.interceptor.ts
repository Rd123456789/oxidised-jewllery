import type { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_PREFIX } from '../api/api.config';
import {
  CART_SESSION_HEADER_NAME,
  ensureCartSessionId,
  getAccessToken,
  notifySessionExpired,
  runTokenRefresh,
} from '../auth/session.store';

const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/admin/login'];

function isApiRequest(url: string): boolean {
  return url.startsWith(API_PREFIX) || url.startsWith('/api/');
}

function shouldAttemptRefresh(url: string): boolean {
  return !NO_REFRESH_PATHS.some((path) => url.includes(path));
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiRequest(request.url)) {
    return next(request);
  }

  const headers: Record<string, string> = {
    [CART_SESSION_HEADER_NAME]: ensureCartSessionId(),
  };

  const token = getAccessToken();

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const authorized = request.clone({ setHeaders: headers, withCredentials: true });

  return next(authorized).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !shouldAttemptRefresh(request.url)) {
        return throwError(() => error);
      }

      return from(runTokenRefresh()).pipe(
        switchMap((refreshedToken) => {
          if (!refreshedToken) {
            notifySessionExpired();

            return throwError(() => error);
          }

          return next(
            request.clone({
              setHeaders: { ...headers, Authorization: `Bearer ${refreshedToken}` },
              withCredentials: true,
            }),
          );
        }),
      );
    }),
  );
};
