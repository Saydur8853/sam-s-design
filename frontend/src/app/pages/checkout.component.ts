import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CommerceService, Order } from '../core/commerce.service';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <section class="checkout-page">
      @if (order(); as current) {
        <div class="checkout-copy"><div class="eyebrow">Secure checkout</div><h1>Review and pay.</h1><p>Payment happens on a hosted gateway page. The backend—not the browser redirect—confirms the transaction before downloads unlock.</p><div class="security-points"><span>✓ Server-verified payment</span><span>✓ Private original files</span><span>✓ Download audit trail</span></div></div>
        <aside class="checkout-card">
          @for (item of current.items; track item.id) { <div class="checkout-product"><img [src]="item.preview_url" [alt]="item.product_title" width="70" height="88"><div><strong>{{ item.product_title }}</strong><small>Digital download</small></div><b>{{ item.line_total | currency:current.currency }}</b></div> }
          <div class="checkout-total"><span>Total due</span><strong>{{ current.total | currency:current.currency }}</strong></div>
          @if (current.status === 'PAID') { <a class="button primary full" [routerLink]="['/payment-result']" [queryParams]="{order: current.id}">View downloads</a> }
          @else { <button class="button primary full" type="button" [disabled]="paying()" (click)="pay(current)">{{ paying() ? 'Opening gateway…' : 'Pay with Demo Gateway' }} <span>↗</span></button> }
          @if (error()) { <p class="form-error">{{ error() }}</p> }
          <small class="demo-note">Development gateway: no real money or card details are used.</small>
        </aside>
      } @else { <div class="detail-state">Loading checkout…</div> }
    </section>
  `
})
export class CheckoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly commerce = inject(CommerceService);
  readonly order = signal<Order | null>(null);
  readonly paying = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('orderId') || '';
    if (!this.auth.isSignedIn()) { this.router.navigate(['/sign-in'], { queryParams: { returnUrl: `/checkout/${id}` } }); return; }
    this.commerce.order(id).subscribe({ next: order => this.order.set(order), error: () => this.router.navigateByUrl('/#shop') });
  }
  pay(order: Order): void {
    this.paying.set(true); this.error.set('');
    this.commerce.createPayment(order.id).subscribe({
      next: session => window.location.assign(session.checkout_url),
      error: response => { this.error.set(response.error?.detail || 'Payment gateway could not be opened.'); this.paying.set(false); }
    });
  }
}

