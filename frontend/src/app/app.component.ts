import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthModalComponent } from './core/auth-modal.component';
import { AuthService } from './core/auth.service';
import { ChatWidgetComponent } from './core/chat-widget.component';
import { CommerceService } from './core/commerce.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, ChatWidgetComponent, AuthModalComponent],
  template: `
    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="sameulshajid.art home">
        <span class="brand-logo-frame"><img class="brand-logo" src="/brand/samis-design-logo.jpg" alt="Sami's design logo" width="48" height="48"></span>
        <span>sameulshajid<span class="accent">.art</span></span>
      </a>
      <div class="header-actions">
        @if (auth.isSignedIn()) {
          @if (auth.isDesigner()) {
            <a class="header-pill studio-pill" routerLink="/studio">
              <span class="studio-dot"></span>
              Studio
            </a>
          }
          <div class="user-menu-wrap">
            <button
              class="user-chip"
              type="button"
              (click)="toggleUserMenu($event)"
              [attr.aria-expanded]="userMenuOpen()"
              aria-label="Account menu">
              @if (auth.currentUser()?.avatar_url; as photo) {
                <img class="user-avatar-img" [src]="photo" alt="">
              } @else {
                <span class="user-avatar">{{ userInitials() }}</span>
              }
              <span class="user-meta">
                <strong>{{ userDisplayName() }}</strong>
                <small>{{ auth.currentUser()?.email || 'Signed in' }}</small>
              </span>
              <svg class="user-chevron" [class.open]="userMenuOpen()" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            @if (userMenuOpen()) {
              <div class="user-dropdown" role="menu">
                <div class="user-dropdown-head">
                  @if (auth.currentUser()?.avatar_url; as photo) {
                    <img class="user-avatar-img large" [src]="photo" alt="">
                  } @else {
                    <span class="user-avatar large">{{ userInitials() }}</span>
                  }
                  <div>
                    <span class="user-role-badge">{{ auth.isDesigner() ? 'Designer' : 'Customer' }}</span>
                    <strong>{{ userDisplayName() }}</strong>
                    <small>{{ auth.currentUser()?.email }}</small>
                  </div>
                </div>
                <div class="user-dropdown-actions">
                  <a routerLink="/profile" [queryParams]="{ tab: 'profile' }" (click)="userMenuOpen.set(false)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Edit profile & photo
                  </a>
                  <a routerLink="/profile" [queryParams]="{ tab: 'password' }" (click)="userMenuOpen.set(false)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Change password
                  </a>
                  @if (auth.isDesigner()) {
                    <a routerLink="/studio" (click)="userMenuOpen.set(false)">
                      <span>✦</span> Designer Studio
                    </a>
                  }
                  <button class="signout-btn" type="button" (click)="signOut()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <button class="header-pill signin-pill" type="button" (click)="auth.openAuthModal('login')">Sign in</button>
        }

        <a class="cart-button" routerLink="/cart" aria-label="Shopping cart">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span class="cart-label">Bag</span>
          <span class="cart-count">{{ commerce.cart()?.item_count || 0 }}</span>
        </a>
      </div>
    </header>
    <main><router-outlet /></main>
    <app-chat-widget />
    <app-auth-modal />
    @if (securityToast()) {
      <div class="artwork-security-toast" role="status" aria-live="polite">
        <span class="security-toast-icon" aria-hidden="true">🔒</span>
        <span>{{ securityToast() }}</span>
      </div>
    }
    <footer>
      <a class="brand footer-brand" routerLink="/"><span class="brand-logo-frame"><img class="brand-logo" src="/brand/samis-design-logo.jpg" alt="Sami's design logo" width="48" height="48"></span><span>sameulshajid<span class="accent">.art</span></span></a>
      <p>Thoughtful design, ready when you are.</p>
      <small>© 2026 sameulshajid.art. All rights reserved.</small>
    </footer>
  `
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly commerce = inject(CommerceService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly userMenuOpen = signal(false);
  readonly securityToast = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly userDisplayName = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 'Account';
    if (user.profile?.display_name?.trim()) return user.profile.display_name.trim();
    const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    if (full) return full;
    return user.email.split('@')[0] || 'Account';
  });

  readonly userInitials = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 'U';
    const first = user.first_name?.trim()?.[0] || '';
    const last = user.last_name?.trim()?.[0] || '';
    if (first || last) return (first + last).toUpperCase();
    return (user.email?.[0] || 'U').toUpperCase();
  });

  constructor() {
    if (this.auth.isSignedIn()) {
      this.auth.me().subscribe({ error: () => undefined });
      this.commerce.loadCart().subscribe({ error: () => undefined });
    }
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update(open => !open);
  }

  signOut(): void {
    this.userMenuOpen.set(false);
    this.commerce.cart.set(null);
    this.auth.signOut();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const wrap = this.elementRef.nativeElement.querySelector('.user-menu-wrap');
    if (wrap && !event.composedPath().includes(wrap)) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'img, canvas, app-protected-artwork, .product-preview, .detail-preview, .image-attachment, .chat-img-attach, .lightbox-card'
      )
    ) {
      event.preventDefault();
      this.showSecurityToast('Artwork is protected © sameulshajid.art');
    }
  }

  @HostListener('document:dragstart', ['$event'])
  onDocumentDragStart(event: DragEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'img, canvas, app-protected-artwork, .product-preview, .detail-preview, .image-attachment, .chat-img-attach, .lightbox-card'
      )
    ) {
      event.preventDefault();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.showSecurityToast('Direct page saving is disabled to protect artwork.');
    }
  }

  private showSecurityToast(message: string): void {
    this.securityToast.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.securityToast.set(''), 2400);
  }
}
