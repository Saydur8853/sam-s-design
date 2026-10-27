import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CommerceService, Download, Order } from '../core/commerce.service';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  template: `
    <section class="payment-result">
      @if (order(); as current) {
        @if (current.status === 'PAID') {
          <div class="success-mark">✓</div><div class="eyebrow">Payment verified</div><h1>Your files<br><em>are ready.</em></h1><p>Order {{ current.id }} · {{ current.total | currency:current.currency }}</p>
          <div class="download-list">
            @for (file of downloads(); track file.id) {
              <article>
                <div>
                  <strong>{{ file.product_title }}</strong>
                  <span>{{ file.display_name }} · {{ file.remaining_downloads ?? 5 }} of {{ file.max_downloads ?? 5 }} downloads remaining</span>
                </div>
                <button class="button primary" type="button" [disabled]="file.remaining_downloads === 0" (click)="triggerDownload(file)">
                  {{ file.remaining_downloads === 0 ? 'Limit reached' : 'Download original ↓' }}
                </button>
              </article>
            }
            @empty { <p>Your entitlement is being prepared. Refresh this page in a moment.</p> }
          </div>
        } @else { <h1>Payment pending.</h1><p>The order has not been marked paid. Downloads remain locked.</p><a class="button primary" [routerLink]="['/checkout', current.id]">Return to checkout</a> }
      } @else { <div class="detail-state">Verifying your order…</div> }
    </section>
  `
})
export class PaymentResultComponent implements OnInit {
  readonly commerce = inject(CommerceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly order = signal<Order | null>(null);
  readonly downloads = signal<Download[]>([]);
  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('order') || '';
    if (!this.auth.isSignedIn()) { this.auth.openAuthModal('login', `/payment-result?order=${id}`); return; }
    this.commerce.order(id).subscribe({ next: order => { this.order.set(order); if (order.status === 'PAID') this.refreshDownloads(); }, error: () => this.router.navigateByUrl('/#shop') });
  }

  triggerDownload(file: Download): void {
    this.commerce.downloadFile(file, () => this.refreshDownloads());
  }

  private refreshDownloads(): void {
    this.commerce.downloads().subscribe(files => this.downloads.set(files));
  }
}

