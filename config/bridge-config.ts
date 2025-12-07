/**
 * Bridge Configuration
 * Centralized configuration for MT5 bridge connection
 */

export const BRIDGE_CONFIG = {
  // Bridge URL - can be overridden by environment variable
  baseUrl: process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:8080',
  
  // Timeouts (in milliseconds)
  timeouts: {
    health: 2000,      // Health check timeout
    account: 10000,    // Account info timeout
    positions: 25000,  // Positions timeout (EA needs more time)
    trade: 15000,      // Trade execution timeout
    price: 5000,       // Price fetch timeout
  },
  
  // Retry configuration
  retry: {
    maxAttempts: 3,
    delay: 1000,       // Initial delay in ms
    backoff: 2,        // Exponential backoff multiplier
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

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoff; // Exponential backoff
      }
    }
  }

  throw lastError!;
}

/**
 * Get the full URL for a bridge endpoint
 */
export function getBridgeUrl(endpoint: string): string {
  const base = BRIDGE_CONFIG.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

