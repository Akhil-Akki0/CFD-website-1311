import React from 'react';

export const PageSkeleton: React.FC = () => (
  <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8" aria-label="Loading page content" role="status">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between border-b border-white/40 pb-5">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-white/65" />
          <div className="h-8 w-64 animate-pulse rounded bg-white/80" />
          <div className="h-4 w-96 max-w-[75vw] animate-pulse rounded bg-white/60" />
        </div>
        <div className="hidden h-10 w-32 animate-pulse rounded-lg bg-white/70 sm:block" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="glass-surface space-y-4 p-5">
            <div className="h-3 w-16 animate-pulse rounded bg-slate-300/70" />
            <div className="h-7 w-24 animate-pulse rounded bg-white/90" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-300/60" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-300/50" />
          </div>
        ))}
      </div>
    </div>
    <span className="sr-only">Loading page content</span>
  </div>
);
