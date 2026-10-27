import { Component, DestroyRef, HostListener, OnInit, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { AuthService } from './auth.service';
import { CommerceService } from './commerce.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    @if (auth.authModalOpen()) {
      <div class="auth-modal-backdrop" (click)="onBackdropClick($event)">
        <section class="auth-modal" role="dialog" aria-modal="true" aria-label="Authentication" (click)="$event.stopPropagation()">
          <header class="auth-modal-head">
            <div class="auth-mode-tabs">
              <button type="button" [class.active]="auth.authModalMode() === 'login' && !verificationId()" (click)="switchMode('login')">
                Sign in
              </button>
              <button type="button" [class.active]="auth.authModalMode() === 'register' || Boolean(verificationId())" (click)="switchMode('register')">
                Create account
              </button>
            </div>
            <button class="chat-icon-btn" type="button" (click)="auth.closeAuthModal()" aria-label="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </header>

          @if (verificationId()) {
            <div class="auth-verify-box">
              <span class="user-role-badge">Email Verification Required</span>
              <h2>Approve your sign-up</h2>
              <p>
                We sent an approval link to <strong>{{ pendingEmail() }}</strong>.
                Open the email and press the <strong>Approve</strong> button inside the box to automatically sign in.
              </p>

              <div class="verify-timer-card" [class.expired]="remainingSeconds() <= 0">
                @if (remainingSeconds() > 0) {
                  <span class="verify-pulse"></span>
                  <div>
                    <strong>Waiting for approval…</strong>
                    <small>Link expires in {{ formatCountdown(remainingSeconds()) }}</small>
                  </div>
                } @else {
                  <div>
                    <strong>Verification link expired (10 min limit)</strong>
                    <small>Request a fresh approval link below.</small>
                  </div>
                }
              </div>

              @if (demoEmailUrl()) {
                <button class="button buy-now full" type="button" (click)="openDemoEmail()">
                  Open Email &amp; Approve Box <span>↗</span>
                </button>
              }

              <div class="verify-actions-row">
                <button class="button secondary full" type="button" [disabled]="resending()" (click)="resendEmail()">
                  {{ resending() ? 'Sending new link…' : 'Resend verification link' }}
                </button>
                <button class="text-button" type="button" (click)="resetVerification()">← Change email</button>
              </div>
            </div>
          } @else {
            <div class="auth-modal-body">
              <h2>{{ isRegister() ? 'Join the studio.' : 'Welcome back.' }}</h2>
              <p class="auth-modal-sub">
                {{ isRegister() ? 'Create your account with email verification or Google.' : 'Access your purchases, downloads, and custom projects.' }}
              </p>

              <button class="google-auth-btn" type="button" (click)="auth.openGoogleAuthPopup()">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"/>
                  <path fill="#FBBC05" d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"/>
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"/>
                </svg>
                <span>{{ isRegister() ? 'Sign up with Google' : 'Continue with Google' }}</span>
              </button>

              <div class="auth-divider"><span>or continue with email</span></div>

              <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
                <input type="text" formControlName="website" class="honeypot-field" tabindex="-1" autocomplete="off" aria-hidden="true">

                @if (isRegister()) {
                  <div class="field-row">
                    <div class="form-field">
                      <label for="modal-first-name">First name</label>
                      <input id="modal-first-name" formControlName="first_name" autocomplete="given-name">
                    </div>
                    <div class="form-field">
                      <label for="modal-last-name">Last name</label>
                      <input id="modal-last-name" formControlName="last_name" autocomplete="family-name">
                    </div>
                  </div>
                }

                <div class="form-field">
                  <label for="modal-email">Email address</label>
                  <input id="modal-email" type="email" formControlName="email" autocomplete="email" inputmode="email">
                </div>

                <div class="form-field">
                  <label for="modal-password">Password</label>
                  <div class="password-control">
                    <input id="modal-password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" [autocomplete]="isRegister() ? 'new-password' : 'current-password'">
                    <button type="button" (click)="showPassword.update(v => !v)">{{ showPassword() ? 'Hide' : 'Show' }}</button>
                  </div>
                </div>

                @if (isRegister()) {
                  <div class="password-guidance">
                    <ul aria-label="Password requirements">
                      <li [class.met]="hasLength()">At least 8 characters</li>
                      <li [class.met]="hasLowercase()">One lowercase letter</li>
                      <li [class.met]="hasUppercase()">One uppercase letter</li>
                      <li [class.met]="hasNumber()">One number</li>
                    </ul>
                  </div>

                  <div class="form-field">
                    <label for="modal-confirm-password">Confirm password</label>
                    <div class="password-control">
                      <input id="modal-confirm-password" [type]="showConfirm() ? 'text' : 'password'" formControlName="password_confirm" autocomplete="new-password">
                      <button type="button" (click)="showConfirm.update(v => !v)">{{ showConfirm() ? 'Hide' : 'Show' }}</button>
                    </div>
                  </div>

                  <div class="bot-check-box" [class.verified]="isChallengeSolved()">
                    <span class="bot-check-label">
                      <span class="bot-shield" aria-hidden="true">{{ isChallengeSolved() ? '✓' : '🛡' }}</span>
                      <span>Bot protection: what is <strong>{{ challengeA() }} + {{ challengeB() }}</strong>?</span>
                    </span>
                    <input type="number" formControlName="challenge_answer" class="bot-answer-input" placeholder="?" aria-label="Security sum answer">
                  </div>
                }

                @if (error()) {
                  <p class="form-error" role="alert">{{ error() }}</p>
                }

                <button class="button primary full" type="submit" [disabled]="loading()">
                  {{ loading() ? 'Please wait…' : (isRegister() ? 'Send verification email →' : 'Sign in') }}
                </button>

                <p class="form-switch">
                  {{ isRegister() ? 'Already have an account?' : 'New to the studio?' }}
                  <button class="inline-switch-btn" type="button" (click)="switchMode(isRegister() ? 'login' : 'register')">
                    {{ isRegister() ? 'Sign in' : 'Create account' }}
                  </button>
                </p>
              </form>
            </div>
          }
        </section>
      </div>
    }
  `
})
export class AuthModalComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly commerce = inject(CommerceService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly Boolean = Boolean;
  readonly loading = signal(false);
  readonly resending = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);

  readonly challengeA = signal(4);
  readonly challengeB = signal(3);

  readonly verificationId = signal('');
  readonly pendingEmail = signal('');
  readonly remainingSeconds = signal(600);
  readonly demoEmailUrl = signal('');

  readonly form = this.fb.nonNullable.group({
    first_name: [''],
    last_name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    password_confirm: [''],
    human_check: [false],
    challenge_answer: [''],
    website: ['']
  });

  constructor() {
    effect(() => {
      if (this.auth.authModalOpen()) {
        this.error.set('');
        this.generateChallenge();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.auth.isSignedIn() && this.auth.authModalOpen()) {
        this.verificationId.set('');
        this.auth.closeAuthModal();
        this.commerce.loadCart().subscribe({ error: () => undefined });
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    interval(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.auth.authModalOpen() || !this.verificationId()) return;
      const current = this.remainingSeconds();
      if (current > 0) {
        this.remainingSeconds.set(current - 1);
      }
      if (current % 2 === 0 && current > 0) {
        this.auth.checkVerificationStatus(this.verificationId()).subscribe({
          next: status => {
            if (status.status === 'APPROVED' && status.access) {
              this.verificationId.set('');
              this.auth.acceptTokens(status);
              this.commerce.loadCart().subscribe({ error: () => undefined });
            } else if (status.status === 'EXPIRED') {
              this.remainingSeconds.set(0);
            }
          },
          error: () => undefined
        });
      }
    });
  }

  isRegister(): boolean {
    return this.auth.authModalMode() === 'register';
  }

  switchMode(mode: 'login' | 'register'): void {
    this.auth.authModalMode.set(mode);
    this.verificationId.set('');
    this.error.set('');
    this.generateChallenge();
  }

  onBackdropClick(event: MouseEvent): void {
    if (Date.now() - this.auth.lastOpenedAt < 80) return;
    if (event.target === event.currentTarget) {
      this.auth.closeAuthModal();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.auth.authModalOpen()) {
      this.auth.closeAuthModal();
    }
  }

  submit(): void {
    this.error.set('');
    const raw = this.form.getRawValue();
    if (!raw.email.trim() || !raw.password) {
      this.error.set('Please enter your email and password.');
      return;
    }

    if (this.isRegister()) {
      if (!this.hasLength() || !this.hasLowercase() || !this.hasUppercase() || !this.hasNumber()) {
        this.error.set('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
        return;
      }
      if (raw.password !== raw.password_confirm) {
        this.error.set('Passwords do not match.');
        return;
      }
      const expected = this.challengeA() + this.challengeB();
      if (Number(raw.challenge_answer) !== expected) {
        this.error.set(`Please enter the correct sum (${this.challengeA()} + ${this.challengeB()} = ${expected}).`);
        return;
      }

      this.loading.set(true);
      this.auth.register({
        first_name: raw.first_name.trim(),
        last_name: raw.last_name.trim(),
        email: raw.email.trim().toLowerCase(),
        password: raw.password,
        password_confirm: raw.password_confirm,
        human_verified: true,
        website: raw.website
      }).pipe(finalize(() => this.loading.set(false))).subscribe({
        next: response => {
          if (response.verification_required && response.verification_id) {
            this.verificationId.set(response.verification_id);
            this.pendingEmail.set(response.email || raw.email.trim().toLowerCase());
            this.remainingSeconds.set(response.expires_in_seconds || 600);
            this.demoEmailUrl.set(response.demo_email_url || '');
          } else if (response.access) {
            this.auth.acceptTokens(response);
          }
        },
        error: response => this.error.set(this.readError(response.error))
      });
      return;
    }

    this.loading.set(true);
    this.auth.login(raw.email.trim().toLowerCase(), raw.password).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => {
        this.auth.closeAuthModal();
        this.commerce.loadCart().subscribe({ error: () => undefined });
        const target = this.auth.returnUrl();
        this.auth.returnUrl.set(null);
        if (target) {
          this.router.navigateByUrl(target);
        } else if (this.auth.isDesigner()) {
          this.router.navigateByUrl('/studio');
        }
      },
      error: response => this.error.set(this.readError(response.error))
    });
  }

  openDemoEmail(): void {
    const url = this.demoEmailUrl();
    if (!url) return;
    const width = 520;
    const height = 640;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    window.open(url, 'verify_email_popup', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  }

  resendEmail(): void {
    if (!this.pendingEmail()) return;
    this.resending.set(true);
    this.auth.resendVerification(this.pendingEmail()).pipe(finalize(() => this.resending.set(false))).subscribe({
      next: response => {
        if (response.verification_id) {
          this.verificationId.set(response.verification_id);
          this.remainingSeconds.set(response.expires_in_seconds || 600);
          this.demoEmailUrl.set(response.demo_email_url || '');
        }
      },
      error: () => this.error.set('Could not resend verification link.')
    });
  }

  resetVerification(): void {
    this.verificationId.set('');
    this.demoEmailUrl.set('');
  }

  formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  hasLength(): boolean { return this.form.controls.password.value.length >= 8; }
  hasLowercase(): boolean { return /[a-z]/.test(this.form.controls.password.value); }
  hasUppercase(): boolean { return /[A-Z]/.test(this.form.controls.password.value); }
  hasNumber(): boolean { return /\d/.test(this.form.controls.password.value); }
  isChallengeSolved(): boolean {
    const val = String(this.form.controls.challenge_answer.value ?? '').trim();
    return val !== '' && Number(val) === this.challengeA() + this.challengeB();
  }

  private generateChallenge(): void {
    this.challengeA.set(Math.floor(Math.random() * 6) + 2);
    this.challengeB.set(Math.floor(Math.random() * 5) + 1);
    this.form.patchValue({ human_check: false, challenge_answer: '' });
  }

  private readError(body: unknown): string {
    if (!body || typeof body !== 'object') return 'Invalid credentials or request failed. Please try again.';
    const first = Object.values(body as Record<string, unknown>)[0];
    return Array.isArray(first) ? String(first[0]) : String(first);
  }
}

