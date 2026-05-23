/**
 * Example Component: MT5 WebSocket Connection Status
 * 
 * Shows real-time connection status and subscribes to MT5 events
 */

'use client';

import { useEffect, useState } from 'react';
import { useMT5WebSocket } from '@/hooks/useMT5WebSocket';

export function MT5WebSocketStatus() {
  const { isConnected, isAuthenticated, error, subscribe, client } = useMT5WebSocket();
  const [lastPosition, setLastPosition] = useState<any>(null);
  const [lastPrice, setLastPrice] = useState<any>(null);
  const [accountInfo, setAccountInfo] = useState<any>(null);

  useEffect(() => {
    if (!client) return;

    // Subscribe to events
    const onPositionOpened = (data: any) => {
      console.log('📈 Position opened:', data);
      setLastPosition({ type: 'opened', ...data });
    };

    const onPositionClosed = (data: any) => {
      console.log('📉 Position closed:', data);
      setLastPosition({ type: 'closed', ...data });
    };

    const onPriceUpdate = (data: any) => {
      console.log('💰 Price update:', data);
      setLastPrice(data);
    };

    const onAccountUpdate = (data: any) => {
      console.log('💳 Account update:', data);
      setAccountInfo(data);
    };

    const onTradeExecuted = (data: any) => {
      console.log('✅ Trade executed:', data);
    };

    // Subscribe to events
    subscribe('position.opened');
    subscribe('position.closed');
    subscribe('price.update');
    subscribe('account.update');
    subscribe('trade.executed');

    // Set up event listeners
    client.on('position.opened', onPositionOpened);
    client.on('position.closed', onPositionClosed);
    client.on('price.update', onPriceUpdate);
    client.on('account.update', onAccountUpdate);
    client.on('trade.executed', onTradeExecuted);

    // Cleanup
    return () => {
      client.off('position.opened', onPositionOpened);
      client.off('position.closed', onPositionClosed);
      client.off('price.update', onPriceUpdate);
      client.off('account.update', onAccountUpdate);
      client.off('trade.executed', onTradeExecuted);
    };
  }, [client, subscribe]);

  return (
    <div className="bg-[#141c2b] rounded-xl border border-[#1e2738] p-6">
      <h3 className="text-lg font-bold text-white mb-4">🔌 MT5 WebSocket Status</h3>
      
      <div className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Connection:</span>
          <span className={`font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? '✅ Connected' : '❌ Disconnected'}
          </span>
        </div>

        {/* Authentication Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Authenticated:</span>
          <span className={`font-bold ${isAuthenticated ? 'text-green-400' : 'text-yellow-400'}`}>
            {isAuthenticated ? '✅ Yes' : '⏳ No'}
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            Error: {error.message}
          </div>
        )}

        {/* Last Position Update */}
        {lastPosition && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded">
            <p className="text-sm font-medium text-blue-400 mb-1">
              {lastPosition.type === 'opened' ? '📈 Position Opened' : '📉 Position Closed'}
            </p>
            <p className="text-xs text-gray-400">
              {lastPosition.symbol} - {lastPosition.volume} lots
            </p>
          </div>
        )}

        {/* Last Price Update */}
        {lastPrice && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
            <p className="text-sm font-medium text-green-400 mb-1">💰 Price Update</p>
            <p className="text-xs text-gray-400">
              {lastPrice.symbol}: {lastPrice.bid} / {lastPrice.ask}
            </p>
          </div>
        )}

        {/* Account Info */}
        {accountInfo && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded">
            <p className="text-sm font-medium text-purple-400 mb-1">💳 Account Update</p>
            <p className="text-xs text-gray-400">
              Balance: ${accountInfo.balance?.toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
