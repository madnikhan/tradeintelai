'use client';

import { useState, useEffect } from 'react';
import { httpBridge } from '@/lib/http-bridge-connector';
import { getBridgeUrl } from '@/config/bridge-config';
import { logger } from '@/lib/logger';

export function ConnectionTester() {
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [accountInfo, setAccountInfo] = useState<any>(null);

  useEffect(() => {
    // Test connection on mount
    testConnection();
    
    // Retry connection every 10 seconds if disconnected
    const interval = setInterval(() => {
      if (connectionStatus === 'failed' || connectionStatus === 'unknown') {
        testConnection();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const testConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('unknown');
    
    try {
      // Test health endpoint directly with short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const healthResponse = await fetch(getBridgeUrl('/health'), {
        signal: controller.signal,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!healthResponse.ok) {
        setConnectionStatus('failed');
        setIsTesting(false);
        return;
      }
      
      const healthData = await healthResponse.json();
      const isConnected = healthData && healthData.status === 'running';
      
      setConnectionStatus(isConnected ? 'connected' : 'failed');
      
      if (isConnected) {
        logger.info('✅ MT5 Bridge connected');
        // Try to get account info to verify full connection (non-blocking, don't wait)
        // This runs in background and won't block the connection status
        setTimeout(() => {
          httpBridge.getAccountInfo()
            .then(account => {
              if (account.success) {
                setAccountInfo(account);
                logger.debug('✅ Account info retrieved:', account.balance);
              }
            })
            .catch(accountError => {
              // EA may not be responding, but bridge is connected
              logger.warn('⚠️ Account info timeout (EA may not be attached):', accountError);
            });
        }, 100);
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        logger.warn('⏱️ Connection test timeout - bridge may be starting up');
      } else {
        logger.error('Connection test error:', error);
      }
      setConnectionStatus('failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${
          connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 
          connectionStatus === 'failed' ? 'bg-rose-400' : 'bg-gray-500 animate-pulse'
        }`}></span>
        <span className={`text-sm font-medium ${
          connectionStatus === 'connected' ? 'text-emerald-400' : 
          connectionStatus === 'failed' ? 'text-rose-400' : 'text-gray-400'
        }`}>
          {connectionStatus === 'connected' ? 'MT5 Connected' :
           connectionStatus === 'failed' ? 'Disconnected' : 
           isTesting ? 'Connecting...' : 'Unknown'}
        </span>
      </div>
      <button
        onClick={testConnection}
        disabled={isTesting}
        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:text-gray-600"
      >
        {isTesting ? '...' : '↻'}
      </button>
    </div>
  );
}
