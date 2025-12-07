'use client';

import { useState, useEffect } from 'react';
import { TRADING_RULES } from '@/config/trading-rules';
import { TradingModeManager } from '@/lib/trading-mode';

export function Settings() {
  const [riskPercentage, setRiskPercentage] = useState<number>(TRADING_RULES.RISK_PERCENTAGE * 100);
  const [dailyLossPercent, setDailyLossPercent] = useState<number>(TRADING_RULES.DAILY_LOSS_PERCENT * 100);
  const [maxOpenTrades, setMaxOpenTrades] = useState<number>(TRADING_RULES.MAX_OPEN_TRADES);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(TRADING_RULES.MAX_TRADES_PER_DAY);
  const [minRewardRiskRatio, setMinRewardRiskRatio] = useState<number>(TRADING_RULES.MIN_REWARD_RISK_RATIO);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(true);
  const [scanInterval, setScanInterval] = useState<number>(5);
  const [saved, setSaved] = useState<boolean>(false);

  useEffect(() => {
    // Load saved settings from localStorage
    const savedRisk = localStorage.getItem('settings_risk_percentage');
    const savedDailyLoss = localStorage.getItem('settings_daily_loss');
    const savedMaxOpen = localStorage.getItem('settings_max_open_trades');
    const savedMaxPerDay = localStorage.getItem('settings_max_trades_per_day');
    const savedRewardRisk = localStorage.getItem('settings_reward_risk_ratio');
    const savedNotifications = localStorage.getItem('settings_notifications');
    const savedAutoScan = localStorage.getItem('settings_auto_scan');
    const savedScanInterval = localStorage.getItem('settings_scan_interval');

    if (savedRisk) setRiskPercentage(parseFloat(savedRisk));
    if (savedDailyLoss) setDailyLossPercent(parseFloat(savedDailyLoss));
    if (savedMaxOpen) setMaxOpenTrades(parseInt(savedMaxOpen));
    if (savedMaxPerDay) setMaxTradesPerDay(parseInt(savedMaxPerDay));
    if (savedRewardRisk) setMinRewardRiskRatio(parseFloat(savedRewardRisk));
    if (savedNotifications) setNotificationsEnabled(savedNotifications === 'true');
    if (savedAutoScan) setAutoScanEnabled(savedAutoScan === 'true');
    if (savedScanInterval) setScanInterval(parseInt(savedScanInterval));
  }, []);

  const handleSave = () => {
    // Save to localStorage (in a real app, these would update the config)
    localStorage.setItem('settings_risk_percentage', riskPercentage.toString());
    localStorage.setItem('settings_daily_loss', dailyLossPercent.toString());
    localStorage.setItem('settings_max_open_trades', maxOpenTrades.toString());
    localStorage.setItem('settings_max_trades_per_day', maxTradesPerDay.toString());
    localStorage.setItem('settings_reward_risk_ratio', minRewardRiskRatio.toString());
    localStorage.setItem('settings_notifications', notificationsEnabled.toString());
    localStorage.setItem('settings_auto_scan', autoScanEnabled.toString());
    localStorage.setItem('settings_scan_interval', scanInterval.toString());

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setRiskPercentage(TRADING_RULES.RISK_PERCENTAGE * 100);
    setDailyLossPercent(TRADING_RULES.DAILY_LOSS_PERCENT * 100);
    setMaxOpenTrades(TRADING_RULES.MAX_OPEN_TRADES);
    setMaxTradesPerDay(TRADING_RULES.MAX_TRADES_PER_DAY);
    setMinRewardRiskRatio(TRADING_RULES.MIN_REWARD_RISK_RATIO);
    setNotificationsEnabled(true);
    setAutoScanEnabled(true);
    setScanInterval(5);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Settings</h2>
          <p className="text-gray-400 text-sm">Configure trading rules and preferences</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-[#1e2738] text-gray-300 rounded-lg hover:bg-[#2a3548] transition-all"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-cyan-500 text-white hover:bg-cyan-400'
            }`}
          >
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Management */}
        <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>⚖️</span> Risk Management
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Risk per Trade (%)
              </label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={riskPercentage}
                onChange={(e) => setRiskPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: {riskPercentage}% (Default: {TRADING_RULES.RISK_PERCENTAGE * 100}%)
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Daily Loss Limit (%)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                step="0.5"
                value={dailyLossPercent}
                onChange={(e) => setDailyLossPercent(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: {dailyLossPercent}% (Default: {TRADING_RULES.DAILY_LOSS_PERCENT * 100}%)
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Minimum Reward:Risk Ratio
              </label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.5"
                value={minRewardRiskRatio}
                onChange={(e) => setMinRewardRiskRatio(parseFloat(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: 1:{minRewardRiskRatio} (Default: 1:{TRADING_RULES.MIN_REWARD_RISK_RATIO})
              </p>
            </div>
          </div>
        </div>

        {/* Position Limits */}
        <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>📊</span> Position Limits
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Max Open Trades
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={maxOpenTrades}
                onChange={(e) => setMaxOpenTrades(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: {maxOpenTrades} (Default: {TRADING_RULES.MAX_OPEN_TRADES})
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Max Trades per Day
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxTradesPerDay}
                onChange={(e) => setMaxTradesPerDay(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: {maxTradesPerDay} (Default: {TRADING_RULES.MAX_TRADES_PER_DAY})
              </p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🔔</span> Notifications
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Browser Notifications</p>
                <p className="text-xs text-gray-500">Desktop notifications for strong signals</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#1e2738] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Auto-Scan Opportunities</p>
                <p className="text-xs text-gray-500">Automatically scan for trading opportunities</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScanEnabled}
                  onChange={(e) => setAutoScanEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#1e2738] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {autoScanEnabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Scan Interval (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={scanInterval}
                  onChange={(e) => setScanInterval(parseInt(e.target.value) || 5)}
                  className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>ℹ️</span> System Information
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
              <span className="text-gray-400">Trading Mode</span>
              <span className="text-white font-medium">
                {TradingModeManager.isDemoMode() ? 'Demo' : 'Live'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
              <span className="text-gray-400">Currency</span>
              <span className="text-white font-medium">
                {TradingModeManager.getCurrencySymbol()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[#1e2738]">
              <span className="text-gray-400">Trading Pairs</span>
              <span className="text-white font-medium">
                {TRADING_RULES.TRADING_PAIRS.length}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Version</span>
              <span className="text-white font-medium">1.0.0</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <p className="text-sm text-amber-400">
          ⚠️ <strong>Note:</strong> These settings are stored locally in your browser. To permanently change trading rules, update <code className="bg-[#0d1321] px-2 py-1 rounded">config/trading-rules.ts</code>
        </p>
      </div>
    </div>
  );
}

