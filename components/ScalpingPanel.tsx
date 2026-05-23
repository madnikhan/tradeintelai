'use client';

import { useState, useEffect } from 'react';
import { ScalpingService, ScalpingConfig } from '@/lib/scalping-service';

export function ScalpingPanel() {
  const [config, setConfig] = useState<ScalpingConfig>({
    enabled: false,
    takeProfitAmount: 0.50,
    minSignalStrength: 75,
    maxScalpsPerDay: 20,
    reEntryDelay: 5,
    maxReEntries: 5,
    minReEntrySignalStrength: 70,
  });
  const [stats, setStats] = useState({
    activeScalps: 0,
    scalpsToday: 0,
    maxScalpsPerDay: 20,
    totalProfit: 0,
  });

  useEffect(() => {
    // Load config
    const saved = localStorage.getItem('scalping_config');
    if (saved) {
      try {
        const savedConfig = JSON.parse(saved);
        setConfig(savedConfig);
        ScalpingService.initialize(savedConfig);
      } catch (e) {
        console.error('Failed to load scalping config');
      }
    } else {
      ScalpingService.initialize();
    }

    // Update stats periodically
    const interval = setInterval(() => {
      const newStats = ScalpingService.getStatistics();
      setStats(newStats);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (updates: Partial<ScalpingConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    ScalpingService.updateConfig(updates);
  };

  return (
    <div className="bg-[#141c2b] border border-[#1e2738] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">⚡ Scalping Mode</h3>
          <p className="text-sm text-gray-400">Auto-trade with small take profit targets ($0.50+)</p>
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
            {/* Take Profit Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Take Profit Target ($)
              </label>
              <input
                type="number"
                min="0.10"
                max="10"
                step="0.10"
                value={config.takeProfitAmount}
                onChange={(e) => handleConfigChange({ takeProfitAmount: parseFloat(e.target.value) || 0.50 })}
                className="w-full px-4 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Target profit per trade (e.g., $0.50 = 50 cents)
              </p>
            </div>

            {/* Minimum Signal Strength */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Signal Strength (%)
              </label>
              <input
                type="number"
                min="60"
                max="100"
                step="1"
                value={config.minSignalStrength}
                onChange={(e) => handleConfigChange({ minSignalStrength: parseInt(e.target.value) || 75 })}
                className="w-full px-4 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Only scalp when confidence ≥ {config.minSignalStrength}%
              </p>
            </div>

            {/* Max Scalps Per Day */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Scalps Per Day
              </label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={config.maxScalpsPerDay}
                onChange={(e) => handleConfigChange({ maxScalpsPerDay: parseInt(e.target.value) || 20 })}
                className="w-full px-4 py-2 bg-[#0d1321] border border-[#1e2738] rounded-lg text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum scalping trades per day
              </p>
            </div>

            {/* Re-Entry Settings */}
            <div className="p-4 bg-[#0d1321] rounded-lg border border-[#1e2738]">
              <h4 className="text-sm font-medium text-white mb-3">Re-Entry Settings</h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Re-Entry Delay (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={config.reEntryDelay}
                    onChange={(e) => handleConfigChange({ reEntryDelay: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-1.5 bg-[#141c2b] border border-[#1e2738] rounded text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Max Re-Entries
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    step="1"
                    value={config.maxReEntries}
                    onChange={(e) => handleConfigChange({ maxReEntries: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-1.5 bg-[#141c2b] border border-[#1e2738] rounded text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Min Re-Entry Signal (%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    step="1"
                    value={config.minReEntrySignalStrength}
                    onChange={(e) => handleConfigChange({ minReEntrySignalStrength: parseInt(e.target.value) || 70 })}
                    className="w-full px-3 py-1.5 bg-[#141c2b] border border-[#1e2738] rounded text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#1e2738]">
              <div className="bg-[#0d1321] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 mb-0.5">Active Scalps</p>
                <p className="text-lg font-bold text-white font-mono">
                  {stats.activeScalps}
                </p>
              </div>
              <div className="bg-[#0d1321] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 mb-0.5">Scalps Today</p>
                <p className="text-lg font-bold text-white font-mono">
                  {stats.scalpsToday} <span className="text-gray-500 text-sm">/ {stats.maxScalpsPerDay}</span>
                </p>
              </div>
              <div className="bg-[#0d1321] rounded-lg p-3 col-span-2">
                <p className="text-[10px] text-gray-500 mb-0.5">Total Profit Today</p>
                <p className={`text-lg font-bold font-mono ${
                  stats.totalProfit > 0 ? 'text-green-400' : 
                  stats.totalProfit < 0 ? 'text-red-400' : 'text-white'
                }`}>
                  ${stats.totalProfit.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="p-3 bg-[#0d1321] rounded-lg border border-[#1e2738] mt-4">
              <p className="text-xs text-gray-400 mb-2">⚡ Status</p>
              <p className="text-sm text-cyan-400">
                {stats.scalpsToday >= config.maxScalpsPerDay 
                  ? `⚠️ Daily limit reached (${stats.scalpsToday}/${config.maxScalpsPerDay})`
                  : `✅ Ready - Waiting for signal ≥ ${config.minSignalStrength}%`
                }
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Scalping triggers automatically when you run AI analysis and signal strength meets requirements
              </p>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm font-medium text-blue-400 mb-2">💡 How Scalping Works</p>
              <ul className="text-xs text-blue-300 space-y-1 list-disc list-inside">
                <li>Automatically executes trades when signal strength ≥ {config.minSignalStrength}%</li>
                <li>Takes profit at ${config.takeProfitAmount} per trade</li>
                <li>Re-analyzes market after each profit</li>
                <li>Re-enters if signal is still strong (≥{config.minReEntrySignalStrength}%)</li>
                <li>Stops after {config.maxReEntries} re-entries or when signal weakens</li>
              </ul>
            </div>

            {/* Warning */}
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm font-medium text-yellow-400 mb-2">⚠️ Important Notes</p>
              <ul className="text-xs text-yellow-300 space-y-1 list-disc list-inside">
                <li>Scalping uses 50% of normal position size for lower risk</li>
                <li>Many small profits can compound, but also many small losses</li>
                <li>Requires strong signals - will not trade on weak signals</li>
                <li>Monitor your account balance and adjust take profit amount accordingly</li>
                <li>Higher frequency trading = more commission costs</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
