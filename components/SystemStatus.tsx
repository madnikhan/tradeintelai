'use client';

import { useState, useEffect, useCallback } from 'react';
import { isOpenAIConfigured } from '@/lib/openai-service';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { httpBridge } from '@/lib/http-bridge-connector';
import { getBridgeUrl } from '@/config/bridge-config';
import { getAuth } from 'firebase/auth';
import { getApp } from '@/lib/firebase/config';

interface SystemStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'checking' | 'error';
  message?: string;
  lastChecked?: Date;
}

export function SystemStatus() {
  const [systems, setSystems] = useState<SystemStatus[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkSystemStatus = useCallback(async () => {
    setIsChecking(true);
    const statuses: SystemStatus[] = [];

    // 1. Check GPT-5.1/OpenAI
    const checkOpenAI = async (): Promise<SystemStatus> => {
      const configured = isOpenAIConfigured();
      if (!configured) {
        return {
          id: 'openai',
          name: 'GPT-5.1',
          status: 'offline',
          message: 'API key not configured',
          lastChecked: new Date(),
        };
      }

      try {
        // Get auth token for API authentication
        let authToken: string | null = null;
        try {
          if (typeof window !== 'undefined') {
            const app = getApp();
            if (app) {
              const auth = getAuth(app);
              const user = auth.currentUser;
              if (user) {
                authToken = await user.getIdToken();
              }
            }
          }
        } catch (authError) {
          // Auth not available - will show as error
        }

        // If no auth token, return appropriate status
        if (!authToken) {
          return {
            id: 'openai',
            name: 'GPT-5.1',
            status: 'error',
            message: 'Sign in required to test',
            lastChecked: new Date(),
          };
        }

        // Test OpenAI API with a simple request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('/api/openai/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'test' }],
            max_completion_tokens: 5,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return {
            id: 'openai',
            name: 'GPT-5.1',
            status: 'online',
            message: 'API responding',
            lastChecked: new Date(),
          };
        } else {
          const errorData = await response.json().catch(() => ({}));
          
          // Handle 401 specifically
          if (response.status === 401) {
            return {
              id: 'openai',
              name: 'GPT-5.1',
              status: 'error',
              message: 'Authentication failed - sign in again',
              lastChecked: new Date(),
            };
          }
          
          return {
            id: 'openai',
            name: 'GPT-5.1',
            status: 'error',
            message: errorData.error?.message || `HTTP ${response.status}`,
            lastChecked: new Date(),
          };
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return {
            id: 'openai',
            name: 'GPT-5.1',
            status: 'error',
            message: 'Request timeout',
            lastChecked: new Date(),
          };
        }
        return {
          id: 'openai',
          name: 'GPT-5.1',
          status: 'error',
          message: error.message || 'Connection failed',
          lastChecked: new Date(),
        };
      }
    };

    // 2. Check MT5 Bridge
    const checkMT5Bridge = async (): Promise<SystemStatus> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(getBridgeUrl('/health'), {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true', // Skip ngrok free tier browser warning
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'running') {
            return {
              id: 'mt5-bridge',
              name: 'MT5 Bridge',
              status: 'online',
              message: data.mt5_connected ? 'EA connected' : 'Bridge running (EA not connected)',
              lastChecked: new Date(),
            };
          }
        }

        return {
          id: 'mt5-bridge',
          name: 'MT5 Bridge',
          status: 'offline',
          message: 'Bridge not responding',
          lastChecked: new Date(),
        };
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return {
            id: 'mt5-bridge',
            name: 'MT5 Bridge',
            status: 'offline',
            message: 'Connection timeout',
            lastChecked: new Date(),
          };
        }
        return {
          id: 'mt5-bridge',
          name: 'MT5 Bridge',
          status: 'offline',
          message: 'Bridge not running',
          lastChecked: new Date(),
        };
      }
    };

    // 3. Check Firebase/Firestore
    const checkFirebase = async (): Promise<SystemStatus> => {
      const configured = isFirebaseConfigured();
      if (!configured) {
        return {
          id: 'firebase',
          name: 'Firebase',
          status: 'offline',
          message: 'Not configured',
          lastChecked: new Date(),
        };
      }

      try {
        // Try to initialize Firebase (this will fail if config is invalid)
        // Use dynamic import to avoid SSR issues
        if (typeof window !== 'undefined') {
          const { getDb } = await import('@/lib/firebase/config');
          const db = getDb();
          
          // If we get here, Firebase is configured and initialized
          return {
            id: 'firebase',
            name: 'Firebase',
            status: 'online',
            message: 'Connected',
            lastChecked: new Date(),
          };
        } else {
          // SSR - just check if configured
          return {
            id: 'firebase',
            name: 'Firebase',
            status: 'online',
            message: 'Configured',
            lastChecked: new Date(),
          };
        }
      } catch (error: any) {
        return {
          id: 'firebase',
          name: 'Firebase',
          status: 'error',
          message: error.message || 'Initialization failed',
          lastChecked: new Date(),
        };
      }
    };

    // 4. Check Trading Economics API
    const checkTradingEconomics = async (): Promise<SystemStatus> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Test with a simple CPI endpoint
        const response = await fetch('/api/tradingeconomics/cpi?country=united-states', {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return {
            id: 'trading-economics',
            name: 'Trading Economics',
            status: 'online',
            message: 'API responding',
            lastChecked: new Date(),
          };
        } else {
          return {
            id: 'trading-economics',
            name: 'Trading Economics',
            status: 'error',
            message: `HTTP ${response.status}`,
            lastChecked: new Date(),
          };
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return {
            id: 'trading-economics',
            name: 'Trading Economics',
            status: 'error',
            message: 'Request timeout',
            lastChecked: new Date(),
          };
        }
        return {
          id: 'trading-economics',
          name: 'Trading Economics',
          status: 'error',
          message: 'Connection failed',
          lastChecked: new Date(),
        };
      }
    };

    // Run all checks in parallel
    const [openAIStatus, mt5Status, firebaseStatus, teStatus] = await Promise.all([
      checkOpenAI(),
      checkMT5Bridge(),
      checkFirebase(),
      checkTradingEconomics(),
    ]);

    statuses.push(openAIStatus, mt5Status, firebaseStatus, teStatus);
    setSystems(statuses);
    setIsChecking(false);
  }, []);

  // Check on mount and every 30 seconds
  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkSystemStatus]);

  const getStatusColor = (status: SystemStatus['status']) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-400';
      case 'offline':
        return 'bg-rose-400';
      case 'error':
        return 'bg-amber-400';
      case 'checking':
        return 'bg-gray-400 animate-pulse';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: SystemStatus['status']) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Error';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const allOnline = systems.length > 0 && systems.every(s => s.status === 'online');
  const hasErrors = systems.some(s => s.status === 'error' || s.status === 'offline');

  return (
    <div className="relative">
      {/* Status Indicator Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-[#141c2b] border border-[#1e2738] text-white hover:bg-[#1e2738] transition-all text-xs sm:text-sm touch-manipulation"
        title="System Status"
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${allOnline ? 'bg-emerald-400' : hasErrors ? 'bg-rose-400' : 'bg-gray-400'} ${isChecking ? 'animate-pulse' : ''}`}></span>
          <span className="hidden sm:inline">Status</span>
        </div>
        <svg 
          className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Status Panel */}
      {isExpanded && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#0d1321] border border-[#1e2738] rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 border-b border-[#1e2738]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🔌</span> System Status
                </h3>
                <button
                  onClick={checkSystemStatus}
                  disabled={isChecking}
                  className="p-1.5 rounded-lg bg-[#1e2738] text-gray-400 hover:text-white hover:bg-[#2a3548] transition-all disabled:opacity-50"
                  title="Refresh Status"
                >
                  <svg 
                    className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="py-2 max-h-96 overflow-y-auto">
              {systems.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mx-auto mb-2"></div>
                  <p className="text-xs text-gray-400">Checking systems...</p>
                </div>
              ) : (
                systems.map((system) => (
                  <div
                    key={system.id}
                    className="px-4 py-3 border-b border-[#1e2738] last:border-b-0 hover:bg-[#141c2b] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(system.status)}`}></span>
                        <span className="text-sm font-medium text-white">{system.name}</span>
                      </div>
                      <span className={`text-xs font-medium ${
                        system.status === 'online' ? 'text-emerald-400' :
                        system.status === 'offline' ? 'text-rose-400' :
                        system.status === 'error' ? 'text-amber-400' :
                        'text-gray-400'
                      }`}>
                        {getStatusText(system.status)}
                      </span>
                    </div>
                    {system.message && (
                      <p className="text-xs text-gray-400 mt-1 ml-4.5">{system.message}</p>
                    )}
                    {system.lastChecked && (
                      <p className="text-xs text-gray-500 mt-1 ml-4.5">
                        {system.lastChecked.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Summary Footer */}
            {systems.length > 0 && (
              <div className="p-3 border-t border-[#1e2738] bg-[#141c2b]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    {systems.filter(s => s.status === 'online').length} / {systems.length} online
                  </span>
                  {allOnline && (
                    <span className="text-emerald-400 font-medium">✓ All systems operational</span>
                  )}
                  {hasErrors && !allOnline && (
                    <span className="text-rose-400 font-medium">⚠ Some systems offline</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

