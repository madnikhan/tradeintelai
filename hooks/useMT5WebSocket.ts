/**
 * React Hook for MT5 WebSocket Connection
 * 
 * Provides easy access to MT5 WebSocket client in React components
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { MT5WebSocketClient, getWebSocketClient } from '@/lib/mt5-websocket-client';

export function useMT5WebSocket(token?: string, accountId?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<MT5WebSocketClient | null>(null);

  useEffect(() => {
    const client = getWebSocketClient();
    clientRef.current = client;

    // Set up event listeners
    const onConnected = () => {
      setIsConnected(true);
      setError(null);
    };

    const onDisconnected = () => {
      setIsConnected(false);
      setIsAuthenticated(false);
    };

    const onAuthenticated = () => {
      setIsAuthenticated(true);
    };

    const onError = (err: any) => {
      setError(err instanceof Error ? err : new Error(String(err)));
    };

    client.on('connected', onConnected);
    client.on('disconnected', onDisconnected);
    client.on('authenticated', onAuthenticated);
    client.on('error', onError);

    // Connect
    if (token) {
      client.connect(token, accountId);
    } else {
      client.connect();
    }

    // Cleanup
    return () => {
      client.off('connected', onConnected);
      client.off('disconnected', onDisconnected);
      client.off('authenticated', onAuthenticated);
      client.off('error', onError);
    };
  }, [token, accountId]);

  const subscribe = useCallback((event: string) => {
    clientRef.current?.subscribe(event);
  }, []);

  const unsubscribe = useCallback((event: string) => {
    clientRef.current?.unsubscribe(event);
  }, []);

  const requestAccountInfo = useCallback(() => {
    clientRef.current?.requestAccountInfo();
  }, []);

  const requestPositions = useCallback(() => {
    clientRef.current?.requestPositions();
  }, []);

  const requestMarketData = useCallback((symbol: string) => {
    clientRef.current?.requestMarketData(symbol);
  }, []);

  return {
    isConnected,
    isAuthenticated,
    error,
    subscribe,
    unsubscribe,
    requestAccountInfo,
    requestPositions,
    requestMarketData,
    client: clientRef.current,
  };
}
