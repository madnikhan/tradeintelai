'use client';

import { useState } from 'react';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#1e2738] rounded-lg overflow-hidden bg-[#141c2b]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] text-left hover:bg-[#1a2332] transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="text-[var(--text-secondary)] text-lg" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div className="px-4 pb-4 border-t border-[#1e2738]">{children}</div>}
    </div>
  );
}
