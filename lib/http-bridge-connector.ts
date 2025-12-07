import { BRIDGE_CONFIG, getBridgeUrl, retryWithBackoff } from '@/config/bridge-config';
import { logger } from '@/lib/logger';

export class HTTPBridgeConnector {
  private baseUrl = BRIDGE_CONFIG.baseUrl;
  private connected = false;

  async connect(): Promise<boolean> {
    try {
      // Use AbortController for timeout - shorter timeout for health check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout for health
      
      const response = await fetch(getBridgeUrl('/health'), {
        signal: controller.signal
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

  async getAccountInfo(): Promise<any> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.account);
      
      try {
        const response = await fetch(getBridgeUrl('/account'), {
          signal: controller.signal
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
      maxAttempts: 2, // Only retry once for account info
      onRetry: (attempt, error) => {
        logger.warn(`⏱️ Account info request failed (attempt ${attempt}), retrying...`, error.message);
      }
    }).catch((error: any) => {
      logger.error('⚠️ Error getting account info:', error.message);
      return {
        success: false,
        error: 'Failed to get account info - bridge may not be running'
      };
    });
  }

  async getMarketData(symbol: string): Promise<any> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.price);
      
      try {
        const response = await fetch(getBridgeUrl(`/price/${symbol}`), {
          signal: controller.signal
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
        const response = await fetch(getBridgeUrl('/trade'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: trade.symbol,
            action: trade.type,
            volume: trade.volume,
            sl: trade.stopLoss,
            tp: trade.takeProfit
          }),
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
      maxDelay: 2000,
      onRetry: (attempt, error) => {
        logger.warn(`⏱️ Trade execution failed (attempt ${attempt}/3), retrying...`, error.message);
      }
    }).catch((error: any) => {
      logger.error('Error executing trade after retries:', error);
      
      // ENHANCED: Use GPT-5.1 to enhance error message
      if (typeof window !== 'undefined') {
        import('./openai-error-enhancer').then(({ enhanceErrorMessage }) => {
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
        error: error.message || 'Trade execution failed after retries',
        details: error.toString(),
      };
    });
  }

  async getPositions(): Promise<any> {
    return retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BRIDGE_CONFIG.timeouts.positions);
      
      try {
        const response = await fetch(getBridgeUrl('/positions'), {
          signal: controller.signal
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
