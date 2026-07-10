/**
 * Auto Pilot — shared types (dashboard + daemon config).
 */

export type AutoPilotPreset = 'scalp' | 'trend' | 'conservative';

export type AutoPilotSession = 'all' | 'london' | 'new_york' | 'asian';

export interface AutoPilotKillSwitches {
  maxDailyLossUsd: number;
  maxOpenTrades: number;
  maxTradesPerDay: number;
  tradingHoursOnly: boolean;
  demoOnlyUntilReady: boolean;
}

export interface AutoPilotConfig {
  enabled: boolean;
  preset: AutoPilotPreset;
  pairs: string[];
  riskPercentPerTrade: number;
  minConfidence: number;
  session: AutoPilotSession;
  dryRun: boolean;
  killSwitches: AutoPilotKillSwitches;
  updatedAt?: string;
}

export interface AutoPilotDaemonStatus {
  running: boolean;
  dryRun: boolean;
  preset: AutoPilotPreset;
  lastScanAt: string | null;
  lastTradeAt: string | null;
  tradesToday: number;
  dailyPnlUsd: number;
  openPositions: number;
  scanningPairs: string[];
  lastError: string | null;
  blockedReason: string | null;
  licenseValid: boolean;
  platform: 'windows_mt5' | 'socket_ea' | 'file_bridge';
  heartbeatAt: string;
}

export const DEFAULT_AUTO_PILOT_CONFIG: AutoPilotConfig = {
  enabled: false,
  preset: 'trend',
  pairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
  riskPercentPerTrade: 1,
  minConfidence: 65,
  session: 'all',
  dryRun: true,
  killSwitches: {
    maxDailyLossUsd: 100,
    maxOpenTrades: 3,
    maxTradesPerDay: 10,
    tradingHoursOnly: true,
    demoOnlyUntilReady: true,
  },
};
