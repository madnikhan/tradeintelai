'use client';

import { useMemo, useState } from 'react';
import { ALL_COMPACT_SYMBOLS, toCompactSymbol, toDisplaySymbol } from '@/lib/trading-symbols';

interface SymbolPickerProps {
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
  compact?: boolean;
}

export function SymbolPicker({ value, onChange, className = '', compact = false }: SymbolPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return ALL_COMPACT_SYMBOLS.slice(0, 40);
    return ALL_COMPACT_SYMBOLS.filter(
      (s) => s.includes(q) || toDisplaySymbol(s).toUpperCase().includes(q)
    ).slice(0, 30);
  }, [query]);

  const compactValue = toCompactSymbol(value);

  if (compact) {
    return (
      <select
        value={compactValue}
        onChange={(e) => onChange(e.target.value)}
        className={`input min-h-[44px] text-sm font-mono ${className}`}
        aria-label="Trading symbol"
      >
        {ALL_COMPACT_SYMBOLS.map((s) => (
          <option key={s} value={s}>
            {toDisplaySymbol(s)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input min-h-[44px] flex items-center justify-between gap-2 w-full text-left font-mono"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{toDisplaySymbol(compactValue)}</span>
        <span className="text-secondary text-xs">Change</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Close symbol picker"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-full min-w-[280px] max-h-72 overflow-hidden rounded-xl border border-[#1e2738] bg-[#0d1321] shadow-xl">
            <div className="p-2 border-b border-[#1e2738]">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol..."
                className="input text-sm min-h-[44px]"
                autoFocus
              />
            </div>
            <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
              {filtered.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s === compactValue}
                    className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-mono hover:bg-[#1a2332] ${
                      s === compactValue ? 'bg-cyan-500/10 text-cyan-400' : 'text-white'
                    }`}
                    onClick={() => {
                      onChange(s);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {toDisplaySymbol(s)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
