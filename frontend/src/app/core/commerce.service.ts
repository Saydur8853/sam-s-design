import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Product } from './catalog.service';

export interface CartItem { id: number; product: Product; quantity: number; line_total: string; }
export interface Cart { id: number; items: CartItem[]; total: string; item_count: number; }
export interface OrderItem { id: number; product_title: string; product_slug: string; preview_url: string; unit_price: string; quantity: number; line_total: string; }
export interface Order { id: string; status: string; total: string; currency: string; created_at: string; paid_at: string | null; items: OrderItem[]; }
export interface Download {
  id: number;
  product_title: string;
  display_name: string;
  granted_at: string;
  download_url: string;
  max_downloads?: number;
  download_count?: number;
  remaining_downloads?: number;
}

@Injectable({ providedIn: 'root' })
export class CommerceService {
  private readonly http = inject(HttpClient);
  readonly cart = signal<Cart | null>(null);

  loadCart(): Observable<Cart> { return this.http.get<Cart>('/api/v1/cart/').pipe(tap(cart => this.cart.set(cart))); }
  addToCart(productId: number): Observable<Cart> { return this.http.post<Cart>('/api/v1/cart/items/', { product_id: productId }).pipe(tap(cart => this.cart.set(cart))); }
  removeCartItem(itemId: number): Observable<Cart> { return this.http.delete<Cart>(`/api/v1/cart/items/${itemId}/`).pipe(tap(cart => this.cart.set(cart))); }
  checkoutCart(): Observable<Order> { return this.http.post<Order>('/api/v1/orders/checkout-cart/', {}).pipe(tap(() => this.cart.set(null))); }
  buyNow(productId: number): Observable<Order> { return this.http.post<Order>('/api/v1/orders/buy-now/', { product_id: productId }); }
  order(orderId: string): Observable<Order> { return this.http.get<Order>(`/api/v1/orders/${orderId}/`); }
  createPayment(orderId: string): Observable<{ transaction_id: string; checkout_url: string }> { return this.http.post<{ transaction_id: string; checkout_url: string }>('/api/v1/payments/demo/session/', { order_id: orderId }); }
  downloads(): Observable<Download[]> { return this.http.get<Download[]>('/api/v1/downloads/'); }
  downloadFile(item: Download, onComplete?: () => void): void {
    this.http.get(item.download_url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = item.display_name;
        anchor.click();
        URL.revokeObjectURL(url);
        if (onComplete) onComplete();
      },
      error: () => {
        if (onComplete) onComplete();
      }
    });
  }
}

