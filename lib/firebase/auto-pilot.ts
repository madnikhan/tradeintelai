/**
 * Firestore helpers for Auto Pilot config and daemon status.
 */

import type { AutoPilotConfig, AutoPilotDaemonStatus } from '@/lib/auto-pilot/types';
import { DEFAULT_AUTO_PILOT_CONFIG } from '@/lib/auto-pilot/types';

export function autoPilotConfigPath(userId: string): string {
  return `users/${userId}/settings/autoPilot`;
}

export function autoPilotStatusPath(userId: string): string {
  return `users/${userId}/autoPilot/status`;
}

export function mergeAutoPilotConfig(
  partial?: Partial<AutoPilotConfig> | null
): AutoPilotConfig {
  if (!partial) return { ...DEFAULT_AUTO_PILOT_CONFIG };
  return {
    ...DEFAULT_AUTO_PILOT_CONFIG,
    ...partial,
    killSwitches: {
      ...DEFAULT_AUTO_PILOT_CONFIG.killSwitches,
      ...(partial.killSwitches ?? {}),
    },
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };
}

export type { AutoPilotConfig, AutoPilotDaemonStatus };
