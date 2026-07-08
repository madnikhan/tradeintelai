'use client';

import { useState } from 'react';
import { createBridgePairingCode } from '@/lib/bridge-watch-client';

export function BridgePairingPanel() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    const result = await createBridgePairingCode();
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCode(result.code ?? null);
    setExpiresIn(result.expiresInMinutes ?? 10);
  };

  return (
    <div className="border-t border-[#1e2738] pt-4 mt-4">
      <h4 className="text-sm font-semibold text-white mb-2">Pair home bridge (remote execute)</h4>
      <p className="text-xs text-gray-500 mb-3">
        Generate a code, then on your home laptop run:{' '}
        <code className="text-cyan-400">npm run bridge:pair CODE [tunnel-url]</code>
      </p>
      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate pairing code'}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      {code && (
        <div className="mt-3 p-4 rounded-lg bg-[#0d1321] border border-cyan-500/30">
          <p className="text-xs text-gray-400">Code (expires in {expiresIn} min)</p>
          <p className="text-3xl font-mono font-bold text-cyan-400 tracking-widest mt-1">{code}</p>
        </div>
      )}
    </div>
  );
}
