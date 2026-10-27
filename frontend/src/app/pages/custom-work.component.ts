import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval, switchMap } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { CustomRequest, CustomWorkService, MessageAttachment, PortalMessage } from '../core/custom-work.service';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <section class="work-page">
      <header class="work-heading"><div><span class="eyebrow">Private project conversations</span><h1>Custom work,<br><em>clearly discussed.</em></h1></div><p>Start with your brief. Every message stays attached to the project, giving both you and the designer a clear record of decisions.</p></header>

      <div class="work-shell">
        <aside class="thread-sidebar">
          <div class="thread-sidebar-head"><h2>Conversations</h2><button type="button" (click)="showNewRequest.update(value => !value)">+ New project</button></div>
          @if (showNewRequest()) {
            <form class="new-request-form" [formGroup]="requestForm" (ngSubmit)="createRequest()">
              <label>Service<select formControlName="request_type"><option value="NEW_DESIGN">New custom design</option><option value="CUSTOM_SIZE">Custom size/version</option><option value="MODIFICATION">Existing design modification</option><option value="OTHER">Other design service</option></select></label>
              <label>Project title<input formControlName="title" maxlength="180" placeholder="e.g. Eid campaign poster"></label>
              <label>First message<textarea formControlName="initial_message" rows="4" maxlength="4000" placeholder="Tell the designer what you need…"></textarea></label>
              <button class="button primary full" type="submit" [disabled]="requestForm.invalid || creating()">{{ creating() ? 'Starting…' : 'Start conversation' }}</button>
            </form>
          }
          <div class="thread-list">
            @for (request of requests(); track request.id) {
              <div class="thread-item-row" [class.active]="activeRequest()?.id === request.id">
                <button type="button" class="thread-item" (click)="selectRequest(request)">
                  <span class="thread-status">{{ request.status_display }}</span><strong>{{ request.title }}</strong>
                  @if (request.customer_email) { <small>{{ request.customer_email }}</small> }
                  <p>{{ request.last_message || 'Conversation started' }}</p><time>{{ request.updated_at | date:'MMM d, h:mm a' }}</time>
                </button>
                <button type="button" class="thread-delete-btn" (click)="deleteConversation(request, $event)" title="Delete conversation" aria-label="Delete conversation">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            } @empty { <p class="no-threads">No conversations yet. Start your first custom project.</p> }
          </div>
        </aside>

        <section class="conversation-panel" aria-live="polite">
          @if (activeRequest(); as request) {
            <header>
              <div><span>{{ request.request_type_display }}</span><h2>{{ request.title }}</h2></div>
              <div class="conversation-header-actions">
                <b>{{ request.status_display }}</b>
                <button type="button" class="chat-icon-btn danger" (click)="deleteConversation(request)" title="Delete conversation" aria-label="Delete conversation">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </header>
            <div class="message-stream" id="message-stream">
              @for (message of messages(); track message.id) {
                <article class="message-bubble" [class.mine]="message.is_mine" [class.designer]="message.sender_role === 'DESIGNER'">
                  @if (message.body) { <p>{{ message.body }}</p> }
                  @if (message.attachments.length) {
                    <div class="message-attachments">
                      @for (file of message.attachments; track file.id) {
                        @if (file.mime_type.startsWith('image/') && previewUrls()[file.id]; as previewUrl) {
                          <button class="image-attachment" type="button" (click)="openImage(file)" aria-label="Open image"><img [src]="previewUrl" alt="Attached image"></button>
                        } @else {
                          <button class="attachment-card" type="button" (click)="service.downloadAttachment(file)"><span>↧</span><span><strong>Attached file</strong><small>{{ formatSize(file.file_size) }}</small></span><b>Download</b></button>
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
            <form class="message-composer" [formGroup]="messageForm" (ngSubmit)="sendMessage()">
              <label for="message-body">Write a message</label><textarea id="message-body" formControlName="body" rows="3" maxlength="4000" placeholder="Type your message…" (keydown.enter)="handleEnter($event)"></textarea>
              @if (selectedFiles().length) {
                <div class="selected-files">
                  @for (file of selectedFiles(); track file.name + file.size; let index = $index) { <span>{{ file.type.startsWith('image/') ? 'Image' : 'File' }} · <small>{{ formatSize(file.size) }}</small><button type="button" (click)="removeFile(index)" aria-label="Remove attachment">×</button></span> }
                </div>
              }
              @if (fileError()) { <p class="attachment-error" role="alert">{{ fileError() }}</p> }
              <div><small>Enter to send · Shift+Enter for a new line · {{ messageForm.controls.body.value.length }}/4000</small><div class="composer-actions"><label class="attach-button" for="message-files" aria-label="Attach files">＋ Attach<input id="message-files" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.zip,.docx,.pptx,.ai,.psd" (change)="chooseFiles($event)"></label><button class="button primary" type="submit" [disabled]="!canSend() || sending()">{{ sending() ? 'Sending…' : 'Send message' }} <span>↑</span></button></div></div>
            </form>
          } @else {
            <div class="conversation-empty"><span>✦</span><h2>Select a conversation</h2><p>Choose an existing project or start a new one to message the designer.</p></div>
          }
        </section>
      </div>
    </section>
  `
})
export class CustomWorkComponent implements OnInit {
  readonly service = inject(CustomWorkService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly requests = signal<CustomRequest[]>([]);
  readonly activeRequest = signal<CustomRequest | null>(null);
  readonly messages = signal<PortalMessage[]>([]);
  readonly showNewRequest = signal(false);
  readonly creating = signal(false);
  readonly sending = signal(false);
  readonly selectedFiles = signal<File[]>([]);
  readonly fileError = signal('');
  readonly previewUrls = signal<Record<number, string>>({});
  private readonly previewObjects = new Map<number, string>();
  private readonly loadingPreviews = new Set<number>();
  readonly requestForm = this.fb.nonNullable.group({ request_type: ['NEW_DESIGN', Validators.required], title: ['', [Validators.required, Validators.maxLength(180)]], initial_message: ['', [Validators.required, Validators.maxLength(4000)]] });
  readonly messageForm = this.fb.nonNullable.group({ body: ['', [Validators.maxLength(4000)]] });

  constructor() {
    this.destroyRef.onDestroy(() => this.previewObjects.forEach(url => URL.revokeObjectURL(url)));
  }

  ngOnInit(): void {
    if (!this.auth.isSignedIn()) { this.router.navigateByUrl('/'); this.auth.openAuthModal('login', '/custom-work'); return; }
    const draft = this.service.draftOptions();
    if (draft?.startNew) {
      this.requestForm.patchValue({
        request_type: draft.request_type || 'NEW_DESIGN',
        title: draft.title || ''
      });
      this.showNewRequest.set(true);
      this.service.draftOptions.set(null);
    }
    this.refreshRequests();
    interval(8000).pipe(takeUntilDestroyed(this.destroyRef), switchMap(() => this.service.requests())).subscribe(requests => {
      this.requests.set(requests);
      const active = this.activeRequest();
      if (active) {
        const updated = requests.find(item => item.id === active.id);
        if (updated) this.activeRequest.set(updated);
        this.loadMessages(active.id, false);
      }
    });
  }

  selectRequest(request: CustomRequest): void { this.activeRequest.set(request); this.loadMessages(request.id, true); }
  deleteConversation(request: CustomRequest, event?: Event): void {
    event?.stopPropagation();
    this.service.deleteRequest(request.id).subscribe(() => {
      const remaining = this.requests().filter(item => item.id !== request.id);
      this.requests.set(remaining);
      if (this.activeRequest()?.id === request.id) {
        this.messages.set([]);
        if (remaining[0]) this.selectRequest(remaining[0]);
        else this.activeRequest.set(null);
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
      next: request => { this.creating.set(false); this.showNewRequest.set(false); this.requestForm.reset({ request_type: 'NEW_DESIGN', title: '', initial_message: '' }); this.refreshRequests(request.id); },
      error: () => this.creating.set(false)
    });
  }
  sendMessage(): void {
    const request = this.activeRequest();
    const body = this.messageForm.controls.body.value.trim();
    const files = this.selectedFiles();
    if (!request || (!body && !files.length)) return;
    this.sending.set(true);
    this.service.sendMessage(request.id, body, files).subscribe({ next: message => { this.messages.update(items => [...items, message]); this.loadImagePreviews([message]); this.messageForm.reset(); this.selectedFiles.set([]); this.fileError.set(''); this.sending.set(false); this.scrollMessages(); }, error: response => { this.fileError.set(response.error?.uploaded_files?.[0] || response.error?.non_field_errors?.[0] || 'Message or attachment could not be sent.'); this.sending.set(false); } });
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
    if (combined.length > 5) { this.fileError.set('You can attach up to 5 files per message.'); return; }
    if (combined.some(file => file.size > 10 * 1024 * 1024)) { this.fileError.set('Each attachment must be 10 MB or smaller.'); return; }
    this.selectedFiles.set(combined);
  }
  removeFile(index: number): void { this.selectedFiles.update(files => files.filter((_, current) => current !== index)); }
  canSend(): boolean { return this.messageForm.valid && Boolean(this.messageForm.controls.body.value.trim() || this.selectedFiles().length); }
  formatSize(bytes: number): string { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
  openImage(file: MessageAttachment): void {
    const url = this.previewObjects.get(file.id);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }
  private refreshRequests(selectId?: string): void {
    this.service.requests().subscribe(requests => { this.requests.set(requests); const target = requests.find(item => item.id === selectId) || this.activeRequest() || requests[0]; if (target) this.selectRequest(target); });
  }
  private loadMessages(requestId: string, scroll: boolean): void { this.service.messages(requestId).subscribe(messages => { this.messages.set(messages); this.loadImagePreviews(messages); if (scroll) this.scrollMessages(); }); }
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
  private scrollMessages(): void { setTimeout(() => { const element = document.getElementById('message-stream'); if (element) element.scrollTop = element.scrollHeight; }); }
}

