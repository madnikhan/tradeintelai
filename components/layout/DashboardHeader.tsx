'use client';

import { AuthButton } from '@/components/AuthButton';
import { AccountSelector } from '@/components/AccountSelector';
import { SymbolPicker } from '@/components/trading/SymbolPicker';
import { useTradingContext } from '@/context/TradingContext';
import { TradingModeSwitch } from '@/components/TradingModeSwitch';
import { SystemStatus } from '@/components/SystemStatus';

interface DashboardHeaderProps {
  onMenuOpen: () => void;
  tradingHoursQuality?: string;
  currentSession?: string;
}

export function DashboardHeader({
  onMenuOpen,
  tradingHoursQuality,
  currentSession,
}: DashboardHeaderProps) {
  const { symbol, setSymbol } = useTradingContext();

  return (
    <header className="bg-[#0d1321] border-b border-[#1e2738] sticky top-0 z-30 safe-area-top">
      <div className="px-2 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={onMenuOpen}
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-secondary hover:text-white hover:bg-[#1e2738] transition-all touch-manipulation"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="hidden sm:block flex-shrink-0">
              <img
                src="/logo.png"
                alt="TradeIntel AI"
                className="h-9 w-9 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <div className="min-w-0 flex-1 max-w-[200px] sm:max-w-xs">
              <SymbolPicker value={symbol} onChange={setSymbol} compact />
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {currentSession && (
              <span
                className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                  tradingHoursQuality === 'PRIME'
                    ? 'bg-green-500/10 text-green-400'
                    : tradingHoursQuality === 'GOOD'
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : tradingHoursQuality === 'AVERAGE'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {currentSession}
              </span>
            )}
            <div className="hidden lg:block max-w-[200px]">
              <AccountSelector />
            </div>
            <div className="hidden sm:block">
              <SystemStatus />
            </div>
            <AuthButton />
            <div className="hidden md:block">
              <TradingModeSwitch />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
