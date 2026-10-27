import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

export interface CustomRequest {
  id: string;
  title: string;
  request_type: string;
  request_type_display: string;
  status: string;
  status_display: string;
  customer_email: string;
  created_at: string;
  updated_at: string;
  last_message: string;
  unread_count: number;
}

export interface PortalMessage {
  id: number;
  body: string;
  sender_name: string;
  sender_role: 'CUSTOMER' | 'DESIGNER';
  is_mine: boolean;
  created_at: string;
  attachments: MessageAttachment[];
}

export interface MessageAttachment { id: number; original_name: string; mime_type: string; file_size: number; download_url: string; }

export interface ChatDraftOptions {
  startNew?: boolean;
  title?: string;
  request_type?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomWorkService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly popupOpen = signal(false);
  readonly draftOptions = signal<ChatDraftOptions | null>(null);
  lastOpenedAt = 0;

  isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;
  }

  openChat(options?: ChatDraftOptions): void {
    if (options) {
      this.draftOptions.set(options);
    }
    if (this.isMobileViewport()) {
      this.popupOpen.set(false);
      this.router.navigate(['/custom-work']);
      return;
    }
    this.lastOpenedAt = Date.now();
    this.popupOpen.set(true);
  }

  toggleChat(): void {
    if (this.isMobileViewport()) {
      this.popupOpen.set(false);
      this.router.navigate(['/custom-work']);
      return;
    }
    const next = !this.popupOpen();
    if (next) this.lastOpenedAt = Date.now();
    this.popupOpen.set(next);
  }

  closeChat(): void {
    this.popupOpen.set(false);
  }

  requests(): Observable<CustomRequest[]> { return this.http.get<CustomRequest[]>('/api/v1/custom-requests/'); }
  createRequest(payload: { title: string; request_type: string; initial_message: string }): Observable<CustomRequest> { return this.http.post<CustomRequest>('/api/v1/custom-requests/', payload); }
  deleteRequest(requestId: string): Observable<void> { return this.http.delete<void>(`/api/v1/custom-requests/${requestId}/`); }
  messages(requestId: string): Observable<PortalMessage[]> { return this.http.get<PortalMessage[]>(`/api/v1/messaging/requests/${requestId}/messages/`); }
  deleteMessage(requestId: string, messageId: number): Observable<void> { return this.http.delete<void>(`/api/v1/messaging/requests/${requestId}/messages/${messageId}/`); }
  sendMessage(requestId: string, body: string, files: File[]): Observable<PortalMessage> {
    const payload = new FormData();
    payload.append('body', body);
    files.forEach(file => payload.append('uploaded_files', file, file.name));
    return this.http.post<PortalMessage>(`/api/v1/messaging/requests/${requestId}/messages/`, payload);
  }
  updateStatus(requestId: string, status: string): Observable<{ status: string; status_display: string }> {
    return this.http.patch<{ status: string; status_display: string }>(`/api/v1/custom-requests/${requestId}/studio/`, { status });
  }
  attachmentBlob(file: MessageAttachment): Observable<Blob> { return this.http.get(file.download_url, { responseType: 'blob' }); }
  downloadAttachment(file: MessageAttachment): void {
    this.http.get(file.download_url, { responseType: 'blob' }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = file.original_name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }
  viewAttachment(file: MessageAttachment): void {
    const previewWindow = window.open('', '_blank');
    this.http.get(file.download_url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        if (previewWindow) previewWindow.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => previewWindow?.close()
    });
  }
}
