import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  template: ``
})
export class AuthComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const mode = this.route.snapshot.data['mode'] === 'register' ? 'register' : 'login';
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || undefined;
    this.router.navigateByUrl('/', { replaceUrl: true }).then(() => {
      this.auth.openAuthModal(mode, returnUrl);
    });
  }
}
