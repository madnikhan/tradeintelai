/**
 * Bridge Configuration
 * Centralized configuration for MT5 bridge connection
 */

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
      const trimmed = urlParam.trim();
      if (trimmed) {
        console.log('[Bridge Config] Using bridge URL from URL parameter:', trimmed);
        try {
          localStorage.setItem('bridge_url', trimmed);
        } catch {
          // ignore quota / private mode
        }
        return trimmed;
      }
    }

    // Priority 2: localStorage (persists across visits; set via ?bridge_url= or DevTools)
    const storageUrl = localStorage.getItem('bridge_url');
    if (storageUrl?.trim()) {
      const s = storageUrl.trim();
      console.log('[Bridge Config] Using bridge URL from localStorage:', s);
      return s;
    }
  }

  // Priority 3: Environment variable (baked at build time on client)
  const envUrl = process.env.NEXT_PUBLIC_BRIDGE_URL?.trim();
  if (envUrl) {
    return envUrl;
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
export function getBridgeUrl(endpoint: string): string {
  const base = getBridgeBaseUrl().replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${base}${path}`;

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`[Bridge Config] Bridge URL: ${fullUrl}`);
  }

  return fullUrl;
}
