'use client';

import { useState, useEffect } from 'react';
import { IslamicTradingService, IslamicTradingConfig } from '@/lib/islamic-trading-service';

export function IslamicTradingPanel() {
  const [config, setConfig] = useState<IslamicTradingConfig>({
    enabled: false,
    swapTimeGMT: 0,
    closeBeforeHours: 2,
    autoCloseEnabled: false,
    warnBeforeHours: 3,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [timeUntilClose, setTimeUntilClose] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    willCloseToday: boolean;
  } | null>(null);
  const [lastCloseResult, setLastCloseResult] = useState<{
    closedCount: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    // Load config
    const saved = localStorage.getItem('islamic_trading_config');
    if (saved) {
      try {
        const savedConfig = JSON.parse(saved);
        setConfig(savedConfig);
        IslamicTradingService.initialize(savedConfig);
      } catch (e) {
        console.error('Failed to load Islamic trading config');
      }
    } else {
      IslamicTradingService.initialize();
    }

    // Update time until close every second
    const interval = setInterval(() => {
      const time = IslamicTradingService.getTimeUntilClose();
      setTimeUntilClose(time);
    }, 1000);

    // Listen for close events
    const handleClose = (event: CustomEvent) => {
      setLastCloseResult({
        closedCount: event.detail.closedCount,
        errors: event.detail.errors || [],
      });
    };

    const handleWarning = (event: CustomEvent) => {
      // Show notification
      if (typeof window !== 'undefined' && (window as any).addErrorNotification) {
        (window as any).addErrorNotification({
          type: 'warning',
          title: '🕌 Islamic Trading Warning',
          message: event.detail.message,
        });
      }
    };

    window.addEventListener('islamic-trading-closed', handleClose as EventListener);
    window.addEventListener('islamic-trading-warning', handleWarning as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('islamic-trading-closed', handleClose as EventListener);
      window.removeEventListener('islamic-trading-warning', handleWarning as EventListener);
    };
  }, []);

  const handleConfigChange = (updates: Partial<IslamicTradingConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    IslamicTradingService.updateConfig(updates);
  };

  const handleManualClose = async () => {
    setIsLoading(true);
    try {
      const result = await IslamicTradingService.manualCloseAll();
      setLastCloseResult({
        closedCount: result.closedCount,
        errors: result.errors,
      });
      
      if (result.success) {
        alert(`✅ Successfully closed ${result.closedCount} position(s)`);
      } else {
        alert(`⚠️ Closed ${result.closedCount} position(s) with ${result.errors.length} error(s)`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#141c2b] border border-[#1e2738] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">🕌 Islamic Trading (Swap-Free)</h3>
          <p className="text-sm text-gray-400">Auto-close positions before swap time to avoid haram interest</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => handleConfigChange({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      {config.enabled && (
        <>
          <div className="space-y-4 mt-6">
            {/* Swap Time Configuration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Swap Time (GMT)
              </label>
              <select
                value={config.swapTimeGMT}
                onChange={(e) => handleConfigChange({ swapTimeGMT: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, '0')}:00 GMT
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                When your broker charges swap (usually 00:00 GMT = midnight)
              </p>
            </div>

            {/* Close Before Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Close Positions Before (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={config.closeBeforeHours}
                onChange={(e) => handleConfigChange({ closeBeforeHours: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Positions will close {config.closeBeforeHours} hour(s) before swap time
              </p>
            </div>

            {/* Auto-Close Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#0d1321] rounded-lg border border-[#1e2738]">
              <div>
                <label className="text-sm font-medium text-white">Auto-Close Enabled</label>
                <p className="text-xs text-gray-400">Automatically close all positions before swap time</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoCloseEnabled}
                  onChange={(e) => handleConfigChange({ autoCloseEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Time Until Close */}
            {timeUntilClose && config.autoCloseEnabled && (
              <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-500/20">
                <p className="text-sm text-gray-300 mb-2">⏰ Time Until Auto-Close</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {String(timeUntilClose.hours).padStart(2, '0')}:
                  {String(timeUntilClose.minutes).padStart(2, '0')}:
                  {String(timeUntilClose.seconds).padStart(2, '0')}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  All positions will close automatically at {String((config.swapTimeGMT - config.closeBeforeHours + 24) % 24).padStart(2, '0')}:00 GMT
                </p>
              </div>
            )}

            {/* Manual Close Button */}
            <button
              onClick={handleManualClose}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Closing Positions...' : '🕌 Close All Positions Now'}
            </button>

            {/* Last Close Result */}
            {lastCloseResult && (
              <div className={`p-4 rounded-lg border ${
                lastCloseResult.errors.length === 0
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-yellow-500/10 border-yellow-500/20'
              }`}>
                <p className="text-sm font-medium text-white">
                  Last Close: {lastCloseResult.closedCount} position(s) closed
                </p>
                {lastCloseResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-yellow-400">Errors:</p>
                    <ul className="text-xs text-yellow-300 list-disc list-inside">
                      {lastCloseResult.errors.slice(0, 3).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Important Notes */}
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm font-medium text-yellow-400 mb-2">⚠️ Important Notes</p>
              <ul className="text-xs text-yellow-300 space-y-1 list-disc list-inside">
                <li>Positions will close at market price (current price)</li>
                <li>This may result in profit or loss depending on market conditions</li>
                <li>Wednesday has triple swap - be extra careful</li>
                <li>Close all positions before Friday 20:00 GMT to avoid weekend gap risk</li>
                <li>Consider using an Islamic/Swap-Free account from your broker</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

