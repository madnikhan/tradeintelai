/**
 * WebSocket Client for MT5 Real-Time Connectivity
 * 
 * Connects to MT5 WebSocket server from Next.js frontend
 * Handles reconnection, authentication, and event subscriptions
 */

import { EventEmitter } from 'events';

export interface MT5WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
}

export class MT5WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private isConnecting: boolean = false;
  private isAuthenticated: boolean = false;
  private subscriptions: Set<string> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(url: string = 'ws://localhost:8081/mt5-ws') {
    super();
    this.url = url;
  }

  public connect(token?: string, accountId?: string): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // Authenticate if token provided
        if (token) {
          this.authenticate(token, accountId);
        }

        // Start ping interval
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: MT5WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.stopPingInterval();
        this.emit('disconnected');
        
        // Attempt to reconnect
        this.attemptReconnect(token, accountId);
      };
    } catch (error) {
      this.isConnecting = false;
      this.emit('error', error);
      this.attemptReconnect(token, accountId);
    }
  }

  private handleMessage(message: MT5WebSocketMessage): void {
    switch (message.type) {
      case 'connection.established':
        this.emit('connection.established', message.data);
        break;

      case 'auth.success':
        this.isAuthenticated = true;
        this.emit('authenticated', message.data);
        // Re-subscribe to previous subscriptions
        this.subscriptions.forEach((event) => {
          this.subscribe(event);
        });
        break;

      case 'auth.failed':
        this.isAuthenticated = false;
        this.emit('auth.failed', message.data);
        break;

      case 'position.opened':
        this.emit('position.opened', message.data);
        break;

      case 'position.closed':
        this.emit('position.closed', message.data);
        break;

      case 'position.modified':
        this.emit('position.modified', message.data);
        break;

      case 'price.update':
        this.emit('price.update', message.data);
        break;

      case 'account.update':
        this.emit('account.update', message.data);
        break;

      case 'trade.executed':
        this.emit('trade.executed', message.data);
        break;

      case 'trade.failed':
        this.emit('trade.failed', message.data);
        break;

      case 'pong':
        // Server responded to ping
        break;

      case 'error':
        this.emit('error', message.data);
        break;

      default:
        // Emit as generic message
        this.emit('message', message);
    }
  }

  public authenticate(token: string, accountId?: string): void {
    this.send({
      type: 'auth',
      data: { token, accountId },
    });
  }

  public subscribe(event: string): void {
    if (!this.isAuthenticated) {
      this.subscriptions.add(event);
      return;
    }

    this.send({
      type: 'subscribe',
      data: { events: [event] },
    });

    this.subscriptions.add(event);
  }

  public unsubscribe(event: string): void {
    this.send({
      type: 'unsubscribe',
      data: { events: [event] },
    });

    this.subscriptions.delete(event);
  }

  public requestAccountInfo(): void {
    this.send({
      type: 'request.account_info',
      data: {},
    });
  }

  public requestPositions(): void {
    this.send({
      type: 'request.positions',
      data: {},
    });
  }

  public requestMarketData(symbol: string): void {
    this.send({
      type: 'request.market_data',
      data: { symbol },
    });
  }

  private send(message: MT5WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  private attemptReconnect(token?: string, accountId?: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect.failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect(token, accountId);
    }, delay);
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', data: { timestamp: Date.now() } });
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isAuthenticated = false;
    this.subscriptions.clear();
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public isAuth(): boolean {
    return this.isAuthenticated;
  }
}

// Export singleton instance for React hooks
let wsClientInstance: MT5WebSocketClient | null = null;

export function getWebSocketClient(url?: string): MT5WebSocketClient {
  if (!wsClientInstance) {
    wsClientInstance = new MT5WebSocketClient(url);
  }
  return wsClientInstance;
}
