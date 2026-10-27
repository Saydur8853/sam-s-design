import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CommerceService } from '../core/commerce.service';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <section class="commerce-page">
      <div class="commerce-heading"><div class="eyebrow">Your selection</div><h1>Your bag.</h1><p>Prices are confirmed by the server when your order is created.</p></div>
      @if (loading()) { <div class="commerce-empty">Loading your bag…</div> }
      @else if (!commerce.cart()?.items?.length) {
        <div class="commerce-empty"><h2>Your bag is empty.</h2><p>Explore the collection and choose a design that feels right.</p><a class="button primary" routerLink="/" fragment="shop">Browse designs</a></div>
      } @else if (commerce.cart(); as cart) {
        <div class="cart-layout">
          <div class="cart-items">
            @for (item of cart.items; track item.id) {
              <article class="cart-item">
                <img [src]="item.product.preview_url" [alt]="item.product.title" width="120" height="150">
                <div><span class="product-category">{{ item.product.category.name }}</span><h2><a [routerLink]="['/shop', item.product.slug]">{{ item.product.title }}</a></h2><p>{{ item.product.file_formats.join(' · ') }}</p><button type="button" (click)="remove(item.id)">Remove</button></div>
                <strong>{{ item.line_total | currency:item.product.currency }}</strong>
              </article>
            }
          </div>
          <aside class="order-summary"><span class="eyebrow">Order summary</span><div><span>{{ cart.item_count }} item(s)</span><strong>{{ cart.total | currency:'USD' }}</strong></div><div><span>Digital delivery</span><strong>Free</strong></div><div class="summary-total"><span>Total</span><strong>{{ cart.total | currency:'USD' }}</strong></div><button class="button primary full" type="button" [disabled]="checkingOut()" (click)="checkout()">{{ checkingOut() ? 'Preparing…' : 'Continue to checkout' }}</button><small>Original files unlock only after verified payment.</small></aside>
        </div>
      }
    </section>
  `
})
export class CartComponent implements OnInit {
  readonly commerce = inject(CommerceService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(true);
  readonly checkingOut = signal(false);

  ngOnInit(): void {
    if (!this.auth.isSignedIn()) { this.router.navigateByUrl('/'); this.auth.openAuthModal('login', '/cart'); return; }
    this.commerce.loadCart().subscribe({ next: () => this.loading.set(false), error: () => this.loading.set(false) });
  }
  remove(id: number): void { this.commerce.removeCartItem(id).subscribe(); }
  checkout(): void {
    this.checkingOut.set(true);
    this.commerce.checkoutCart().subscribe({ next: order => this.router.navigate(['/checkout', order.id]), error: () => this.checkingOut.set(false) });
  }
}

