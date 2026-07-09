import {
  BRIDGE_CONFIG,
  formatBridgeNetworkError,
  getBridgeUrl,
  retryWithBackoff,
} from '@/config/bridge-config';
import { getCachedBridgeApiToken } from '@/lib/bridge-watch-client';
import { logger } from '@/lib/logger';
import { accountManager } from '@/lib/account-manager';

function resolveAccountLogin(override?: number): number | undefined {
  if (override !== undefined) return override;
  if (typeof window === 'undefined') return undefined;
  return accountManager.getActiveAccount()?.login;
}

function tradeBody(
  trade: {
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    stopLoss?: number;
    takeProfit?: number;
    accountLogin?: number;
  }
) {
  const login = resolveAccountLogin(trade.accountLogin);
  return {
    symbol: trade.symbol,
    action: trade.type,
    volume: trade.volume,
    sl: trade.stopLoss,
    tp: trade.takeProfit,
    ...(login ? { account_login: login } : {}),
  };
}

export class HTTPBridgeConnector {
  private connected = false;

  /**
   * Get default headers for bridge requests
   * Includes ngrok-skip-browser-warning for ngrok free tier
   */
  private getDefaultHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'ngrok-skip-browser-warning': 'true',
    };
    const token = getCachedBridgeApiToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async connect(): Promise<boolean> {
    try {
      // Use AbortController for timeout - shorter timeout for health check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout for health
      
      const response = await fetch(getBridgeUrl('/health?quick=1'), {
        signal: controller.signal,
        headers: this.getDefaultHeaders(),
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        this.connected = false;
        return false;
      }
      
      const data = await response.json();
      this.connected = data.status === 'running';
      
      if (this.connected) {
        logger.logConnection('connected');
      }
      
      return this.connected;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn('⏱️ HTTP Bridge connection timeout (bridge may be starting up)');
      } else {
        logger.warn('⚠️ HTTP Bridge not available:', error.message);
      }
      this.connected = false;
      return false;
    }
  }

  async getAccountInfo(accountLogin?: number): Promise<any> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.account);
      
      try {
        const login = resolveAccountLogin(accountLogin);
        const accountUrl = getBridgeUrl('/account', login);
        console.log(`🌐 [HTTPBridge] Fetching account from: ${accountUrl}`);
        console.log(`🌐 [HTTPBridge] Base URL from config: ${BRIDGE_CONFIG.baseUrl}`);
        
        const response = await fetch(accountUrl, {
          signal: controller.signal,
          headers: {
            ...this.getDefaultHeaders(),
            // Note: Cache-Control header removed to avoid CORS issues
            // Using cache: 'no-cache' option instead
          },
          cache: 'no-cache', // Prevent browser caching (doesn't require header)
        });
        clearTimeout(timeoutId);
        
        console.log(`📡 [HTTPBridge] Response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        logger.debug('📥 Account info response:', data);
        return data;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - bridge may be slow or ngrok tunnel may be down');
        }
        throw error;
      }
    }, {
      maxAttempts: 3, // Retry up to 3 times for account info
      onRetry: (attempt, error) => {
        logger.warn(`⏱️ Account info request failed (attempt ${attempt}), retrying...`, error.message);
      }
    }).catch((error: any) => {
      const bridgeUrl = getBridgeUrl('/account');
      logger.error('⚠️ Error getting account info:', error.message);
      logger.error(`💡 Bridge URL being used: ${bridgeUrl}`);
      logger.error('💡 Check: 1) Bridge is running (port 8080), 2) ngrok tunnel is active, 3) EA is attached to chart');
      logger.error('💡 If using ngrok, verify tunnel is active: curl http://localhost:4040/api/tunnels');
      return {
        success: false,
        error: `Failed to get account info: ${error.message}`,
        bridgeUrl: bridgeUrl, // Include URL in response for debugging
      };
    });
  }

  async getMarketData(symbol: string, accountLogin?: number): Promise<any> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.price);
      
      try {
        const login = resolveAccountLogin(accountLogin);
        const response = await fetch(getBridgeUrl(`/price/${symbol}`, login), {
          signal: controller.signal,
          headers: this.getDefaultHeaders(),
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    }, {
      maxAttempts: 2,
      onRetry: (attempt) => {
        logger.debug(`Retrying market data fetch for ${symbol} (attempt ${attempt})`);
      }
    }).catch((error) => {
      logger.error('Error getting market data:', error);
      return {
        success: false,
        error: 'Failed to get market data'
      };
    });
  }

  /**
   * Close a position by ticket ID
   */
  async closePosition(ticket: number | string, accountLogin?: number): Promise<any> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.trade || 10000);
      
      try {
        const login = resolveAccountLogin(accountLogin);
        const response = await fetch(getBridgeUrl(`/close-position/${ticket}`, login), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getDefaultHeaders(),
          },
          body: JSON.stringify(login ? { account_login: login } : {}),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        return result;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Close position timeout');
        }
        throw error;
      }
    }, {
      maxAttempts: 2,
      onRetry: (attempt) => {
        logger.debug(`Retrying close position ${ticket} (attempt ${attempt})`);
      }
    }).catch((error) => {
      logger.error(`Error closing position ${ticket}:`, error);
      return {
        success: false,
        error: `Failed to close position: ${error.message}`
      };
    });
  }

  async executeTrade(trade: {
    symbol: string;
    type: 'BUY' | 'SELL';
    volume: number;
    stopLoss?: number;
    takeProfit?: number;
    accountLogin?: number; // For multi-account routing
  }): Promise<any> {
    // ENHANCED: Retry logic for trade execution
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.trade || 10000);
      
      try {
        const login = resolveAccountLogin(trade.accountLogin);
        const response = await fetch(getBridgeUrl('/trade', login), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.getDefaultHeaders(),
          },
          body: JSON.stringify(tradeBody(trade)),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        // ENHANCED: Validate response structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response format from bridge');
        }
        
        return result;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Trade execution timeout - bridge may be busy');
        }
        throw error;
      }
    }, {
      maxAttempts: 3, // Retry up to 3 times
      initialDelay: 500,
      onRetry: (attempt, error) => {
        logger.warn(`⏱️ Trade execution failed (attempt ${attempt}/3), retrying...`, error.message);
      }
    }).catch((error: any) => {
      logger.error('Error executing trade after retries:', error);
      
      // ENHANCED: Use GPT-5.1 to enhance error message
      if (typeof window !== 'undefined') {
        import('./ai-error-enhancer').then(({ enhanceErrorMessage }) => {
          enhanceErrorMessage(error, {
            action: 'executeTrade',
            component: 'HTTPBridgeConnector',
            userAction: `Executing ${trade.type} trade for ${trade.symbol}`,
          }).then((enhanced) => {
            logger.error('Enhanced error:', enhanced);
          });
        }).catch(() => {
          // Ignore if enhancement fails
        });
      }
      
      return {
        success: false,
        error: formatBridgeNetworkError(error) || 'Trade execution failed after retries',
        details: error.toString(),
      };
    });
  }

  async getPositions(accountLogin?: number): Promise<any> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.positions);
      
      try {
        const login = resolveAccountLogin(accountLogin);
        const response = await fetch(getBridgeUrl('/positions', login), {
          signal: controller.signal,
          headers: this.getDefaultHeaders(),
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    }, {
      maxAttempts: 2,
      onRetry: (attempt, error) => {
        logger.warn(`⏱️ Positions request failed (attempt ${attempt}), retrying...`, error.message);
      }
    }).catch((error: any) => {
      if (error.name === 'AbortError') {
        logger.warn('⏱️ Positions request timeout');
      } else {
        logger.warn('⚠️ Error getting positions:', error.message);
      }
      return {
        success: false,
        error: 'Failed to get positions - bridge may not be running',
        positions: []
      };
    });
  }
}

export const httpBridge = new HTTPBridgeConnector();
