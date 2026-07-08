'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { TRADING_RULES } from '@/config/trading-rules';
import { TradingModeManager } from '@/lib/trading-mode';
import { getAIProvider, setAIProvider, getAIProviderLabel, type AIProvider } from '@/lib/ai-settings';
import { useSubscription } from '@/hooks/useSubscription';
import { BillingPortalButton } from '@/components/BillingPortalButton';
import { SubscribeButton } from '@/components/SubscribeButton';
import { loadUserBridgeSettings, saveUserBridgeSettings } from '@/lib/firebase/user-bridge-settings';
import { grantMt5AccountAccess } from '@/lib/firebase/mt5-accounts';
import { BridgeDownloadButton } from '@/components/BridgeDownloadButton';
import { BridgeDesktopDownloadButton } from '@/components/BridgeDesktopDownloadButton';
import { MobileAlertsPanel } from '@/components/MobileAlertsPanel';
import { TelegramConnectPanel } from '@/components/TelegramConnectPanel';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  isAlertModeEnabled,
  setAlertModeEnabled,
  requestAlertModeEnable,
} from '@/lib/alert-mode-service';
import { BridgePairingPanel } from '@/components/BridgePairingPanel';
import { useBridgePresence } from '@/context/BridgeContext';
import { normalizeBridgeBaseUrl } from '@/config/bridge-config';
import {
  getAutoScanEnabled,
  setAutoScanEnabled,
  getScanIntervalMinutes,
  setScanIntervalMinutes,
  getNotificationsEnabled,
  setNotificationsEnabled,
  migrateScanSettingsToManual,
} from '@/lib/trading-settings';
import Link from 'next/link';

const HealthCheckDashboard = dynamic(
  () => import('@/components/HealthCheckDashboard').then((m) => ({ default: m.HealthCheckDashboard })),
  { ssr: false }
);
const IslamicTradingPanel = dynamic(
  () => import('@/components/IslamicTradingPanel').then((m) => ({ default: m.IslamicTradingPanel })),
  { ssr: false }
);
const ScalpingPanel = dynamic(
  () => import('@/components/ScalpingPanel').then((m) => ({ default: m.ScalpingPanel })),
  { ssr: false }
);

function SetupSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="bg-[#0d1321] rounded-xl border border-[#1e2738] group"
    >
      <summary className="cursor-pointer list-none p-6 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>{icon}</span> {title}
        </h3>
        <span className="text-gray-500 text-sm group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="px-6 pb-6 pt-0 border-t border-[#1e2738]">{children}</div>
    </details>
  );
}

export function Settings() {
  const [riskPercentage, setRiskPercentage] = useState<number>(TRADING_RULES.RISK_PERCENTAGE * 100);
  const [dailyLossPercent, setDailyLossPercent] = useState<number>(TRADING_RULES.DAILY_LOSS_PERCENT * 100);
  const [maxOpenTrades, setMaxOpenTrades] = useState<number>(TRADING_RULES.MAX_OPEN_TRADES);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState<number>(TRADING_RULES.MAX_TRADES_PER_DAY);
  const [minRewardRiskRatio, setMinRewardRiskRatio] = useState<number>(TRADING_RULES.MIN_REWARD_RISK_RATIO);
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(true);
  const [autoScanEnabled, setAutoScanEnabledState] = useState<boolean>(false);
  const [scanInterval, setScanIntervalState] = useState<number>(5);
  const [aiProvider, setAiProvider] = useState<AIProvider>('auto');
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [shareMemberUid, setShareMemberUid] = useState('');
  const [shareAccountId, setShareAccountId] = useState('');
  const [saved, setSaved] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bridgeUrlError, setBridgeUrlError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { active, status, currentPeriodEnd } = useSubscription();
  const push = usePushNotifications();
  const [alertMode, setAlertMode] = useState(false);
  const { state: homeBridgeState } = useBridgePresence();
  const bridgeNeedsSetup = homeBridgeState === 'unknown' || homeBridgeState === 'not_paired' || homeBridgeState === 'offline';

  useEffect(() => {
    migrateScanSettingsToManual();
    setAlertMode(isAlertModeEnabled());

    const savedRisk = localStorage.getItem('settings_risk_percentage');
    const savedDailyLoss = localStorage.getItem('settings_daily_loss');
    const savedMaxOpen = localStorage.getItem('settings_max_open_trades');
    const savedMaxPerDay = localStorage.getItem('settings_max_trades_per_day');
    const savedRewardRisk = localStorage.getItem('settings_reward_risk_ratio');

    if (savedRisk) setRiskPercentage(parseFloat(savedRisk));
    if (savedDailyLoss) setDailyLossPercent(parseFloat(savedDailyLoss));
    if (savedMaxOpen) setMaxOpenTrades(parseInt(savedMaxOpen, 10));
    if (savedMaxPerDay) setMaxTradesPerDay(parseInt(savedMaxPerDay, 10));
    if (savedRewardRisk) setMinRewardRiskRatio(parseFloat(savedRewardRisk));

    setNotificationsEnabledState(getNotificationsEnabled());
    setAutoScanEnabledState(getAutoScanEnabled());
    setScanIntervalState(getScanIntervalMinutes());
    setAiProvider(getAIProvider());

    loadUserBridgeSettings().then((s) => {
      if (s.bridgeUrl) {
        const normalized = normalizeBridgeBaseUrl(s.bridgeUrl);
        setBridgeUrl(normalized ?? '');
        if (!normalized && s.bridgeUrl.trim()) {
          setBridgeUrlError('Saved URL was invalid (use your Cloudflare/ngrok tunnel, not the dashboard site).');
        }
      }
    });
  }, []);

  const handleSave = async () => {
    setSaveError(null);
    setBridgeUrlError(null);

    const trimmedBridge = bridgeUrl.trim();
    let normalizedBridge: string | null = null;
    if (trimmedBridge) {
      normalizedBridge = normalizeBridgeBaseUrl(trimmedBridge);
      if (!normalizedBridge) {
        setBridgeUrlError(
          'Invalid tunnel URL. Use your home PC tunnel (e.g. https://xxx.trycloudflare.com), not tradeintelai.vercel.app.'
        );
        setSaveError('Bridge URL not saved — fix the tunnel URL and try again.');
        return;
      }
    }

    localStorage.setItem('settings_risk_percentage', riskPercentage.toString());
    localStorage.setItem('settings_daily_loss', dailyLossPercent.toString());
    localStorage.setItem('settings_max_open_trades', maxOpenTrades.toString());
    localStorage.setItem('settings_max_trades_per_day', maxTradesPerDay.toString());
    localStorage.setItem('settings_reward_risk_ratio', minRewardRiskRatio.toString());
    setNotificationsEnabled(notificationsEnabled);
    setAutoScanEnabled(autoScanEnabled);
    setScanIntervalMinutes(scanInterval);
    setAIProvider(aiProvider);

    await saveUserBridgeSettings({
      bridgeUrl: normalizedBridge,
      bridgeMode: 'direct',
      bridgeSetupComplete: Boolean(normalizedBridge),
    });

    if (normalizedBridge && typeof window !== 'undefined') {
      localStorage.setItem('bridge_url', normalizedBridge);
    }

    window.dispatchEvent(new CustomEvent('ai-provider-changed', { detail: aiProvider }));

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setRiskPercentage(TRADING_RULES.RISK_PERCENTAGE * 100);
    setDailyLossPercent(TRADING_RULES.DAILY_LOSS_PERCENT * 100);
    setMaxOpenTrades(TRADING_RULES.MAX_OPEN_TRADES);
    setMaxTradesPerDay(TRADING_RULES.MAX_TRADES_PER_DAY);
    setMinRewardRiskRatio(TRADING_RULES.MIN_REWARD_RISK_RATIO);
    setNotificationsEnabledState(true);
    setAutoScanEnabledState(false);
    setScanIntervalState(5);
    setAiProvider('auto');
    setSaveError(null);
    setBridgeUrlError(null);
  };

  const handleAlertModeToggle = (checked: boolean) => {
    if (checked) {
      if (!requestAlertModeEnable()) return;
      setAlertMode(true);
      window.location.reload();
      return;
    }
    setAlertModeEnabled(false);
    setAlertMode(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Setup</h2>
          <p className="text-gray-400 text-sm">Connect your bridge, set trading rules, and control when AI runs</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-[#1e2738] text-gray-300 rounded-lg hover:bg-[#2a3548] transition-all"
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              saved ? 'bg-emerald-500 text-white' : 'bg-cyan-500 text-white hover:bg-cyan-400'
            }`}
          >
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
          {saveError}
        </div>
      )}

      {bridgeNeedsSetup && (
        <div className="mb-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
          <h3 className="text-sm font-bold text-cyan-300 mb-2">Getting started</h3>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Install TradeIntel Bridge on your home PC (MT5 Desktop required)</li>
            <li>Open <strong>Connect bridge</strong> below and generate a pairing code</li>
            <li>
              On your home laptop run:{' '}
              <code className="bg-[#0d1321] px-1 rounded text-xs">npm run bridge:pair CODE [tunnel-url]</code>
            </li>
            <li>Go to the <strong>Scan</strong> tab and click <strong>Scan Now</strong> (manual — no auto AI calls)</li>
          </ol>
        </div>
      )}

      <div className="space-y-4">
        <SetupSection title="Connect bridge" icon="🔗" defaultOpen={bridgeNeedsSetup}>
          <div className="space-y-4 pt-4">
            <p className="text-xs text-gray-400">
              Requires MetaTrader 5 <strong className="text-gray-300">Desktop</strong> on your home PC.{' '}
              <Link href="/docs/client-platforms" className="text-cyan-400 hover:underline">
                Platform guide
              </Link>
            </p>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tunnel URL</label>
              <input
                type="url"
                value={bridgeUrl}
                onChange={(e) => {
                  setBridgeUrl(e.target.value);
                  setBridgeUrlError(null);
                }}
                placeholder="https://your-tunnel.trycloudflare.com"
                className={`w-full px-4 py-2 bg-[#141c2b] border rounded-lg text-white ${
                  bridgeUrlError ? 'border-rose-500/50' : 'border-[#1e2738]'
                }`}
              />
              {bridgeUrlError ? (
                <p className="text-xs text-rose-400 mt-1">{bridgeUrlError}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  Your Cloudflare or ngrok tunnel — not the Vercel dashboard URL. Saved to your account on Save.
                </p>
              )}
            </div>
            <BridgePairingPanel />
            <div className="border-t border-[#1e2738] pt-4">
              <label className="block text-sm text-gray-400 mb-2">Share account (Firebase UID)</label>
              <input
                type="text"
                value={shareMemberUid}
                onChange={(e) => setShareMemberUid(e.target.value)}
                placeholder="colleague Firebase UID"
                className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white mb-2"
              />
              <input
                type="text"
                value={shareAccountId}
                onChange={(e) => setShareAccountId(e.target.value)}
                placeholder="mt5Accounts document ID"
                className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white mb-2"
              />
              <button
                type="button"
                onClick={async () => {
                  if (shareAccountId && shareMemberUid) {
                    const ok = await grantMt5AccountAccess(shareAccountId, shareMemberUid, 'trader');
                    alert(ok ? 'Trader access granted' : 'Failed — check account ID and ownership');
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#1e2738] text-gray-300 hover:text-white text-sm"
              >
                Grant trader access
              </button>
            </div>
          </div>
        </SetupSection>

        <SetupSection title="Trading rules" icon="⚖️">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Risk per Trade (%)</label>
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={riskPercentage}
                  onChange={(e) => setRiskPercentage(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Daily Loss Limit (%)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  value={dailyLossPercent}
                  onChange={(e) => setDailyLossPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Minimum Reward:Risk Ratio</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.5"
                  value={minRewardRiskRatio}
                  onChange={(e) => setMinRewardRiskRatio(parseFloat(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Open Trades</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxOpenTrades}
                  onChange={(e) => setMaxOpenTrades(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Max Trades per Day</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxTradesPerDay}
                  onChange={(e) => setMaxTradesPerDay(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        </SetupSection>

        <SetupSection title="Scan & alerts" icon="🔔">
          <div className="space-y-4 pt-4">
            <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              Scans are <strong>manual by default</strong> to save AI credits. Enable auto-scan only if you accept ongoing OpenAI/Gemini usage.
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Browser Notifications</p>
                <p className="text-xs text-gray-500">Desktop notifications after a manual scan finds signals</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabledState(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#1e2738] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 relative" />
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Auto-Scan (opt-in)</p>
                <p className="text-xs text-gray-500">Automatically re-scan on an interval — uses AI credits</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScanEnabled}
                  onChange={(e) => setAutoScanEnabledState(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#1e2738] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 relative" />
              </label>
            </div>
            {autoScanEnabled && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Scan Interval (minutes)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={scanInterval}
                  onChange={(e) => setScanIntervalState(parseInt(e.target.value, 10) || 5)}
                  className="w-full max-w-xs px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-[#1e2738]">
              <div>
                <p className="text-sm text-white font-medium">Alert Mode</p>
                <p className="text-xs text-gray-500">Background scan every 5 min while dashboard is open — uses AI credits</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertMode}
                  onChange={(e) => handleAlertModeToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#1e2738] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500 relative" />
              </label>
            </div>
            <MobileAlertsPanel />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                {push.supported && !push.enabled ? (
                  <button
                    type="button"
                    onClick={() => void push.enable()}
                    disabled={push.loading}
                    className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm min-h-[44px]"
                  >
                    Enable push notifications
                  </button>
                ) : push.enabled ? (
                  <button type="button" onClick={push.disable} className="px-4 py-2 rounded-lg bg-[#1e2738] text-gray-300 text-sm">
                    Push enabled
                  </button>
                ) : null}
                {push.error ? <p className="text-xs text-rose-400 mt-1">{push.error}</p> : null}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Telegram</h4>
                <TelegramConnectPanel />
              </div>
            </div>
          </div>
        </SetupSection>

        <SetupSection title="AI provider" icon="🤖">
          <div className="pt-4 space-y-2">
            <label className="block text-sm text-gray-400 mb-2">Provider</label>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AIProvider)}
              className="w-full max-w-md px-4 py-2 bg-[#141c2b] border border-[#1e2738] rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="auto">Auto (recommended)</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            <p className="text-xs text-gray-500">
              Current: {getAIProviderLabel(aiProvider)}. Verify keys:{' '}
              <code className="bg-[#141c2b] px-1 rounded">npm run verify:gemini</code> /{' '}
              <code className="bg-[#141c2b] px-1 rounded">npm run verify:openai</code>
            </p>
          </div>
        </SetupSection>

        <SetupSection title="Subscription" icon="💳">
          <div className="space-y-3 text-sm pt-4">
            <p className="text-gray-300">
              Status:{' '}
              <span className={active ? 'text-emerald-400' : 'text-rose-400'}>
                {active ? 'Active' : status}
              </span>
            </p>
            {currentPeriodEnd && (
              <p className="text-gray-400">Renews: {new Date(currentPeriodEnd).toLocaleDateString()}</p>
            )}
            {active ? (
              <div className="flex flex-wrap gap-2">
                <BillingPortalButton />
                <BridgeDesktopDownloadButton />
                <BridgeDownloadButton label="ZIP bundle" className="px-4 py-2 rounded-lg bg-[#1e2738] text-gray-300 hover:text-white text-sm" />
                <Link href="/onboarding" className="px-4 py-2 rounded-lg bg-[#1e2738] text-gray-300 hover:text-white text-sm">
                  Setup guide
                </Link>
              </div>
            ) : (
              <SubscribeButton className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm" />
            )}
          </div>
        </SetupSection>

        <div className="rounded-xl border border-[#1e2738] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between text-left bg-[#0d1321] hover:bg-[#141c2b] transition-colors"
          >
            <span className="text-lg font-bold text-white">Advanced</span>
            <span className="text-gray-500 text-sm">{showAdvanced ? 'Hide' : 'Show'} Islamic, Scalping, System Health</span>
          </button>
          {showAdvanced && (
            <div className="space-y-4 p-4 border-t border-[#1e2738] bg-[#0a0f18]">
              <IslamicTradingPanel />
              <ScalpingPanel />
              <HealthCheckDashboard />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 p-4 bg-[#141c2b] border border-[#1e2738] rounded-xl">
        <p className="text-sm text-gray-400">
          Trading rules and scan preferences are saved in this browser. Tunnel URL and bridge pairing are saved to your account. Click <strong className="text-gray-300">Save Settings</strong> after changes.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
          <span>Mode: {TradingModeManager.isDemoMode() ? 'Demo' : 'Live'}</span>
          <span>Currency: {TradingModeManager.getCurrencySymbol()}</span>
          <span>Pairs: {TRADING_RULES.TRADING_PAIRS.length}</span>
          <span>Version: 1.0.0</span>
        </div>
      </div>
    </div>
  );
}
