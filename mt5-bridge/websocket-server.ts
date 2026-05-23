/**
 * WebSocket Server for MT5 Real-Time Connectivity
 * 
 * Provides real-time bidirectional communication between:
 * - Next.js web application (client)
 * - MT5 Bridge (Python server)
 * - MT5 Terminal (via EA)
 * 
 * Events:
 * - Position updates (opened, closed, modified)
 * - Price updates (real-time ticks)
 * - Account updates (balance, equity, margin)
 * - Trade execution results
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { logger } from '../lib/logger';

interface MT5WebSocketMessage {
  type: string;
  data: any;
  timestamp?: number;
  accountId?: string;
}

interface ClientConnection {
  ws: WebSocket;
  accountId?: string;
  authenticated: boolean;
  lastPing: number;
}

export class MT5WebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private httpServer: any;
  private clients: Map<string, ClientConnection> = new Map();
  private port: number;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8081) {
    super();
    this.port = port;
    
    // Create HTTP server for WebSocket upgrade
    this.httpServer = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: '/mt5-ws',
    });

    this.setupEventHandlers();
    this.startPingInterval();
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        ws,
        authenticated: false,
        lastPing: Date.now(),
      };

      this.clients.set(clientId, client);
      logger.info(`🔌 New WebSocket connection: ${clientId} (${this.clients.size} total)`);

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message: MT5WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error: any) {
          logger.error(`Error parsing WebSocket message from ${clientId}:`, error);
          this.sendError(clientId, 'Invalid message format');
        }
      });

      // Handle connection close
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`🔌 WebSocket connection closed: ${clientId} (${this.clients.size} remaining)`);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Send welcome message
      this.send(clientId, {
        type: 'connection.established',
        data: {
          clientId,
          serverTime: new Date().toISOString(),
          requiresAuth: true,
        },
      });
    });
  }

  private handleMessage(clientId: string, message: MT5WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'auth':
        this.handleAuth(clientId, message.data);
        break;

      case 'subscribe':
        this.handleSubscribe(clientId, message.data);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message.data);
        break;

      case 'ping':
        client.lastPing = Date.now();
        this.send(clientId, { type: 'pong', data: { timestamp: Date.now() } });
        break;

      case 'request.account_info':
        this.handleAccountInfoRequest(clientId);
        break;

      case 'request.positions':
        this.handlePositionsRequest(clientId);
        break;

      case 'request.market_data':
        this.handleMarketDataRequest(clientId, message.data);
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
        this.sendError(clientId, `Unknown message type: ${message.type}`);
    }
  }

  private handleAuth(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Simple auth - in production, use JWT tokens
    const { token, accountId } = data;
    
    // TODO: Validate token
    if (token) {
      client.authenticated = true;
      client.accountId = accountId;
      
      this.send(clientId, {
        type: 'auth.success',
        data: { accountId, authenticated: true },
      });
      
      logger.info(`✅ Client ${clientId} authenticated for account ${accountId}`);
    } else {
      this.sendError(clientId, 'Authentication failed: Invalid token');
    }
  }

  private handleSubscribe(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { events } = data;
    logger.info(`📡 Client ${clientId} subscribed to: ${events.join(', ')}`);
    
    this.send(clientId, {
      type: 'subscribe.success',
      data: { events },
    });
  }

  private handleUnsubscribe(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { events } = data;
    logger.info(`📡 Client ${clientId} unsubscribed from: ${events.join(', ')}`);
    
    this.send(clientId, {
      type: 'unsubscribe.success',
      data: { events },
    });
  }

  private async handleAccountInfoRequest(clientId: string): Promise<void> {
    // Forward to MT5 bridge and send response
    // This would call the Python bridge's HTTP API
    try {
      // TODO: Call MT5 bridge HTTP API
      const accountInfo = await this.fetchAccountInfo();
      
      this.send(clientId, {
        type: 'account.info',
        data: accountInfo,
      });
    } catch (error: any) {
      this.sendError(clientId, `Failed to get account info: ${error.message}`);
    }
  }

  private async handlePositionsRequest(clientId: string): Promise<void> {
    try {
      const positions = await this.fetchPositions();
      
      this.send(clientId, {
        type: 'positions.list',
        data: positions,
      });
    } catch (error: any) {
      this.sendError(clientId, `Failed to get positions: ${error.message}`);
    }
  }

  private async handleMarketDataRequest(clientId: string, data: any): Promise<void> {
    const { symbol } = data;
    try {
      const marketData = await this.fetchMarketData(symbol);
      
      this.send(clientId, {
        type: 'market.data',
        data: { symbol, ...marketData },
      });
    } catch (error: any) {
      this.sendError(clientId, `Failed to get market data: ${error.message}`);
    }
  }

  // Public methods to push events to clients
  public broadcastPositionOpened(position: any): void {
    this.broadcast({
      type: 'position.opened',
      data: position,
      timestamp: Date.now(),
    });
  }

  public broadcastPositionClosed(position: any): void {
    this.broadcast({
      type: 'position.closed',
      data: position,
      timestamp: Date.now(),
    });
  }

  public broadcastPriceUpdate(symbol: string, price: any): void {
    this.broadcast({
      type: 'price.update',
      data: { symbol, ...price },
      timestamp: Date.now(),
    });
  }

  public broadcastAccountUpdate(accountInfo: any): void {
    this.broadcast({
      type: 'account.update',
      data: accountInfo,
      timestamp: Date.now(),
    });
  }

  public broadcastTradeExecuted(trade: any): void {
    this.broadcast({
      type: 'trade.executed',
      data: trade,
      timestamp: Date.now(),
    });
  }

  // Helper methods
  private send(clientId: string, message: MT5WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error: any) {
      logger.error(`Error sending message to ${clientId}:`, error);
    }
  }

  private sendError(clientId: string, error: string): void {
    this.send(clientId, {
      type: 'error',
      data: { message: error },
      timestamp: Date.now(),
    });
  }

  private broadcast(message: MT5WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      if (client.authenticated && client.ws.readyState === WebSocket.OPEN) {
        this.send(clientId, message);
      }
    });
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPingInterval(): void {
    // Ping clients every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Check if client is still alive
          if (Date.now() - client.lastPing > 60000) {
            // No ping in 60 seconds, close connection
            logger.warn(`Closing inactive connection: ${clientId}`);
            client.ws.close();
            this.clients.delete(clientId);
          } else {
            // Send ping
            this.send(clientId, { type: 'ping', data: { timestamp: Date.now() } });
          }
        }
      });
    }, 30000);
  }

  // Bridge integration methods (call Python HTTP API)
  private async fetchAccountInfo(): Promise<any> {
    // TODO: Call MT5 bridge HTTP API
    const bridgeBase = process.env.BRIDGE_HTTP_URL || 'http://localhost:8080';
    const response = await fetch(`${bridgeBase}/account`);
    return response.json();
  }

  private async fetchPositions(): Promise<any> {
    // TODO: Call MT5 bridge HTTP API
    const bridgeBase = process.env.BRIDGE_HTTP_URL || 'http://localhost:8080';
    const response = await fetch(`${bridgeBase}/positions`);
    return response.json();
  }

  private async fetchMarketData(symbol: string): Promise<any> {
    // TODO: Call MT5 bridge HTTP API
    const bridgeBase = process.env.BRIDGE_HTTP_URL || 'http://localhost:8080';
    const response = await fetch(`${bridgeBase}/price/${symbol}`);
    return response.json();
  }

  public start(): void {
    this.httpServer.listen(this.port, () => {
      logger.info(`🚀 MT5 WebSocket Server started on port ${this.port}`);
      logger.info(`📡 WebSocket endpoint: ws://localhost:${this.port}/mt5-ws`);
    });
  }

  public stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close();
    });

    this.wss.close();
    this.httpServer.close();
    
    logger.info('🛑 MT5 WebSocket Server stopped');
  }
}

// Export singleton instance
let wsServerInstance: MT5WebSocketServer | null = null;

export function getWebSocketServer(port?: number): MT5WebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new MT5WebSocketServer(port);
  }
  return wsServerInstance;
}

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.WS_PORT || '8081', 10);
  const server = new MT5WebSocketServer(port);
  server.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
}
