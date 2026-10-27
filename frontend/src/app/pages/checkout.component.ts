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
        <div class="checkout-copy">
          <div class="eyebrow">International Secure Checkout</div>
          <h1>Review and pay.</h1>
          <p>Pay securely from anywhere in the world using Visa, Mastercard, American Express, PayPal, Apple Pay, or Google Pay. Your original files unlock immediately upon verified payment.</p>
          <div class="security-points">
            <span>✓ 256-bit SSL encrypted</span>
            <span>✓ Global cards &amp; PayPal</span>
            <span>✓ Instant original file unlock</span>
          </div>
        </div>
        <aside class="checkout-card">
          @for (item of current.items; track item.id) {
            <div class="checkout-product">
              <img [src]="item.preview_url" [alt]="item.product_title" width="70" height="88">
              <div><strong>{{ item.product_title }}</strong><small>Digital original license</small></div>
              <b>{{ item.line_total | currency:current.currency }}</b>
            </div>
          }
          <div class="checkout-total"><span>Total due</span><strong>{{ current.total | currency:current.currency }}</strong></div>

          <div class="payment-method-badges" aria-label="Supported payment methods">
            <span>VISA</span>
            <span>Mastercard</span>
            <span>AMEX</span>
            <span>PayPal</span>
            <span> Pay</span>
            <span>G Pay</span>
          </div>

          @if (current.status === 'PAID') {
            <a class="button primary full" [routerLink]="['/payment-result']" [queryParams]="{order: current.id}">View downloads</a>
          } @else {
            <button class="button primary full" type="button" [disabled]="paying()" (click)="pay(current)">
              {{ paying() ? 'Redirecting to secure checkout…' : 'Pay with Card / PayPal' }} <span>↗</span>
            </button>
          }
          @if (error()) { <p class="form-error">{{ error() }}</p> }
          <small class="demo-note">Global payment processing powered by Lemon Squeezy / Stripe.</small>
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
    if (!this.auth.isSignedIn()) {
      this.auth.openAuthModal('login', `/checkout/${id}`);
      this.router.navigateByUrl('/');
      return;
    }
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

