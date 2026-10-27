import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authorized = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  const isAuthEndpoint = request.url.includes('/auth/token/') || request.url.includes('/auth/register/');

  return next(authorized).pipe(catchError(error => {
    if (error.status !== 401 || isAuthEndpoint || !auth.refreshToken()) return throwError(() => error);
    return auth.refresh().pipe(
      switchMap(() => {
        const refreshed = auth.accessToken();
        return next(refreshed ? request.clone({ setHeaders: { Authorization: `Bearer ${refreshed}` } }) : request);
      }),
      catchError(refreshError => {
        auth.clearSession();
        return throwError(() => refreshError);
      })
    );
  }));
};

