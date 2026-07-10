import type { AutoPilotPreset } from './types';

export interface AutoPilotPresetDefinition {
  id: AutoPilotPreset;
  label: string;
  description: string;
  scanIntervalSec: number;
  useVision: boolean;
  minConfidence: number;
  maxOpenTrades: number;
  watchProfile: 'default' | 'scalp';
}

export const AUTO_PILOT_PRESETS: Record<AutoPilotPreset, AutoPilotPresetDefinition> = {
  scalp: {
    id: 'scalp',
    label: 'Scalp',
    description: 'Fast scans, OHLC-only, small targets, quick re-entry',
    scanIntervalSec: 60,
    useVision: false,
    minConfidence: 70,
    maxOpenTrades: 3,
    watchProfile: 'scalp',
  },
  trend: {
    id: 'trend',
    label: 'Trend',
    description: 'Balanced scans with vision on candidates',
    scanIntervalSec: 300,
    useVision: true,
    minConfidence: 65,
    maxOpenTrades: 5,
    watchProfile: 'default',
  },
  conservative: {
    id: 'conservative',
    label: 'Conservative',
    description: 'Slower scans, stricter gates, fewer concurrent trades',
    scanIntervalSec: 900,
    useVision: true,
    minConfidence: 75,
    maxOpenTrades: 2,
    watchProfile: 'default',
  },
};

export function getPresetDefinition(preset: AutoPilotPreset): AutoPilotPresetDefinition {
  return AUTO_PILOT_PRESETS[preset] ?? AUTO_PILOT_PRESETS.trend;
}
