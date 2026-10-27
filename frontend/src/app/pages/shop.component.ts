import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CatalogService, Category, Product } from '../core/catalog.service';
import { ProtectedArtworkComponent } from '../core/protected-artwork.component';

@Component({
  standalone: true,
  imports: [CurrencyPipe, RouterLink, ProtectedArtworkComponent],
  template: `
    <section class="page-heading">
      <div class="eyebrow">Ready-made collection</div>
      <h1>Find your next<br><em>visual statement.</em></h1>
      <p>Original posters, flexible templates, and print-ready artwork—designed with personality and prepared with care.</p>
    </section>

    <section class="catalog-toolbar" aria-label="Product filters">
      <button type="button" [class.selected]="!activeCategory()" (click)="selectCategory('')">All work</button>
      @for (category of categories(); track category.id) {
        <button type="button" [class.selected]="activeCategory() === category.slug" (click)="selectCategory(category.slug)">{{ category.name }}</button>
      }
    </section>

    <section class="product-section">
      <div class="catalog-summary"><span>{{ products().length }} designs</span><span>Instant digital download</span></div>
      @if (loading()) {
        <div class="catalog-message">Curating the collection…</div>
      } @else if (error()) {
        <div class="catalog-message error">{{ error() }}</div>
      } @else {
        <div class="product-grid">
          @for (product of products(); track product.id; let index = $index) {
            <article class="product-card" (contextmenu)="$event.preventDefault()">
              <a class="product-preview" [routerLink]="['/shop', product.slug]" draggable="false">
                @if (product.is_featured) { <span class="featured-label">Featured</span> }
                <app-protected-artwork [src]="product.preview_url" [alt]="product.title + ' watermarked preview'"></app-protected-artwork>
                <span class="view-design">View design <span>↗</span></span>
              </a>
              <div class="product-meta">
                <div><span class="product-category">{{ product.category.name }}</span><h2><a [routerLink]="['/shop', product.slug]">{{ product.title }}</a></h2></div>
                <strong>{{ product.price | currency:product.currency:'symbol':'1.0-2' }}</strong>
              </div>
              <p>{{ product.short_description }}</p>
              <div class="product-specs"><span>{{ product.dimensions }}</span><span>{{ product.file_formats.join(' · ') }}</span></div>
            </article>
          } @empty {
            <div class="catalog-message">No designs found in this category yet.</div>
          }
        </div>
      }
    </section>
  `
})
export class ShopComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly activeCategory = signal('');
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.catalog.categories().subscribe(categories => this.categories.set(categories));
    this.loadProducts();
  }

  selectCategory(slug: string): void {
    this.activeCategory.set(slug);
    this.loadProducts();
  }

  private loadProducts(): void {
    this.loading.set(true);
    this.error.set('');
    this.catalog.products(this.activeCategory()).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: products => this.products.set(products),
      error: () => this.error.set('The collection could not be loaded. Make sure the backend server is running.')
    });
  }
}

