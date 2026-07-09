'use client';

import { TradingModeManager, type Mt5AccountKind } from '@/lib/trading-mode';
import { syncAccountFromBridge } from '@/lib/bridge-account-sync';
import { TradingMode, Trade } from '@/types/trading';
import { useState, useEffect } from 'react';
import { assertCanGoLiveMode } from '@/lib/trade-permissions';
import { TRADING_RULES } from '@/config/trading-rules';

interface TradingModeSwitchProps {
  trades?: Trade[];
  initialBalance?: number;
  currentBalance?: number;
}

function mt5Label(kind: Mt5AccountKind): string {
  if (kind === 'demo') return 'MT5: Demo';
  if (kind === 'live') return 'MT5: Live';
  return 'MT5: type unknown';
}

export function TradingModeSwitch({
  trades = [],
  initialBalance = TRADING_RULES.DEMO_BALANCE,
  currentBalance,
}: TradingModeSwitchProps) {
  const [currentMode, setCurrentMode] = useState<TradingMode>(TradingModeManager.getCurrentMode());
  const [mt5Kind, setMt5Kind] = useState<Mt5AccountKind>(TradingModeManager.getMt5AccountKind());
  const [showConfirm, setShowConfirm] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const isDemo = currentMode === 'demo';

  useEffect(() => {
    const sync = () => {
      setCurrentMode(TradingModeManager.getCurrentMode());
      setMt5Kind(TradingModeManager.getMt5AccountKind());
    };
    void syncAccountFromBridge().then(sync);
    const interval = setInterval(sync, 2000);
    sync();

    const handleModeChange = () => sync();
    window.addEventListener('tradingModeChanged', handleModeChange);
    window.addEventListener('mt5AccountChanged', handleModeChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tradingModeChanged', handleModeChange);
      window.removeEventListener('mt5AccountChanged', handleModeChange);
    };
  }, []);

  const applyLiveMode = async (override = false) => {
    if (override) {
      await assertCanGoLiveMode(
        trades,
        initialBalance,
        currentBalance ?? TradingModeManager.getCurrentBalance(),
        { allowOverride: true }
      );
      console.warn('⚠️ Live mode enabled with demo gate override');
    }
    TradingModeManager.setModeWithOverride('live');
    setCurrentMode('live');
    setShowConfirm(false);
    setGateMessage(null);
    window.dispatchEvent(
      new CustomEvent('tradingModeChanged', { detail: { mode: 'live' } })
    );
  };

  const toggleMode = async () => {
    if (!isDemo) {
      TradingModeManager.setModeWithOverride('demo');
      setCurrentMode('demo');
      setGateMessage(null);
      window.dispatchEvent(
        new CustomEvent('tradingModeChanged', { detail: { mode: 'demo' } })
      );
      return;
    }

    const balance = currentBalance ?? TradingModeManager.getCurrentBalance();
    const readiness = await assertCanGoLiveMode(trades, initialBalance, balance);

    if (readiness.ready) {
      await applyLiveMode();
      return;
    }

    setGateMessage(readiness.failures.join(' · '));
    setShowConfirm(true);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span
          className="hidden lg:inline text-[10px] text-gray-500 px-2 py-1 rounded bg-[#141c2b] border border-[#1e2738]"
          title="Connected MetaTrader account type (demo/live from bridge). Not the same as bridge connectivity or account selection."
        >
          {mt5Label(mt5Kind)}
        </span>
        <div
          className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold ${
            isDemo
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}
          title="App mode: metrics, demo goals, and go-live checklist. Orders always go to your connected MT5 account."
        >
          <span
            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
              isDemo ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span className="hidden sm:inline">App: {isDemo ? 'DEMO' : 'LIVE'}</span>
          <span className="sm:hidden">{isDemo ? 'D' : 'L'}</span>
        </div>
        <button
          onClick={toggleMode}
          className="hidden md:block text-xs px-3 py-1.5 rounded-lg font-medium bg-[#1e2738] text-gray-400 hover:text-white hover:bg-[#2a3548] transition-all"
          title={
            isDemo
              ? 'Switch app to live mode (demo criteria required)'
              : 'Switch app back to demo mode'
          }
        >
          {isDemo ? 'Go Live' : 'Demo'}
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card max-w-md w-full border-amber-500/40">
            <h3 className="text-lg font-bold text-amber-400 mb-2">Demo goals not met</h3>
            <p className="text-sm text-gray-400 mb-3">
              Complete demo validation before switching app mode to live. Current gaps:
            </p>
            <ul className="text-sm text-red-300/90 mb-4 list-disc pl-5 space-y-1">
              {(gateMessage || 'Unknown').split(' · ').map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mb-4">
              Review PRODUCTION_READINESS.md in the project before going live. App mode
              does not change which MT5 account receives orders ({mt5Label(mt5Kind)}).
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setShowConfirm(false)}
              >
                Stay on demo
              </button>
              <button
                type="button"
                className="btn text-sm bg-red-600/80 hover:bg-red-600"
                onClick={() => void applyLiveMode(true)}
              >
                Override (I accept risk)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
