import { describe, it, expect } from 'vitest';
import { mergeAutoPilotConfig } from '@/lib/firebase/auto-pilot';
import { getPresetDefinition } from '@/lib/auto-pilot/presets';
import { DEFAULT_AUTO_PILOT_CONFIG } from '@/lib/auto-pilot/types';

describe('auto-pilot config', () => {
  it('merges partial config with defaults', () => {
    const merged = mergeAutoPilotConfig({ preset: 'scalp', enabled: true });
    expect(merged.preset).toBe('scalp');
    expect(merged.killSwitches.maxDailyLossUsd).toBe(
      DEFAULT_AUTO_PILOT_CONFIG.killSwitches.maxDailyLossUsd
    );
  });

  it('exposes preset definitions', () => {
    const scalp = getPresetDefinition('scalp');
    expect(scalp.scanIntervalSec).toBe(60);
    expect(scalp.watchProfile).toBe('scalp');
  });
});
