import { useState, useEffect, useCallback } from 'react';
import { httpBridge } from './http-bridge-connector';

interface PriceData {
  bid: number;
  ask: number;
  price: number;
  timestamp: Date;
  success: boolean;
}

export function useRealtimePrice(symbol: string, enabled: boolean = true, interval: number = 3000) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    if (!enabled || !symbol) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await httpBridge.getMarketData(symbol);
      
      if (data.success) {
        setPriceData({
          bid: data.bid || data.price || 0,
          ask: data.ask || data.price || 0,
          price: data.price || (data.bid && data.ask ? (data.bid + data.ask) / 2 : 0),
          timestamp: new Date(),
          success: true,
        });
      } else {
        setError(data.error || 'Failed to fetch price');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, enabled]);

  useEffect(() => {
    if (!enabled || !symbol) return;

    // Fetch immediately
    fetchPrice();

    // Set up polling interval
    const intervalId = setInterval(fetchPrice, interval);

    return () => clearInterval(intervalId);
  }, [fetchPrice, interval, enabled, symbol]);

  return { priceData, isLoading, error, refresh: fetchPrice };
}

