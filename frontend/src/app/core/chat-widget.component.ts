import { DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, interval } from 'rxjs';
import { AuthService } from './auth.service';
import { CustomRequest, CustomWorkService, MessageAttachment, PortalMessage } from './custom-work.service';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
  template: `
    @if (!hideWidget()) {
      @if (service.popupOpen()) {
        <aside class="chat-popup" role="dialog" aria-label="Custom work conversation">
          <header class="chat-popup-header">
            <div class="chat-popup-title">
              @if (auth.isSignedIn() && activeRequest() && !showNewRequest() && !showThreadList()) {
                <button class="chat-header-back" type="button" (click)="showThreadList.set(true)" title="All conversations">
                  ← <span>{{ requests().length }}</span>
                </button>
                <div>
                  <span class="chat-popup-eyebrow">{{ activeRequest()!.status_display }}</span>
                  <h2>{{ activeRequest()!.title }}</h2>
                </div>
              } @else {
                <div>
                  <span class="chat-popup-eyebrow">Direct designer chat</span>
                  <h2>{{ showNewRequest() ? 'Start a project' : 'Custom work' }}</h2>
                </div>
              }
            </div>

            <div class="chat-popup-actions">
              @if (auth.isSignedIn()) {
                @if (activeRequest() && !showNewRequest() && !showThreadList()) {
                  <button class="chat-icon-btn danger" type="button" (click)="deleteConversation(activeRequest()!)" title="Delete conversation" aria-label="Delete conversation">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                }
                @if (!showNewRequest()) {
                  <button class="chat-new-btn" type="button" (click)="openNewForm()">+ New</button>
                } @else if (requests().length) {
                  <button class="chat-new-btn" type="button" (click)="showNewRequest.set(false)">Back</button>
                }
              }
              <a class="chat-icon-btn" routerLink="/custom-work" (click)="service.closeChat()" title="Open full page" aria-label="Open full custom work page">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
              </a>
              <button class="chat-icon-btn" type="button" (click)="service.closeChat()" aria-label="Close chat">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>
          </header>

          @if (!auth.isSignedIn()) {
            <div class="chat-popup-guest">
              <span class="chat-guest-mark">✦</span>
              <h3>Let’s discuss your idea.</h3>
              <p>Sign in to send a message, share reference files, and receive a custom quote directly here.</p>
              <div class="chat-guest-actions">
                <button class="button primary full" type="button" (click)="openSignIn('login')">Sign in to chat</button>
                <button class="button secondary full" type="button" (click)="openSignIn('register')">Create account</button>
              </div>
            </div>
          } @else if (showNewRequest() || !requests().length) {
            <form class="chat-popup-form" [formGroup]="requestForm" (ngSubmit)="createRequest()">
              <label>
                Service
                <select formControlName="request_type">
                  <option value="NEW_DESIGN">New custom design</option>
                  <option value="CUSTOM_SIZE">Custom size/version</option>
                  <option value="MODIFICATION">Existing design modification</option>
                  <option value="OTHER">Other design service</option>
                </select>
              </label>
              <label>
                Project title
                <input formControlName="title" maxlength="180" placeholder="e.g. Eid campaign poster">
              </label>
              <label>
                Message
                <textarea formControlName="initial_message" rows="4" maxlength="4000" placeholder="Share your brief, size, timeline, or questions…"></textarea>
              </label>
              <button class="button primary full" type="submit" [disabled]="requestForm.invalid || creating()">
                {{ creating() ? 'Starting…' : 'Send message →' }}
              </button>
            </form>
          } @else if (showThreadList()) {
            <div class="chat-popup-threads">
              @for (request of requests(); track request.id) {
                <div class="thread-item-row" [class.active]="activeRequest()?.id === request.id">
                  <button type="button" class="thread-item" (click)="selectRequest(request)">
                    <span class="thread-status">{{ request.status_display }}</span>
                    <strong>{{ request.title }}</strong>
                    <p>{{ request.last_message || 'Conversation started' }}</p>
                    <time>{{ request.updated_at | date:'MMM d, h:mm a' }}</time>
                  </button>
                  <button type="button" class="thread-delete-btn" (click)="deleteConversation(request, $event)" title="Delete conversation" aria-label="Delete conversation">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
              }
            </div>
          } @else if (activeRequest(); as request) {
            <div class="chat-popup-messages" id="popup-message-stream">
              @for (message of messages(); track message.id) {
                <article class="message-bubble" [class.mine]="message.is_mine" [class.designer]="message.sender_role === 'DESIGNER'">
                  @if (message.body) { <p>{{ message.body }}</p> }
                  @if (message.attachments.length) {
                    <div class="message-attachments">
                      @for (file of message.attachments; track file.id) {
                        @if (file.mime_type.startsWith('image/') && previewUrls()[file.id]; as previewUrl) {
                          <button class="image-attachment" type="button" (click)="openImage(file)" aria-label="Open image">
                            <img [src]="previewUrl" alt="Attached image">
                          </button>
                        } @else {
                          <button class="attachment-card" type="button" (click)="service.downloadAttachment(file)">
                            <span>↧</span>
                            <span>
                              <strong>Attached file</strong>
                              <small>{{ formatSize(file.file_size) }}</small>
                            </span>
                            <b>Download</b>
                          </button>
                        }
                      }
                    </div>
                  }
                  <div class="message-footer">
                    <time>{{ message.created_at | date:'MMM d, h:mm a' }}</time>
                    <button type="button" class="message-delete-btn" (click)="deleteMessage(message, $event)" title="Delete message" aria-label="Delete message">×</button>
                  </div>
                </article>
              }
            </div>

            <form class="chat-popup-composer" [formGroup]="messageForm" (ngSubmit)="sendMessage()">
              @if (selectedFiles().length) {
                <div class="selected-files">
                  @for (file of selectedFiles(); track file.name + file.size; let index = $index) {
                    <span>
                      {{ file.type.startsWith('image/') ? 'Image' : 'File' }} · <small>{{ formatSize(file.size) }}</small>
                      <button type="button" (click)="removeFile(index)" aria-label="Remove attachment">×</button>
                    </span>
                  }
                </div>
              }
              @if (fileError()) { <p class="attachment-error" role="alert">{{ fileError() }}</p> }
              <div class="chat-popup-composer-bar">
                <label class="chat-attach-icon" for="popup-message-files" title="Attach files" aria-label="Attach files">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <input id="popup-message-files" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.zip,.docx,.pptx,.ai,.psd" (change)="chooseFiles($event)">
                </label>
                <textarea
                  formControlName="body"
                  rows="1"
                  maxlength="4000"
                  placeholder="Write a message…"
                  (keydown.enter)="handleEnter($event)">
                </textarea>
                <button class="chat-send-btn" type="submit" [disabled]="!canSend() || sending()" aria-label="Send message">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
              </div>
            </form>
          }
        </aside>
      }

      <button
        class="chat-fab"
        type="button"
        [class.active]="service.popupOpen()"
        (click)="service.toggleChat()"
        [attr.aria-expanded]="service.popupOpen()"
        aria-label="Open custom work chat">
        @if (service.popupOpen()) {
          <span class="chat-fab-close" aria-hidden="true">×</span>
        } @else {
          <span class="chat-fab-badge" aria-hidden="true">
            <svg class="chat-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <i class="chat-fab-dot"></i>
          </span>
          <span class="chat-fab-copy">
            <small>Custom work</small>
            <strong>Let’s chat</strong>
          </span>
        }
      </button>
    }
  `
})
export class ChatWidgetComponent implements OnInit {
  readonly service = inject(CustomWorkService);
  readonly auth = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.service.popupOpen()) return;
    if (Date.now() - this.service.lastOpenedAt < 80) return;
    const path = event.composedPath();
    if (!path.includes(this.elementRef.nativeElement)) {
      this.service.closeChat();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.service.popupOpen()) {
      this.service.closeChat();
    }
  }

  readonly currentUrl = signal('/');
  readonly hideWidget = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/custom-work') || url.startsWith('/studio');
  });

  readonly requests = signal<CustomRequest[]>([]);
  readonly activeRequest = signal<CustomRequest | null>(null);
  readonly messages = signal<PortalMessage[]>([]);
  readonly showNewRequest = signal(false);
  readonly showThreadList = signal(false);
  readonly creating = signal(false);
  readonly sending = signal(false);
  readonly selectedFiles = signal<File[]>([]);
  readonly fileError = signal('');
  readonly previewUrls = signal<Record<number, string>>({});

  private readonly previewObjects = new Map<number, string>();
  private readonly loadingPreviews = new Set<number>();

  readonly requestForm = this.fb.nonNullable.group({
    request_type: ['NEW_DESIGN', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    initial_message: ['', [Validators.required, Validators.maxLength(4000)]]
  });

  readonly messageForm = this.fb.nonNullable.group({
    body: ['', [Validators.maxLength(4000)]]
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.previewObjects.forEach(url => URL.revokeObjectURL(url)));

    effect(() => {
      const isOpen = this.service.popupOpen();
      const draft = this.service.draftOptions();
      if (isOpen && this.auth.isSignedIn()) {
        this.refreshRequests();
        if (draft?.startNew) {
          this.requestForm.patchValue({
            request_type: draft.request_type || 'NEW_DESIGN',
            title: draft.title || ''
          });
          this.showNewRequest.set(true);
          this.showThreadList.set(false);
          this.service.draftOptions.set(null);
        }
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(event => {
      this.currentUrl.set(event.urlAfterRedirects);
    });

    interval(8000).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (!this.service.popupOpen() || !this.auth.isSignedIn()) return;
      this.service.requests().subscribe(requests => {
        this.requests.set(requests);
        const active = this.activeRequest();
        if (active) {
          const updated = requests.find(item => item.id === active.id);
          if (updated) this.activeRequest.set(updated);
          this.loadMessages(active.id, false);
        }
      });
    });
  }

  openNewForm(): void {
    this.showThreadList.set(false);
    this.showNewRequest.set(true);
  }

  openSignIn(mode: 'login' | 'register'): void {
    this.service.closeChat();
    this.auth.openAuthModal(mode);
  }

  selectRequest(request: CustomRequest): void {
    this.activeRequest.set(request);
    this.showThreadList.set(false);
    this.showNewRequest.set(false);
    this.loadMessages(request.id, true);
  }

  deleteConversation(request: CustomRequest, event?: Event): void {
    event?.stopPropagation();
    this.service.deleteRequest(request.id).subscribe(() => {
      const remaining = this.requests().filter(item => item.id !== request.id);
      this.requests.set(remaining);
      if (this.activeRequest()?.id === request.id) {
        this.messages.set([]);
        if (remaining[0]) {
          this.selectRequest(remaining[0]);
        } else {
          this.activeRequest.set(null);
          this.showThreadList.set(false);
        }
      }
    });
  }

  deleteMessage(message: PortalMessage, event?: Event): void {
    event?.stopPropagation();
    const request = this.activeRequest();
    if (!request) return;
    const previous = this.messages();
    this.messages.update(items => items.filter(item => item.id !== message.id));
    this.service.deleteMessage(request.id, message.id).subscribe({
      error: () => this.messages.set(previous)
    });
  }

  createRequest(): void {
    if (this.requestForm.invalid) return;
    this.creating.set(true);
    this.service.createRequest(this.requestForm.getRawValue()).subscribe({
      next: request => {
        this.creating.set(false);
        this.showNewRequest.set(false);
        this.showThreadList.set(false);
        this.requestForm.reset({ request_type: 'NEW_DESIGN', title: '', initial_message: '' });
        this.refreshRequests(request.id);
      },
      error: () => this.creating.set(false)
    });
  }

  sendMessage(): void {
    const request = this.activeRequest();
    const body = this.messageForm.controls.body.value.trim();
    const files = this.selectedFiles();
    if (!request || (!body && !files.length)) return;
    this.sending.set(true);
    this.service.sendMessage(request.id, body, files).subscribe({
      next: message => {
        this.messages.update(items => [...items, message]);
        this.loadImagePreviews([message]);
        this.messageForm.reset();
        this.selectedFiles.set([]);
        this.fileError.set('');
        this.sending.set(false);
        this.scrollMessages();
      },
      error: response => {
        this.fileError.set(
          response.error?.uploaded_files?.[0] ||
          response.error?.non_field_errors?.[0] ||
          'Message or attachment could not be sent.'
        );
        this.sending.set(false);
      }
    });
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey || keyboardEvent.isComposing) return;
    keyboardEvent.preventDefault();
    if (!this.sending()) this.sendMessage();
  }

  chooseFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const incoming = Array.from(input.files || []);
    input.value = '';
    this.fileError.set('');
    const combined = [...this.selectedFiles(), ...incoming];
    if (combined.length > 5) {
      this.fileError.set('You can attach up to 5 files per message.');
      return;
    }
    if (combined.some(file => file.size > 10 * 1024 * 1024)) {
      this.fileError.set('Each attachment must be 10 MB or smaller.');
      return;
    }
    this.selectedFiles.set(combined);
  }

  removeFile(index: number): void {
    this.selectedFiles.update(files => files.filter((_, current) => current !== index));
  }

  canSend(): boolean {
    return this.messageForm.valid && Boolean(this.messageForm.controls.body.value.trim() || this.selectedFiles().length);
  }

  formatSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  openImage(file: MessageAttachment): void {
    const url = this.previewObjects.get(file.id);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  private refreshRequests(selectId?: string): void {
    this.service.requests().subscribe(requests => {
      this.requests.set(requests);
      const target = requests.find(item => item.id === selectId) || this.activeRequest() || requests[0];
      if (target && !this.showNewRequest()) {
        this.selectRequest(target);
      }
    });
  }

  private loadMessages(requestId: string, scroll: boolean): void {
    this.service.messages(requestId).subscribe(messages => {
      this.messages.set(messages);
      this.loadImagePreviews(messages);
      if (scroll) this.scrollMessages();
    });
  }

  private loadImagePreviews(messages: PortalMessage[]): void {
    for (const message of messages) {
      for (const file of message.attachments) {
        if (!file.mime_type.startsWith('image/') || this.previewObjects.has(file.id) || this.loadingPreviews.has(file.id)) continue;
        this.loadingPreviews.add(file.id);
        this.service.attachmentBlob(file).subscribe({
          next: blob => {
            const url = URL.createObjectURL(blob);
            this.previewObjects.set(file.id, url);
            this.previewUrls.update(current => ({ ...current, [file.id]: url }));
            this.loadingPreviews.delete(file.id);
          },
          error: () => this.loadingPreviews.delete(file.id)
        });
      }
    }
  }

  private scrollMessages(): void {
    setTimeout(() => {
      const element = document.getElementById('popup-message-stream');
      if (element) element.scrollTop = element.scrollHeight;
    });
  }
}

