'use client';

import { useState } from 'react';
import { Account } from '@/types/trading';
import { TradingModeManager } from '@/lib/trading-mode';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { MetricTooltip } from '@/components/Tooltip';

interface AccountStatsBarProps {
  account: Account;
  isLoadingBalance: boolean;
  isLoadingTrades: boolean;
  isRefreshingBalance?: boolean;
  onSyncTrades?: () => void;
  isSyncing?: boolean;
}

const valueClasses =
  'text-lg sm:text-xl font-bold font-mono tabular-nums min-w-0 w-full truncate';

export function AccountStatsBar({
  account,
  isLoadingBalance,
  isLoadingTrades,
  isRefreshingBalance = false,
  onSyncTrades,
  isSyncing,
}: AccountStatsBarProps) {
  const [expanded, setExpanded] = useState(false);
  const currency = TradingModeManager.getCurrencySymbol();

  const kpiItems = [
    {
      label: 'Balance',
      value: `${currency}${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      loading: isLoadingBalance,
      description: 'Total funds in your trading account.',
    },
    {
      label: 'Daily P/L',
      value: `${account.dailyProfitLoss >= 0 ? '+' : ''}${currency}${account.dailyProfitLoss.toFixed(2)}`,
      loading: isLoadingTrades && account.totalTrades === 0,
      valueClass: account.dailyProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400',
      description: 'Realized profit/loss from trades closed today.',
    },
    {
      label: 'Open positions',
      value: String(account.openTrades),
      loading: false,
      description: 'Number of currently open trades.',
    },
  ];

  const extraItems = [
    { label: 'Equity', value: `${currency}${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    {
      label: 'Unrealized P/L',
      value: `${(account.unrealizedPL || 0) >= 0 ? '+' : ''}${currency}${(account.unrealizedPL || 0).toFixed(2)}`,
      valueClass: (account.unrealizedPL || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    {
      label: 'Monthly P/L',
      value: `${account.monthlyProfitLoss >= 0 ? '+' : ''}${currency}${account.monthlyProfitLoss.toFixed(2)}`,
      valueClass: account.monthlyProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    {
      label: 'All time P/L',
      value: `${(account.allTimeProfitLoss || 0) >= 0 ? '+' : ''}${currency}${(account.allTimeProfitLoss || 0).toFixed(2)}`,
      valueClass: (account.allTimeProfitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    { label: 'Trades today', value: String(account.tradesToday) },
    { label: 'Total trades', value: String(account.totalTrades) },
  ];

  const renderMetric = (
    label: string,
    value: string,
    loading: boolean,
    description?: string,
    valueClass = 'text-white'
  ) => {
    const inner = (
      <div
        className={`bg-[#0d1321] rounded-xl border border-[#1e2738] p-4 min-w-0 cursor-help touch-manipulation transition-opacity ${
          isRefreshingBalance && !loading ? 'opacity-80' : ''
        }`}
      >
        <p className="label mb-2 truncate">{label}</p>
        {loading ? (
          <LoadingSkeleton type="metric-inline" />
        ) : (
          <p className={`${valueClasses} ${valueClass}`} title={value}>
            {value}
          </p>
        )}
      </div>
    );
    if (description) {
      return (
        <MetricTooltip key={label} metric={label} description={description}>
          {inner}
        </MetricTooltip>
      );
    }
    return (
      <div key={label} className="min-w-0">
        {inner}
      </div>
    );
  };

  const renderExtraMetric = (item: (typeof extraItems)[0]) => (
    <div
      key={item.label}
      className={`bg-[#0d1321] rounded-xl border border-[#1e2738] p-4 min-w-0 transition-opacity ${
        isRefreshingBalance ? 'opacity-80' : ''
      }`}
    >
      <p className="label mb-2 truncate">{item.label}</p>
      <p className={`${valueClasses} ${item.valueClass || 'text-white'}`} title={item.value}>
        {item.value}
      </p>
    </div>
  );

  return (
    <div className="mb-5 sm:mb-6">
      <div className="grid grid-cols-3 gap-3 md:hidden">
        {kpiItems.map((item) =>
          renderMetric(item.label, item.value, item.loading, item.description, item.valueClass)
        )}
      </div>

      <div className="hidden md:grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpiItems.map((item) =>
          renderMetric(item.label, item.value, item.loading, item.description, item.valueClass)
        )}
        {extraItems.map(renderExtraMetric)}
      </div>

      <div className="md:hidden mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-cyan-400 min-h-[44px] px-2 touch-manipulation"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide all stats' : 'View all stats'}
        </button>
        {onSyncTrades && (
          <button
            type="button"
            onClick={onSyncTrades}
            disabled={isSyncing}
            className="btn btn-secondary text-xs min-h-[44px]"
          >
            {isSyncing ? 'Syncing…' : '↻ Sync'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="md:hidden grid grid-cols-2 gap-3 mt-3 animate-fade-in">
          {extraItems.map((item) => (
            <div key={item.label} className="bg-[#0d1321] rounded-xl border border-[#1e2738] p-4 min-w-0">
              <p className="label mb-2 truncate">{item.label}</p>
              <p
                className={`text-lg font-bold font-mono tabular-nums truncate ${item.valueClass || 'text-white'}`}
                title={item.value}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
