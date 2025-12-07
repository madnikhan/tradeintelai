'use client';

import { Tooltip } from './Tooltip';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  icon?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav className={`flex items-center gap-2 text-sm ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isClickable = item.onClick && !isLast;

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
            {isClickable ? (
              <Tooltip content={`Go to ${item.label}`}>
                <button
                  onClick={item.onClick}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                >
                  {item.icon && <span>{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-1.5 text-white font-medium">
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

