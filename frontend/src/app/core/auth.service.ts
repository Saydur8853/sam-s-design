import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, of, switchMap, tap } from 'rxjs';

export interface UserProfile {
  display_name: string;
  phone: string;
  country: string;
  avatar_url: string | null;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'CUSTOMER' | 'DESIGNER';
  avatar_url: string | null;
  profile: UserProfile | null;
}

export interface AuthResponse {
  user?: User;
  access?: string;
  refresh?: string;
  verification_required?: boolean;
  verification_id?: string;
  email?: string;
  expires_in_seconds?: number;
  demo_email_url?: string;
}

export interface VerificationStatusResponse {
  status: 'PENDING' | 'APPROVED' | 'EXPIRED';
  remaining_seconds?: number;
  user?: User;
  access?: string;
  refresh?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly accessKey = 'sameulshajid_access';
  private readonly refreshKey = 'sameulshajid_refresh';
  private readonly signedIn = signal(Boolean(sessionStorage.getItem(this.accessKey) || localStorage.getItem(this.accessKey)));
  private readonly user = signal<User | null>(null);

  readonly isSignedIn = computed(() => this.signedIn());
  readonly currentUser = computed(() => this.user());
  readonly isDesigner = computed(() => this.user()?.role === 'DESIGNER');

  readonly authModalOpen = signal(false);
  readonly authModalMode = signal<'login' | 'register'>('login');
  readonly returnUrl = signal<string | null>(null);
  lastOpenedAt = 0;
  private authPopup: Window | null = null;

  constructor() {
    this.consumeUrlTokens();
    if (typeof window !== 'undefined') {
      const handleSyncTokens = (data: { type?: string; access?: string; refresh?: string } | null | undefined) => {
        if (data && data.access) {
          try {
            localStorage.removeItem('sameulshajid_oauth_sync');
          } catch {}
          try {
            if (this.authPopup && !this.authPopup.closed) {
              this.authPopup.close();
            }
          } catch {}
          this.authPopup = null;
          this.acceptTokens({ access: data.access, refresh: data.refresh });
        }
      };

      window.addEventListener('message', (event: MessageEvent) => {
        if (event.data && event.data.type === 'AUTH_TOKENS') {
          handleSyncTokens(event.data);
        }
      });

      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === 'sameulshajid_oauth_sync' && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            handleSyncTokens(parsed);
          } catch {}
        }
      });

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('sameulshajid_auth_channel');
          bc.onmessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'AUTH_TOKENS') {
              handleSyncTokens(event.data);
            }
          };
        } catch {}
      }
    }
    if (this.signedIn()) {
      queueMicrotask(() => this.me().subscribe({ error: () => undefined }));
    }
  }

  openAuthModal(mode: 'login' | 'register' = 'login', returnUrl?: string): void {
    this.authModalMode.set(mode);
    if (returnUrl) this.returnUrl.set(returnUrl);
    this.lastOpenedAt = Date.now();
    this.authModalOpen.set(true);
  }

  closeAuthModal(): void {
    this.authModalOpen.set(false);
  }

  openGoogleAuthPopup(): void {
    const width = 460;
    const height = 600;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    this.authPopup = window.open(
      '/api/v1/auth/google/authorize/',
      'google_auth_popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  }

  register(payload: Record<string, unknown>): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/register/', payload).pipe(
      tap(response => {
        if (response.access) this.store(response);
      })
    );
  }

  resendVerification(email: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/resend-verification/', { email });
  }

  checkVerificationStatus(verificationId: string): Observable<VerificationStatusResponse> {
    return this.http.get<VerificationStatusResponse>(`/api/v1/auth/verify-status/${verificationId}/`);
  }

  acceptTokens(tokens: AuthResponse): void {
    if (!tokens.access) return;
    this.store(tokens);
    this.closeAuthModal();
    this.me().subscribe({
      next: () => {
        const target = this.returnUrl();
        this.returnUrl.set(null);
        if (target) this.router.navigateByUrl(target);
      },
      error: () => undefined
    });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/token/', { email, password }).pipe(
      tap(tokens => this.store(tokens)),
      switchMap(tokens => this.me().pipe(map(user => ({ ...tokens, user }))))
    );
  }

  me(): Observable<User> {
    return this.http.get<User>('/api/v1/auth/me/').pipe(tap(user => this.user.set(user)));
  }

  updateProfile(payload: FormData): Observable<User> {
    return this.http.patch<User>('/api/v1/auth/me/', payload).pipe(tap(user => this.user.set(user)));
  }

  changePassword(payload: { current_password: string; new_password: string; new_password_confirm: string }): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>('/api/v1/auth/change-password/', payload);
  }

  ensureUser(): Observable<User | null> {
    if (!this.isSignedIn()) return of(null);
    return this.user() ? of(this.user()) : this.me();
  }

  accessToken(): string | null { return sessionStorage.getItem(this.accessKey) || localStorage.getItem(this.accessKey); }
  refreshToken(): string | null { return sessionStorage.getItem(this.refreshKey) || localStorage.getItem(this.refreshKey); }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/v1/auth/token/refresh/', { refresh: this.refreshToken() }).pipe(tap(tokens => this.store(tokens)));
  }

  signOut(): void {
    const refresh = this.refreshToken();
    this.clearSession();
    this.router.navigateByUrl('/');
    if (refresh) {
      this.http.post('/api/v1/auth/logout/', { refresh }).subscribe({ error: () => undefined });
    }
  }

  clearSession(): void {
    sessionStorage.removeItem(this.accessKey);
    sessionStorage.removeItem(this.refreshKey);
    localStorage.removeItem(this.accessKey);
    localStorage.removeItem(this.refreshKey);
    this.signedIn.set(false);
    this.user.set(null);
  }

  private consumeUrlTokens(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const access = params.get('auth_access');
    const refresh = params.get('auth_refresh');
    if (access) {
      this.store({ access, refresh: refresh || '' });
      params.delete('auth_access');
      params.delete('auth_refresh');
      const query = params.toString();
      const cleanUrl = window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  }

  private store(tokens: AuthResponse): void {
    if (!tokens.access) return;
    sessionStorage.setItem(this.accessKey, tokens.access);
    if (tokens.refresh) sessionStorage.setItem(this.refreshKey, tokens.refresh);
    localStorage.removeItem(this.accessKey);
    localStorage.removeItem(this.refreshKey);
    this.signedIn.set(true);
    if (tokens.user) this.user.set(tokens.user);
  }
}
