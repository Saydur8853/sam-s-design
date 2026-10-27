import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const designerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSignedIn()) return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: '/studio' } });
  return auth.ensureUser().pipe(
    map(user => user?.role === 'DESIGNER' ? true : router.createUrlTree(['/'])),
    catchError(() => of(router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: '/studio' } })))
  );
};
