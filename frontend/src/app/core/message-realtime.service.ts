import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';

export interface RealtimeMessageEvent {
  type: 'message.created';
  request_id: string;
  message_id: number;
}

@Injectable({ providedIn: 'root' })
export class MessageRealtimeService {
  private readonly auth = inject(AuthService);
  private readonly eventSubject = new Subject<RealtimeMessageEvent>();
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  readonly connected = signal(false);
  readonly messages = this.eventSubject.asObservable();
  readonly available = computed(() => this.auth.isSignedIn() && this.connected());

  constructor() {
    effect(() => {
      if (this.auth.isSignedIn()) this.connect();
      else this.disconnect();
    });
  }

  private connect(): void {
    if (typeof window === 'undefined' || this.socket || this.reconnectTimer) return;
    const token = this.auth.accessToken();
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/messages/`, ['portal-realtime', `jwt.${token}`]);
    this.socket = socket;
    socket.onopen = () => this.connected.set(true);
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as RealtimeMessageEvent;
        if (message.type === 'message.created') this.eventSubject.next(message);
      } catch {}
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.connected.set(false);
      if (this.auth.isSignedIn()) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 3000);
      }
    };
  }

  private disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.connected.set(false);
  }
}
