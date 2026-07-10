'use client';

export type PrimaryTabId = 'trade' | 'scan' | 'autopilot' | 'performance' | 'settings';

export interface PrimaryTab {
  id: PrimaryTabId;
  label: string;
  shortLabel: string;
  icon: string;
}

export const PRIMARY_TABS: PrimaryTab[] = [
  { id: 'trade', label: 'Trade', shortLabel: 'Trade', icon: '💹' },
  { id: 'scan', label: 'Scan', shortLabel: 'Scan', icon: '🔍' },
  { id: 'autopilot', label: 'Auto Pilot', shortLabel: 'Auto', icon: '🤖' },
  { id: 'performance', label: 'Performance', shortLabel: 'Perf', icon: '📈' },
  { id: 'settings', label: 'Setup', shortLabel: 'Setup', icon: '⚙️' },
];

interface MobileTabBarProps {
  activeTab: PrimaryTabId;
  onTabChange: (tab: PrimaryTabId) => void;
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d1321] border-t border-[#1e2738] safe-area-bottom"
      aria-label="Primary navigation"
    >
      <div className="flex items-stretch justify-around px-1 pt-1 pb-1">
        {PRIMARY_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 min-h-[56px] min-w-[44px] rounded-lg touch-manipulation transition-colors ${
                active ? 'text-cyan-400 bg-cyan-500/10' : 'text-secondary hover:text-white'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-xl leading-none" aria-hidden>
                {tab.icon}
              </span>
              <span className="text-xs font-medium mt-1">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
