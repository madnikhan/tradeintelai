'use client';

import { useState, useRef, useEffect } from 'react';
import { Tooltip } from './Tooltip';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
}

interface QuickActionsMenuProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionsMenu({ actions, className = '' }: QuickActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleActionClick = (action: QuickAction) => {
    action.onClick();
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <Tooltip content="Quick Actions (Q)">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all border border-cyan-500/30"
          aria-label="Quick Actions"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </button>
      </Tooltip>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-[#0d1321] border border-[#1e2738] rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-2 border-b border-[#1e2738]">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 py-2">
                Quick Actions
              </h3>
            </div>
            <div className="py-2 max-h-96 overflow-y-auto">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1e2738] transition-colors ${
                    action.variant === 'danger'
                      ? 'text-red-400 hover:text-red-300'
                      : action.variant === 'success'
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{action.icon}</span>
                    <span className="text-sm font-medium">{action.label}</span>
                  </div>
                  {action.shortcut && (
                    <kbd className="px-2 py-1 text-xs font-mono bg-[#1e2738] text-gray-400 rounded border border-[#2a3548]">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

