/**
 * Client-side circuit breaker for OpenAI /api/openai/health
 */

import type { AIHealthReason } from '@/lib/ai-types';

const AUTH_BREAKER_MS = 5 * 60 * 1000;
const QUOTA_BREAKER_MS = 2 * 60 * 1000;

type CircuitState = {
  available: boolean;
  until: number;
  message?: string;
  suffix?: string;
  reason?: AIHealthReason;
};

let cached: CircuitState | null = null;
let inFlight: Promise<boolean> | null = null;

function isCacheValid(): boolean {
  return cached !== null && Date.now() < cached.until;
}

export async function ensureOpenAIAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return !!process.env.OPENAI_API_KEY?.trim();
  }
  if (isCacheValid()) return cached!.available;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch('/api/openai/health', { method: 'GET' });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.ok) {
        cached = {
          available: true,
          until: Date.now() + 2 * 60 * 1000,
          suffix: data.keyFingerprint?.suffix,
          reason: 'ok',
        };
        return true;
      }

      const reason = (data.reason as AIHealthReason) || 'error';
      const message = data.message || `HTTP ${response.status}`;
      const backoff = reason === 'quota' ? QUOTA_BREAKER_MS : AUTH_BREAKER_MS;

      cached = {
        available: false,
        until: Date.now() + backoff,
        message,
        suffix: data.keyFingerprint?.suffix,
        reason,
      };
      return false;
    } catch {
      cached = {
        available: false,
        until: Date.now() + AUTH_BREAKER_MS,
        message: 'Connection failed',
        reason: 'error',
      };
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function isOpenAIAvailableSync(): boolean {
  if (typeof window === 'undefined') return !!process.env.OPENAI_API_KEY?.trim();
  if (isCacheValid()) return cached!.available;
  return false;
}

export function getOpenAICircuitReason(): AIHealthReason | undefined {
  return cached?.reason;
}

export function resetOpenAICircuitBreaker(): void {
  cached = null;
  inFlight = null;
}
