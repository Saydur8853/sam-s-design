import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, User } from '../core/auth.service';

type ProfileTab = 'profile' | 'password';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="profile-page">
      <header class="profile-heading">
        <div>
          <span class="eyebrow">Account settings</span>
          <h1>Your profile<br><em>& preferences.</em></h1>
        </div>
        <p>Manage your personal details, profile photo, security credentials, and account status.</p>
      </header>

      <div class="profile-shell">
        <aside class="profile-sidebar">
          <div class="profile-card-summary">
            <div class="profile-avatar-stage">
              @if (avatarPreview() || auth.currentUser()?.avatar_url; as photo) {
                <img class="profile-avatar-img" [src]="photo" alt="Profile photo">
              } @else {
                <span class="profile-avatar-fallback">{{ initials() }}</span>
              }
            </div>
            <span class="user-role-badge">{{ auth.isDesigner() ? 'Designer' : 'Customer' }}</span>
            <h2>{{ displayName() }}</h2>
            <p>{{ auth.currentUser()?.email }}</p>
          </div>

          <nav class="profile-tabs" aria-label="Account sections">
            <button type="button" [class.active]="tab() === 'profile'" (click)="setTab('profile')">
              <span>01</span> Profile & Photo
            </button>
            <button type="button" [class.active]="tab() === 'password'" (click)="setTab('password')">
              <span>02</span> Change Password
            </button>
          </nav>
        </aside>

        <div class="profile-content">
          @if (notice()) {
            <p class="profile-notice" role="status">{{ notice() }}</p>
          }
          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }

          @if (tab() === 'profile') {
            <form class="profile-panel" [formGroup]="profileForm" (ngSubmit)="saveProfile()" novalidate>
              <div class="panel-title">
                <div>
                  <span>Personal information</span>
                  <h3>Profile details & photo</h3>
                </div>
              </div>

              <div class="photo-upload-row">
                <div class="photo-preview-box">
                  @if (avatarPreview() || auth.currentUser()?.avatar_url; as photo) {
                    <img [src]="photo" alt="Current profile photo">
                  } @else {
                    <span>{{ initials() }}</span>
                  }
                </div>
                <div class="photo-upload-controls">
                  <strong>Profile photo</strong>
                  <p>Upload a square JPG, PNG, or WebP image (up to 5 MB).</p>
                  <div class="photo-upload-buttons">
                    <label class="button secondary compact-btn" for="avatar-input">
                      Choose photo
                      <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" (change)="chooseAvatar($event)">
                    </label>
                    @if (avatarPreview() || auth.currentUser()?.avatar_url) {
                      <button class="button secondary compact-btn danger-outline" type="button" (click)="clearAvatar()">
                        Remove photo
                      </button>
                    }
                  </div>
                </div>
              </div>

              <div class="studio-form-grid">
                <label>
                  First name
                  <input formControlName="first_name" autocomplete="given-name" placeholder="First name">
                </label>
                <label>
                  Last name
                  <input formControlName="last_name" autocomplete="family-name" placeholder="Last name">
                </label>
                <label>
                  Display name
                  <input formControlName="display_name" maxlength="120" placeholder="How your name appears">
                </label>
                <label>
                  Email address
                  <input type="email" formControlName="email" autocomplete="email" placeholder="you@example.com">
                </label>
                <label>
                  Phone number
                  <input type="tel" formControlName="phone" maxlength="30" autocomplete="tel" placeholder="+880 1XXX-XXXXXX">
                </label>
                <label>
                  Country code (ISO 2-letter)
                  <input formControlName="country" maxlength="2" placeholder="BD">
                </label>
              </div>

              <div class="profile-form-actions">
                <button class="button primary" type="submit" [disabled]="profileForm.invalid || saving()">
                  {{ saving() ? 'Saving changes…' : 'Save changes' }}
                </button>
              </div>
            </form>
          }

          @if (tab() === 'password') {
            <form class="profile-panel" [formGroup]="passwordForm" (ngSubmit)="savePassword()" novalidate>
              <div class="panel-title">
                <div>
                  <span>Security</span>
                  <h3>Change password</h3>
                </div>
              </div>

              <div class="password-form-stack">
                <label>
                  Current password
                  <div class="password-control">
                    <input [type]="showCurrent() ? 'text' : 'password'" formControlName="current_password" autocomplete="current-password">
                    <button type="button" (click)="showCurrent.update(v => !v)">{{ showCurrent() ? 'Hide' : 'Show' }}</button>
                  </div>
                </label>

                <label>
                  New password
                  <div class="password-control">
                    <input [type]="showNew() ? 'text' : 'password'" formControlName="new_password" autocomplete="new-password">
                    <button type="button" (click)="showNew.update(v => !v)">{{ showNew() ? 'Hide' : 'Show' }}</button>
                  </div>
                </label>

                <div class="password-guidance">
                  <ul aria-label="Password requirements">
                    <li [class.met]="hasLength()">At least 8 characters</li>
                    <li [class.met]="hasLowercase()">One lowercase letter</li>
                    <li [class.met]="hasUppercase()">One uppercase letter</li>
                    <li [class.met]="hasNumber()">One number</li>
                  </ul>
                </div>

                <label>
                  Confirm new password
                  <div class="password-control">
                    <input [type]="showConfirm() ? 'text' : 'password'" formControlName="new_password_confirm" autocomplete="new-password">
                    <button type="button" (click)="showConfirm.update(v => !v)">{{ showConfirm() ? 'Hide' : 'Show' }}</button>
                  </div>
                </label>
              </div>

              <div class="profile-form-actions">
                <button class="button primary" type="submit" [disabled]="passwordForm.invalid || saving()">
                  {{ saving() ? 'Updating password…' : 'Update password' }}
                </button>
              </div>
            </form>
          }
        </div>
      </div>
    </section>
  `
})
export class ProfileComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly tab = signal<ProfileTab>('profile');
  readonly saving = signal(false);
  readonly notice = signal('');
  readonly error = signal('');

  readonly showCurrent = signal(false);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);

  readonly avatarPreview = signal<string | null>(null);
  private selectedAvatarFile: File | null = null;
  private removeAvatarFlag = false;

  readonly displayName = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 'Account';
    if (user.profile?.display_name?.trim()) return user.profile.display_name.trim();
    const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    if (full) return full;
    return user.email.split('@')[0] || 'Account';
  });

  readonly initials = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return 'U';
    const first = user.first_name?.trim()?.[0] || '';
    const last = user.last_name?.trim()?.[0] || '';
    if (first || last) return (first + last).toUpperCase();
    return (user.email?.[0] || 'U').toUpperCase();
  });

  readonly profileForm = this.fb.nonNullable.group({
    first_name: [''],
    last_name: [''],
    display_name: [''],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    country: ['']
  });

  readonly passwordForm = this.fb.nonNullable.group({
    current_password: ['', Validators.required],
    new_password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/[a-z]/), Validators.pattern(/[A-Z]/), Validators.pattern(/\d/)]],
    new_password_confirm: ['', Validators.required]
  });

  ngOnInit(): void {
    if (!this.auth.isSignedIn()) {
      this.router.navigateByUrl('/');
      this.auth.openAuthModal('login', '/profile');
      return;
    }
    this.route.queryParamMap.subscribe(params => {
      const requested = params.get('tab');
      if (requested === 'password' || requested === 'profile') {
        this.tab.set(requested);
      }
    });
    this.auth.me().subscribe({
      next: user => this.patchUser(user),
      error: () => undefined
    });
  }

  setTab(next: ProfileTab): void {
    this.tab.set(next);
    this.notice.set('');
    this.error.set('');
  }

  chooseAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.error.set('Profile photo must be 5 MB or smaller.');
      return;
    }
    this.error.set('');
    this.selectedAvatarFile = file;
    this.removeAvatarFlag = false;
    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(String(reader.result));
    reader.readAsDataURL(file);
  }

  clearAvatar(): void {
    this.selectedAvatarFile = null;
    this.avatarPreview.set(null);
    this.removeAvatarFlag = true;
  }

  saveProfile(): void {
    if (this.profileForm.invalid) return;
    this.saving.set(true);
    this.notice.set('');
    this.error.set('');

    const raw = this.profileForm.getRawValue();
    const payload = new FormData();
    payload.append('first_name', raw.first_name.trim());
    payload.append('last_name', raw.last_name.trim());
    payload.append('display_name', raw.display_name.trim());
    payload.append('email', raw.email.trim().toLowerCase());
    payload.append('phone', raw.phone.trim());
    payload.append('country', raw.country.trim().toUpperCase());

    if (this.selectedAvatarFile) {
      payload.append('avatar', this.selectedAvatarFile);
    } else if (this.removeAvatarFlag) {
      payload.append('remove_avatar', 'true');
    }

    this.auth.updateProfile(payload).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: updated => {
        this.selectedAvatarFile = null;
        this.removeAvatarFlag = false;
        this.avatarPreview.set(null);
        this.patchUser(updated);
        this.notice.set('Profile updated successfully.');
      },
      error: response => this.error.set(this.readError(response.error))
    });
  }

  savePassword(): void {
    if (this.passwordForm.invalid) return;
    const raw = this.passwordForm.getRawValue();
    if (raw.new_password !== raw.new_password_confirm) {
      this.error.set('New passwords do not match.');
      return;
    }
    this.saving.set(true);
    this.notice.set('');
    this.error.set('');

    this.auth.changePassword(raw).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.notice.set('Password changed successfully.');
      },
      error: response => this.error.set(this.readError(response.error))
    });
  }

  hasLength(): boolean { return this.passwordForm.controls.new_password.value.length >= 8; }
  hasLowercase(): boolean { return /[a-z]/.test(this.passwordForm.controls.new_password.value); }
  hasUppercase(): boolean { return /[A-Z]/.test(this.passwordForm.controls.new_password.value); }
  hasNumber(): boolean { return /\d/.test(this.passwordForm.controls.new_password.value); }

  private patchUser(user: User): void {
    this.profileForm.patchValue({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      display_name: user.profile?.display_name || '',
      email: user.email || '',
      phone: user.profile?.phone || '',
      country: user.profile?.country || ''
    });
  }

  private readError(body: unknown): string {
    if (!body || typeof body !== 'object') return 'Could not save changes. Please try again.';
    const first = Object.values(body as Record<string, unknown>)[0];
    return Array.isArray(first) ? String(first[0]) : String(first);
  }
}

