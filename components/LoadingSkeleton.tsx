'use client';

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'text' | 'circle' | 'metric' | 'metric-inline';
  lines?: number;
  className?: string;
}

export function LoadingSkeleton({ type = 'card', lines = 3, className = '' }: LoadingSkeletonProps) {
  if (type === 'card') {
    return (
      <div className={`bg-[#0d1321] rounded-xl border border-[#1e2738] p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-[#1e2738] rounded w-1/4 mb-3"></div>
        <div className="h-8 bg-[#1e2738] rounded w-1/2"></div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`bg-[#0d1321] rounded-xl border border-[#1e2738] overflow-hidden ${className}`}>
        <div className="p-4 border-b border-[#1e2738]">
          <div className="h-4 bg-[#1e2738] rounded w-1/4"></div>
        </div>
        <div className="divide-y divide-[#1e2738]">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="h-4 bg-[#1e2738] rounded flex-1"></div>
                <div className="h-4 bg-[#1e2738] rounded w-24"></div>
                <div className="h-4 bg-[#1e2738] rounded w-24"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-4 bg-[#1e2738] rounded animate-pulse ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
          ></div>
        ))}
      </div>
    );
  }

  if (type === 'circle') {
    return (
      <div className={`w-12 h-12 bg-[#1e2738] rounded-full animate-pulse ${className}`}></div>
    );
  }

  if (type === 'metric-inline') {
    return (
      <div className={`h-7 bg-[#1e2738] rounded w-3/4 max-w-[140px] animate-pulse ${className}`} />
    );
  }

  if (type === 'metric') {
    return (
      <div className={`bg-[#0d1321] rounded-xl border border-[#1e2738] p-4 animate-pulse ${className}`}>
        <div className="h-3 bg-[#1e2738] rounded w-1/3 mb-2"></div>
        <div className="h-8 bg-[#1e2738] rounded w-1/2 mb-1"></div>
        <div className="h-2 bg-[#1e2738] rounded w-1/4"></div>
      </div>
    );
  }

  return null;
}

export function LoadingSkeletonGrid({ count = 4, type = 'card' }: { count?: number; type?: 'card' | 'metric' }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} type={type} />
      ))}
    </div>
  );
}

