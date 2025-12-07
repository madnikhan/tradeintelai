'use client';

import { TradingModeManager } from '@/lib/trading-mode';
import { TradingMode } from '@/types/trading';
import { useState, useEffect } from 'react';

export function TradingModeSwitch() {
  const [currentMode, setCurrentMode] = useState<TradingMode>(TradingModeManager.getCurrentMode());
  const isDemo = currentMode === 'demo';

  // Update mode when TradingModeManager changes (e.g., from MT5 account detection)
  useEffect(() => {
    const checkMode = () => {
      const mode = TradingModeManager.getCurrentMode();
      if (mode !== currentMode) {
        setCurrentMode(mode);
      }
    };
    
    // Check mode periodically (in case it's updated by account detection)
    const interval = setInterval(checkMode, 2000);
    checkMode(); // Check immediately
    
    // Also listen for custom event from dashboard when account info is fetched
    const handleModeChange = (event: any) => {
      const newMode = event.detail?.mode || TradingModeManager.getCurrentMode();
      if (newMode !== currentMode) {
        setCurrentMode(newMode);
      }
    };
    
    window.addEventListener('tradingModeChanged', handleModeChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('tradingModeChanged', handleModeChange);
    };
  }, [currentMode]);

  const toggleMode = () => {
    const newMode: TradingMode = isDemo ? 'live' : 'demo';
    TradingModeManager.setMode(newMode);
    setCurrentMode(newMode);
    // Don't reload - just update the UI
    console.log(`⚠️ Manual mode override: ${newMode}. Note: This will be overridden by MT5 account detection on next sync.`);
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold ${
        isDemo 
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      }`}>
        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isDemo ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
        <span className="hidden sm:inline">{isDemo ? 'DEMO' : 'LIVE'}</span>
        <span className="sm:hidden">{isDemo ? 'D' : 'L'}</span>
      </div>
      {/* Toggle button - Hidden on mobile to save space */}
      <button
        onClick={toggleMode}
        className="hidden md:block text-xs px-3 py-1.5 rounded-lg font-medium bg-[#1e2738] text-gray-400 hover:text-white hover:bg-[#2a3548] transition-all"
        title="Manual override (will be auto-detected from MT5 account)"
      >
        {isDemo ? 'Go Live' : 'Demo'}
      </button>
    </div>
  );
}
