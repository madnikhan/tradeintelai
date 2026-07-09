'use client';

import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { getBridgeUrl } from '@/config/bridge-config';
import {
  ensureGeminiAvailable,
  resetGeminiCircuitBreaker,
} from '@/lib/gemini-circuit-breaker';
import {
  ensureOpenAIAvailable,
  resetOpenAICircuitBreaker,
} from '@/lib/openai-circuit-breaker';
import type { AIHealthReason } from '@/lib/ai-types';
import { getAIProvider } from '@/lib/ai-settings';
import { useBridgePresence } from '@/context/BridgeContext';
import { useBridgeStatus } from '@/hooks/useBridgeStatus';

const AUTH_BACKOFF_MS = 5 * 60 * 1000;
const QUOTA_BACKOFF_MS = 2 * 60 * 1000;

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
  const { state: homeBridgeState, loading: homeBridgeLoading } = useBridgePresence();
  const bridgeStatus = useBridgeStatus();
  const geminiBackoffRef = useRef<{ until: number; cached: SystemStatus | null }>({
    until: 0,
    cached: null,
  });
  const openAiBackoffRef = useRef<{ until: number; cached: SystemStatus | null }>({
    until: 0,
    cached: null,
  });

  const checkAIProvider = async (
    options: {
      id: string;
      name: string;
      healthPath: string;
      backoffRef: MutableRefObject<{ until: number; cached: SystemStatus | null }>;
      resetBreaker: () => void;
      ensureAvailable: () => Promise<boolean>;
      force?: boolean;
    }
  ): Promise<SystemStatus> => {
    const { id, name, healthPath, backoffRef, resetBreaker, ensureAvailable, force } = options;
    const now = Date.now();

    if (!force && backoffRef.current.until > now && backoffRef.current.cached) {
      return {
        ...backoffRef.current.cached,
        message: `${backoffRef.current.cached.message} (retry in ${Math.ceil(
          (backoffRef.current.until - now) / 60000
        )}m)`,
        lastChecked: new Date(),
      };
    }

    if (force) {
      resetBreaker();
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(healthPath, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok) {
        backoffRef.current = { until: 0, cached: null };
        await ensureAvailable();
        return {
          id,
          name,
          status: 'online',
          message: data.message || 'API key valid',
          lastChecked: new Date(),
        };
      }

      if (response.status === 500 && data.message?.includes('missing')) {
        backoffRef.current = { until: 0, cached: null };
        return {
          id,
          name,
          status: 'offline',
          message: data.message || 'API key not configured',
          lastChecked: new Date(),
        };
      }

      const reason = (data.reason as AIHealthReason) || 'error';
      const message =
        data.message ||
        (typeof data.error === 'string' ? data.error : data.error?.message) ||
        `HTTP ${response.status}`;

      const suffixHint = data.keyFingerprint?.suffix
        ? ` [server key suffix: …${data.keyFingerprint.suffix}]`
        : '';

      let displayMessage = `${message}${suffixHint}`;
      if (reason === 'quota') {
        displayMessage = `Quota exceeded — try Auto or the other provider.${suffixHint}`;
      } else if (reason === 'auth') {
        displayMessage = `Invalid API key.${suffixHint}`;
      }

      const result: SystemStatus = {
        id,
        name,
        status: reason === 'missing' ? 'offline' : 'error',
        message: displayMessage,
        lastChecked: new Date(),
      };

      if (reason === 'auth' || reason === 'quota') {
        const backoff = reason === 'quota' ? QUOTA_BACKOFF_MS : AUTH_BACKOFF_MS;
        backoffRef.current = {
          until: Date.now() + backoff,
          cached: result,
        };
      } else {
        backoffRef.current = { until: 0, cached: null };
      }

      await ensureAvailable();
      return result;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          id,
          name,
          status: 'error',
          message: 'Request timeout',
          lastChecked: new Date(),
        };
      }
      return {
        id,
        name,
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: new Date(),
      };
    }
  };

  const checkSystemStatus = useCallback(async (options?: { force?: boolean }) => {
    setIsChecking(true);
    const statuses: SystemStatus[] = [];

    const checkGemini = () =>
      checkAIProvider({
        id: 'gemini',
        name: 'Gemini AI',
        healthPath: '/api/gemini/health',
        backoffRef: geminiBackoffRef,
        resetBreaker: resetGeminiCircuitBreaker,
        ensureAvailable: ensureGeminiAvailable,
        force: options?.force,
      });

    const checkOpenAI = () =>
      checkAIProvider({
        id: 'openai',
        name: 'OpenAI GPT',
        healthPath: '/api/openai/health',
        backoffRef: openAiBackoffRef,
        resetBreaker: resetOpenAICircuitBreaker,
        ensureAvailable: ensureOpenAIAvailable,
        force: options?.force,
      });

    // 2. Check MT5 Bridge
    const checkMT5Bridge = async (): Promise<SystemStatus> => {
      try {
        const bridgeUrl = getBridgeUrl('/health?mt5=1');
        console.log('[SystemStatus] Checking MT5 bridge at:', bridgeUrl);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(bridgeUrl, {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true', // Skip ngrok free tier browser warning
          },
          signal: controller.signal,
          cache: 'no-cache', // Prevent caching
        });

        clearTimeout(timeoutId);

        console.log('[SystemStatus] Bridge response status:', response.status, response.statusText);

        if (response.ok) {
          const data = await response.json();
          console.log('[SystemStatus] Bridge response data:', data);
          
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

        const errorText = await response.text().catch(() => 'No error details');
        console.error('[SystemStatus] Bridge not responding:', response.status, errorText);

        let message = `Bridge not responding (${response.status})`;
        if (response.status === 404) {
          message =
            'Invalid bridge URL — use Connect dashboard in TradeIntel Bridge (tunnel URL, not the dashboard site). Open with ?bridge_url=https://YOUR-TUNNEL';
        }
        
        return {
          id: 'mt5-bridge',
          name: 'MT5 Bridge',
          status: 'offline',
          message,
          lastChecked: new Date(),
        };
      } catch (error: any) {
        console.error('[SystemStatus] Bridge check error:', error);

        const triedUrl = getBridgeUrl('/health?mt5=1');
        const isPageHttps =
          typeof window !== 'undefined' && window.location.protocol === 'https:';
        const triedLocalhost =
          /localhost|127\.0\.0\.1/i.test(triedUrl);

        let hint = '';
        if (isPageHttps && triedLocalhost) {
          hint =
            ' This HTTPS site cannot use http://localhost:8080 from your browser. Run Cloudflare Tunnel or ngrok on your PC, then open the dashboard with ?bridge_url=https://YOUR-TUNNEL (no trailing slash).';
        } else if (isPageHttps) {
          hint =
            ' Check the tunnel URL, CORS, and that the bridge is running (see browser console for the exact URL).';
        }

        if (error.name === 'AbortError') {
          return {
            id: 'mt5-bridge',
            name: 'MT5 Bridge',
            status: 'offline',
            message: `Connection timeout.${hint}`.trim(),
            lastChecked: new Date(),
          };
        }
        return {
          id: 'mt5-bridge',
          name: 'MT5 Bridge',
          status: 'offline',
          message: `Bridge not reachable (${error.message || 'network error'}).${hint}`.trim(),
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

    // 4. Check Trading Economics (lightweight ping — no CPI scrape)
    const checkTradingEconomics = async (): Promise<SystemStatus> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('/api/health/tradingeconomics', {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            id: 'trading-economics',
            name: 'Trading Economics',
            status: 'online',
            message: data.message || 'Routes configured',
            lastChecked: new Date(),
          };
        }

        return {
          id: 'trading-economics',
          name: 'Trading Economics',
          status: 'error',
          message: `HTTP ${response.status}`,
          lastChecked: new Date(),
        };
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
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

    // Run checks — only health-check AI providers selected in Settings
    const aiProvider = getAIProvider();
    const checkPromises: Promise<SystemStatus>[] = [];

    if (aiProvider === 'auto' || aiProvider === 'gemini') {
      checkPromises.push(checkGemini());
    }
    if (aiProvider === 'auto' || aiProvider === 'openai') {
      checkPromises.push(checkOpenAI());
    }

    const allResults = await Promise.all([
      ...checkPromises,
      checkMT5Bridge(),
      checkFirebase(),
      checkTradingEconomics(),
    ]);

    statuses.push(...allResults);

    const homeLabels: Record<string, string> = {
      online: 'Home bridge online',
      online_ea_disconnected: 'Home bridge online (EA disconnected)',
      offline: 'Home bridge offline',
      not_paired: 'Home bridge not paired',
      unknown: 'Home bridge unknown',
    };
    statuses.unshift({
      id: 'home-bridge-presence',
      name: 'Home Bridge',
      status:
        homeBridgeState === 'online'
          ? 'online'
          : homeBridgeState === 'online_ea_disconnected'
            ? 'error'
            : homeBridgeState === 'offline'
              ? 'offline'
              : homeBridgeLoading
                ? 'checking'
                : 'offline',
      message: homeLabels[homeBridgeState] ?? homeLabels.unknown,
      lastChecked: new Date(),
    });

    setSystems(statuses);
    setIsChecking(false);
  }, [homeBridgeState, homeBridgeLoading]);

  // Check on mount and every 30 seconds
  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 30000);
    const onProviderChange = () => checkSystemStatus({ force: true });
    window.addEventListener('ai-provider-changed', onProviderChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ai-provider-changed', onProviderChange);
    };
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
  const tunnelBridge = systems.find((s) => s.id === 'mt5-bridge');
  const tunnelOnline = tunnelBridge?.status === 'online';
  const statusButtonLabel = bridgeStatus.loading
    ? 'Checking…'
    : bridgeStatus.headerLabel;
  const statusDotClass =
    bridgeStatus.state === 'ready'
      ? 'bg-emerald-400'
      : bridgeStatus.state === 'checking'
        ? 'bg-gray-400'
        : bridgeStatus.state === 'tunnel_down'
          ? 'bg-rose-400'
          : 'bg-amber-400';

  return (
    <div className="relative">
      {/* Status Indicator Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-[#141c2b] border border-[#1e2738] text-white hover:bg-[#1e2738] transition-all text-xs sm:text-sm touch-manipulation"
        title={`${bridgeStatus.label}${bridgeStatus.fixHint ? ` — ${bridgeStatus.fixHint}` : ''}`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDotClass} ${isChecking ? 'animate-pulse' : ''}`}></span>
          <span className="hidden sm:inline">{statusButtonLabel}</span>
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
                  onClick={() => checkSystemStatus({ force: true })}
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

