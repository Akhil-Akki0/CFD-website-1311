import React from 'react';

interface StartupVideoOverlayProps {
  onComplete: () => void;
}

export const StartupVideoOverlay: React.FC<StartupVideoOverlayProps> = ({ onComplete }) => {
  React.useEffect(() => {
    const safetyTimeout = window.setTimeout(onComplete, 5200);
    return () => window.clearTimeout(safetyTimeout);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06131a]" role="status" aria-label="Opening RIMZ Platform">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/media/metallic-rocket-loading.mp4"
        poster="/media/loading-poster.jpg"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onComplete}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[#06131a]/60" />
      <div className="relative z-10 mx-6 flex max-w-md flex-col items-center rounded-2xl border border-white/20 bg-[#06131a]/70 px-8 py-7 text-center text-white shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#5eead4] shadow-[0_0_18px_#5eead4]" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ccfbf1]">RIMZ Engine</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Opening your workbench</h1>
        <p className="mt-2 text-sm leading-[1.6] text-white/80">Preparing the workspace and solver controls.</p>
        <div className="mt-5 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-1/2 animate-[loading-progress_1.4s_ease-in-out_infinite] rounded-full bg-[#5eead4]" />
        </div>
      </div>
    </div>
  );
};
