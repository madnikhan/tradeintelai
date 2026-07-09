/**
 * Bridge Configuration
 * Centralized configuration for MT5 bridge connection
 */

const TUNNEL_HOST_RE =
  /\.(trycloudflare\.com|cfargotunnel\.com|ngrok-free\.app|ngrok\.io|ngrok\.app)$/i;

/** Strip path/query; reject dashboard hosts mistaken for bridge URL. */
export function normalizeBridgeBaseUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('vercel.app')) return null;
    if (host === 'tradeintelai.vercel.app' || host.endsWith('.tradeintelai.vercel.app')) {
      return null;
    }
    if (host.includes('tradeintelai') && !TUNNEL_HOST_RE.test(host)) {
      return null;
    }
    if (parsed.pathname && parsed.pathname !== '/' && !parsed.pathname.startsWith('/health')) {
      // User pasted full dashboard URL — not a bridge origin
      if (parsed.pathname.includes('dashboard')) return null;
    }

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function persistBridgeUrl(url: string): void {
  try {
    localStorage.setItem('bridge_url', url);
  } catch {
    // ignore quota / private mode
  }
}

function clearInvalidBridgeUrl(): void {
  try {
    localStorage.removeItem('bridge_url');
  } catch {
    // ignore
  }
}

/**
 * Get bridge URL from multiple sources (priority order).
 * Resolved on every read (client) so localStorage / URL changes apply without a full reload.
 *
 * 1. URL parameter (?bridge_url=...)
 * 2. localStorage (bridge_url)
 * 3. Environment variable (NEXT_PUBLIC_BRIDGE_URL)
 * 4. Default (http://localhost:8080)
 */
export function getBridgeBaseUrl(): string {
  // Priority 1: URL parameter (for Vercel + tunnel / ngrok / Cloudflare)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('bridge_url');
    if (urlParam) {
      const normalized = normalizeBridgeBaseUrl(urlParam);
      if (normalized) {
        console.log('[Bridge Config] Using bridge URL from URL parameter:', normalized);
        persistBridgeUrl(normalized);
        return normalized;
      }
      console.warn('[Bridge Config] Ignoring invalid bridge_url query param:', urlParam);
    }

    // Priority 2: localStorage (persists across visits; set via ?bridge_url= or DevTools)
    const storageUrl = localStorage.getItem('bridge_url');
    if (storageUrl?.trim()) {
      const normalized = normalizeBridgeBaseUrl(storageUrl);
      if (normalized) {
        console.log('[Bridge Config] Using bridge URL from localStorage:', normalized);
        return normalized;
      }
      console.warn('[Bridge Config] Clearing invalid bridge_url from localStorage:', storageUrl);
      clearInvalidBridgeUrl();
    }
  }

  // Priority 3: Environment variable (baked at build time on client)
  const envUrl = process.env.NEXT_PUBLIC_BRIDGE_URL?.trim();
  if (envUrl) {
    const normalized = normalizeBridgeBaseUrl(envUrl);
    if (normalized) return normalized;
  }

  // Priority 4: Default (same machine only)
  return 'http://localhost:8080';
}

export const BRIDGE_CONFIG = {
  /** Current bridge origin; always re-evaluated on the client */
  get baseUrl(): string {
    return getBridgeBaseUrl();
  },

  // Timeouts (in milliseconds)
  timeouts: {
    health: 2000, // Health check timeout
    account: 10000, // Account info timeout
    positions: 25000, // Positions timeout (EA needs more time)
    trade: 15000, // Trade execution timeout
    price: 5000, // Price fetch timeout
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    delay: 1000, // Initial delay in ms
    backoff: 2, // Exponential backoff multiplier
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    backoff?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = BRIDGE_CONFIG.retry.maxAttempts,
    initialDelay = BRIDGE_CONFIG.retry.delay,
    backoff = BRIDGE_CONFIG.retry.backoff,
    onRetry,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoff;
      }
    }
  }

  throw lastError!;
}

/**
 * Full URL for a bridge endpoint (uses live base URL each call).
 */
/** User-facing hint when browser cannot reach the home bridge (tunnel down, wrong URL). */
export function formatBridgeNetworkError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const bridgeUrl = getBridgeBaseUrl();
  const isHttpsPage =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isLocalBridge = /localhost|127\.0\.0\.1/i.test(bridgeUrl);

  if (
    msg === 'Failed to fetch' ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed')
  ) {
    if (isHttpsPage && isLocalBridge) {
      return `Cannot reach bridge at ${bridgeUrl}. From Vercel you must use a Cloudflare/ngrok tunnel — open Setup and pair your home bridge, or add ?bridge_url=https://YOUR-TUNNEL to the dashboard URL.`;
    }
    return `Cannot reach home bridge at ${bridgeUrl}. Start TradeIntel Bridge + tunnel on your PC and confirm Setup shows bridge online.`;
  }

  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('AbortError')) {
    return `Bridge timeout at ${bridgeUrl}. MT5 EA may be busy — check Experts tab for execute_trade commands.`;
  }

  return msg;
}

export function getBridgeUrl(endpoint: string, accountLogin?: number): string {
  const base = getBridgeBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let fullUrl = `${base}${path}`;

  if (accountLogin) {
    const sep = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${sep}account_login=${accountLogin}`;
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`[Bridge Config] Bridge URL: ${fullUrl}`);
  }

  return fullUrl;
}

/** Router mode when using central multi-bridge entry (port 8080 router). */
export function getBridgeMode(): 'direct' | 'router' {
  const mode = process.env.NEXT_PUBLIC_BRIDGE_MODE?.trim();
  if (mode === 'router') return 'router';
  const base = getBridgeBaseUrl();
  if (base.includes('router') || process.env.NEXT_PUBLIC_BRIDGE_ROUTER === 'true') {
    return 'router';
  }
  return 'direct';
}
