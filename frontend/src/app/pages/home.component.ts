import { CurrencyPipe } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogService, Category, Product } from '../core/catalog.service';
import { CustomWorkService } from '../core/custom-work.service';
import { ProtectedArtworkComponent } from '../core/protected-artwork.component';

@Component({
  standalone: true,
  imports: [RouterLink, CurrencyPipe, ReactiveFormsModule, ProtectedArtworkComponent],
  template: `
    <section class="hero">
      <div class="eyebrow">Independent graphic design studio</div>
      <h1>Design that makes<br><em>people pause<span class="pause-dot">.</span></em></h1>
      <p class="hero-copy">Distinctive posters, print-ready artwork, and tailored visuals crafted to give your ideas a stronger voice.</p>
      <div class="hero-actions">
        <a class="button primary" routerLink="/" fragment="shop">Explore the collection <span>↗</span></a>
        <button class="button secondary" type="button" (click)="customWork.openChat()">Start a custom project</button>
      </div>
    </section>

    <section class="home-shop" id="shop">
      <div class="collection-controls">
        <div class="catalog-toolbar" aria-label="Product filters">
          <button type="button" [class.selected]="!activeCategory()" (click)="selectCategory('')">All work</button>
          @for (category of categories(); track category.id) {
            <button type="button" [class.selected]="activeCategory() === category.slug" (click)="selectCategory(category.slug)">{{ category.name }}</button>
          }
        </div>

        <div class="catalog-search">
          <label for="catalog-search-input">Search the collection</label>
          <div>
            <span aria-hidden="true">⌕</span>
            <input id="catalog-search-input" type="text" role="searchbox" inputmode="search" [formControl]="searchControl" placeholder="Search designs" autocomplete="off">
            @if (searchControl.value) { <button type="button" (click)="searchControl.setValue('')" aria-label="Clear search">×</button> }
          </div>
        </div>
      </div>

      <div class="home-product-wrap">
        <div class="catalog-summary"><span>Showing {{ products().length }} of {{ totalCount() }} designs</span><span>Instant digital download</span></div>
        @if (loading()) {
          <div class="catalog-message">Curating the collection…</div>
        } @else if (error()) {
          <div class="catalog-message error">{{ error() }}</div>
        } @else {
          <div class="product-grid">
            @for (product of products(); track product.id) {
              <article class="product-card" (contextmenu)="$event.preventDefault()">
                <a class="product-preview" [routerLink]="['/shop', product.slug]" draggable="false">
                  @if (product.is_featured) { <span class="featured-label">Featured</span> }
                  <app-protected-artwork [src]="product.preview_url" [alt]="product.title + ' watermarked preview'"></app-protected-artwork>
                  <span class="view-design">View design <span>↗</span></span>
                </a>
                <div class="product-meta"><div><span class="product-category">{{ product.category.name }}</span><h2><a [routerLink]="['/shop', product.slug]">{{ product.title }}</a></h2></div><strong>{{ product.price | currency:product.currency:'symbol':'1.0-2' }}</strong></div>
                <p>{{ product.short_description }}</p>
                <div class="product-specs"><span>{{ product.dimensions }}</span><span>{{ product.file_formats.join(' · ') }}</span></div>
              </article>
            } @empty {
              <div class="catalog-message">No designs match “{{ searchControl.value }}”. Try another search.</div>
            }
          </div>
          <div #scrollSentinel class="infinite-scroll-sentinel" aria-live="polite">
            @if (loadingMore()) {
              <div class="infinite-scroll-loader">
                <span class="scroll-spinner" aria-hidden="true"></span>
                <span>Loading more designs…</span>
              </div>
            }
          </div>
        }
      </div>
    </section>

    <section class="custom-cta" id="custom">
      <span class="eyebrow">Have something specific in mind?</span>
      <h2>Let’s create it together.</h2>
      <p>Share your brief, references, timeline, and budget. You’ll receive a clear quote before work begins.</p>
      <button class="button light" type="button" (click)="customWork.openChat()">Start a conversation <span>→</span></button>
    </section>
  `
})
export class HomeComponent implements OnInit, AfterViewInit {
  private readonly catalog = inject(CatalogService);
  private readonly destroyRef = inject(DestroyRef);
  readonly customWork = inject(CustomWorkService);
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly activeCategory = signal('');
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal('');
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly totalCount = signal(0);
  readonly hasMore = signal(false);
  private currentPage = 1;
  private observer: IntersectionObserver | null = null;

  @ViewChild('scrollSentinel')
  set scrollSentinelRef(el: ElementRef<HTMLElement> | undefined) {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (el?.nativeElement && typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            this.loadMore();
          }
        },
        { rootMargin: '0px 0px 360px 0px', threshold: 0.01 }
      );
      this.observer.observe(el.nativeElement);
    }
  }

  ngOnInit(): void {
    this.catalog.categories().subscribe(categories => this.categories.set(categories));
    this.loadProducts();
    this.searchControl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.loadProducts(true));

    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
    });
  }

  ngAfterViewInit(): void {
    this.checkScrollPosition();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.checkScrollPosition();
  }

  selectCategory(slug: string): void {
    this.activeCategory.set(slug);
    this.loadProducts(true);
  }

  loadMore(): void {
    if (!this.hasMore() || this.loadingMore() || this.loading()) return;
    this.currentPage += 1;
    this.loadingMore.set(true);
    this.loadProducts(false);
  }

  private checkScrollPosition(): void {
    if (!this.hasMore() || this.loadingMore() || this.loading() || typeof document === 'undefined') return;
    const sentinel = document.querySelector('.infinite-scroll-sentinel');
    if (!sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 360) {
      this.loadMore();
    }
  }

  private loadProducts(reset = true): void {
    if (reset) {
      this.currentPage = 1;
      this.products.set([]);
      this.loading.set(true);
    }
    this.error.set('');
    this.catalog.products(this.activeCategory(), this.currentPage, this.searchControl.value).pipe(finalize(() => { this.loading.set(false); this.loadingMore.set(false); })).subscribe({
      next: page => {
        this.products.update(current => reset ? page.results : [...current, ...page.results]);
        this.totalCount.set(page.count);
        this.hasMore.set(Boolean(page.next));
        setTimeout(() => this.checkScrollPosition(), 120);
      },
      error: () => this.error.set('The collection could not be loaded. Make sure the backend server is running.')
    });
  }
}

