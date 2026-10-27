import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CatalogService, Product } from '../core/catalog.service';
import { AuthService } from '../core/auth.service';
import { CommerceService } from '../core/commerce.service';
import { CustomWorkService } from '../core/custom-work.service';
import { ProtectedArtworkComponent } from '../core/protected-artwork.component';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink, ProtectedArtworkComponent],
  template: `
    @if (loading()) {
      <div class="detail-state">Loading design…</div>
    } @else if (error()) {
      <div class="detail-state error"><p>{{ error() }}</p><a class="button secondary" routerLink="/" fragment="shop">Back to collection</a></div>
    } @else if (product(); as item) {
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a routerLink="/">Home</a><span>/</span><a routerLink="/" fragment="shop">Collection</a><span>/</span><span>{{ item.title }}</span>
      </nav>

      <section class="product-detail">
        <div class="detail-preview" (contextmenu)="$event.preventDefault()">
          @if (item.is_featured) { <span class="featured-label">Featured</span> }
          <app-protected-artwork [src]="item.preview_url" [alt]="item.title + ' watermarked preview'" [showWatermark]="true"></app-protected-artwork>
        </div>

        <div class="detail-copy">
          <div class="eyebrow">{{ item.category.name }} / {{ item.product_type_display }}</div>
          <h1>{{ item.title }}</h1>
          <p class="detail-lead">{{ item.short_description }}</p>
          <div class="detail-price">{{ item.price | currency:item.currency:'symbol':'1.0-2' }} <small>Digital product</small></div>

          <div class="detail-actions">
            <button class="button primary" type="button" [disabled]="actionLoading()" (click)="addToBag(item)">Add to bag <span>+</span></button>
            <button class="button buy-now" type="button" [disabled]="actionLoading()" (click)="buyNow(item)">Buy now <span>→</span></button>
            <button class="button secondary" type="button" (click)="requestCustom(item)">Request a custom version</button>
          </div>
          @if (actionMessage()) { <p class="action-message" role="status">{{ actionMessage() }}</p> }
          <p class="delivery-note"><span>↓</span> Original files become available after verified payment.</p>

          <dl class="product-facts">
            <div><dt>File formats</dt><dd>{{ item.file_formats.join(', ') }}</dd></div>
            <div><dt>Dimensions</dt><dd>{{ item.dimensions || 'Flexible' }}</dd></div>
            <div><dt>Resolution</dt><dd>{{ item.resolution || '300 DPI' }}</dd></div>
            <div><dt>Colour mode</dt><dd>{{ item.color_mode || 'CMYK + RGB' }}</dd></div>
            <div><dt>License</dt><dd>{{ item.license_type_display }}</dd></div>
          </dl>
        </div>
      </section>

      <section class="detail-description">
        <div><span class="section-number">ABOUT THIS DESIGN</span><h2>Made to look sharp.<br><em>Prepared to work.</em></h2></div>
        <div><p>{{ item.description }}</p><p>Every download is organized for a smooth handoff. Preview images remain watermarked; purchased originals are delivered privately from your account.</p></div>
      </section>

      @if (relatedProducts().length > 0 || relatedLoading()) {
        <section class="related-collection">
          <div class="related-heading">
            <div>
              <span class="section-number">MORE IN {{ item.category.name.toUpperCase() }}</span>
              <h2>From this <em>collection.</em></h2>
            </div>
            <div class="related-meta">
              <span>Showing {{ relatedProducts().length }} of {{ relatedTotal() }} designs</span>
            </div>
          </div>

          @if (relatedLoading()) {
            <div class="catalog-message">Loading more from {{ item.category.name }}…</div>
          } @else {
            <div class="product-grid">
              @for (rel of relatedProducts(); track rel.id) {
                <article class="product-card" (contextmenu)="$event.preventDefault()">
                  <a class="product-preview" [routerLink]="['/shop', rel.slug]" draggable="false">
                    @if (rel.is_featured) { <span class="featured-label">Featured</span> }
                    <app-protected-artwork [src]="rel.preview_url" [alt]="rel.title + ' watermarked preview'"></app-protected-artwork>
                    <span class="view-design">View design <span>↗</span></span>
                  </a>
                  <div class="product-meta">
                    <div>
                      <span class="product-category">{{ rel.category.name }}</span>
                      <h2><a [routerLink]="['/shop', rel.slug]">{{ rel.title }}</a></h2>
                    </div>
                    <strong>{{ rel.price | currency:rel.currency:'symbol':'1.0-2' }}</strong>
                  </div>
                  <p>{{ rel.short_description }}</p>
                  <div class="product-specs">
                    <span>{{ rel.dimensions }}</span>
                    <span>{{ rel.file_formats.join(' · ') }}</span>
                  </div>
                </article>
              }
            </div>

            @if (hasMoreRelated()) {
              <div class="load-more-wrap">
                <button class="button secondary" type="button" [disabled]="loadingMoreRelated()" (click)="loadMoreRelated()">
                  {{ loadingMoreRelated() ? 'Loading…' : 'See more' }} <span>↓</span>
                </button>
              </div>
            }
          }
        </section>
      }

      <section class="customize-strip" id="customize">
        <div><span class="eyebrow">Need a different size, colour, or message?</span><h2>Make it yours.</h2></div>
        <div><p>Send your requirements and receive a clear quote before any custom work begins.</p><button class="button light" type="button" (click)="requestCustom(item)">Start a conversation <span>→</span></button></div>
      </section>
    }
  `
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly commerce = inject(CommerceService);
  private readonly customWork = inject(CustomWorkService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionLoading = signal(false);
  readonly actionMessage = signal('');

  readonly relatedProducts = signal<Product[]>([]);
  readonly relatedTotal = signal(0);
  readonly relatedLoading = signal(false);
  readonly loadingMoreRelated = signal(false);
  readonly hasMoreRelated = signal(false);
  private relatedPage = 1;
  private readonly relatedPageSize = 8; // 2 rows of 4 cards

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const slug = params.get('slug');
      if (!slug) {
        this.loading.set(false);
        this.error.set('This design could not be found.');
        return;
      }
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      this.loadProduct(slug);
    });
  }

  private loadProduct(slug: string): void {
    this.loading.set(true);
    this.error.set('');
    this.actionMessage.set('');
    this.relatedProducts.set([]);
    this.relatedTotal.set(0);
    this.hasMoreRelated.set(false);
    this.relatedPage = 1;

    this.catalog.product(slug).subscribe({
      next: product => {
        this.product.set(product);
        this.loading.set(false);
        this.loadRelated(product.category.slug, product.slug, true);
      },
      error: () => {
        this.error.set('This design is unavailable or could not be found.');
        this.loading.set(false);
      }
    });
  }

  loadMoreRelated(): void {
    const current = this.product();
    if (!current || !this.hasMoreRelated() || this.loadingMoreRelated()) return;
    this.relatedPage += 1;
    this.loadingMoreRelated.set(true);
    this.loadRelated(current.category.slug, current.slug, false);
  }

  private loadRelated(categorySlug: string, excludeSlug: string, reset: boolean): void {
    if (reset) {
      this.relatedLoading.set(true);
    }
    this.catalog.collectionProducts(categorySlug, excludeSlug, this.relatedPage, this.relatedPageSize)
      .pipe(finalize(() => {
        this.relatedLoading.set(false);
        this.loadingMoreRelated.set(false);
      }))
      .subscribe({
        next: page => {
          this.relatedProducts.update(existing => reset ? page.results : [...existing, ...page.results]);
          this.relatedTotal.set(page.count);
          this.hasMoreRelated.set(Boolean(page.next));
        },
        error: () => undefined
      });
  }

  addToBag(item: Product): void {
    if (!this.ensureSignedIn(item.slug)) return;
    this.actionLoading.set(true);
    this.commerce.addToCart(item.id).subscribe({
      next: () => { this.actionMessage.set('Added to your bag.'); this.actionLoading.set(false); },
      error: () => { this.actionMessage.set('Could not add this design. Please try again.'); this.actionLoading.set(false); }
    });
  }

  buyNow(item: Product): void {
    if (!this.ensureSignedIn(item.slug)) return;
    this.actionLoading.set(true);
    this.commerce.buyNow(item.id).subscribe({
      next: order => this.router.navigate(['/checkout', order.id]),
      error: () => { this.actionMessage.set('Checkout could not be started.'); this.actionLoading.set(false); }
    });
  }

  requestCustom(item: Product): void {
    this.customWork.openChat({
      startNew: true,
      title: `Custom: ${item.title}`,
      request_type: 'MODIFICATION'
    });
  }

  private ensureSignedIn(slug: string): boolean {
    if (this.auth.isSignedIn()) return true;
    this.auth.openAuthModal('login', `/shop/${slug}`);
    return false;
  }
}
