import React from 'react';
import { motion } from 'motion/react';
import { Activity, CheckCircle2, Clock, Zap, AlertCircle } from 'lucide-react';

interface ConvergenceProgressBarProps {
  iteration: number;
  maxIterations: number;
  isRunning: boolean;
  isConverged: boolean;
  isFailed?: boolean;
  runtimeSeconds: number;
  continuityResidual: number | null;
  momentumResidual: number | null;
  energyResidual: number | null;
}

export const ConvergenceProgressBar: React.FC<ConvergenceProgressBarProps> = ({
  iteration,
  maxIterations,
  isRunning,
  isConverged,
  isFailed = false,
  runtimeSeconds,
  continuityResidual,
  momentumResidual,
  energyResidual,
}) => {
  // A failed simulation must never display 100% or CONVERGED
  const rawRatio = Math.max(0, iteration / maxIterations);
  const progressRatio = isFailed ? Math.min(0.99, rawRatio) : Math.min(1, rawRatio);
  const progressPercent = isFailed ? Math.min(99, Math.round(progressRatio * 100)) : Math.round(progressRatio * 100);

  const itersPerSec = runtimeSeconds > 0 ? iteration / runtimeSeconds : 0;
  const remainingIters = Math.max(0, maxIterations - iteration);
  const etaSeconds = itersPerSec > 0 ? remainingIters / itersPerSec : 0;

  const getCfdPhase = () => {
    if (isFailed) return { label: 'Solver Execution Failed', sub: 'Non-convergence or boundary divergence detected', color: 'text-rose-600' };
    if (isConverged) return { label: 'Navier-Stokes Fully Converged', sub: 'L2 norm residuals < 1e-5 threshold achieved', color: 'text-emerald-600' };
    if (progressPercent < 25) return { label: 'Phase 1: Initial Transient Field Development', sub: 'Inflow momentum penetration & wall potential initialization', color: 'text-sky-600' };
    if (progressPercent < 60) return { label: 'Phase 2: Viscous Boundary Layer Growth', sub: 'Prism layer shear stresses & eddy viscosity production', color: 'text-teal-600' };
    if (progressPercent < 85) return { label: 'Phase 3: Pressure-Velocity Coupling (SIMPLE)', sub: 'Rhie-Chow face flux interpolation & continuity stabilization', color: 'text-cyan-600' };
    return { label: 'Phase 4: Asymptotic Residual Convergence', sub: 'Iterative matrix relaxation damping high-frequency spatial modes', color: 'text-emerald-600' };
  };

  const currentPhase = getCfdPhase();

  const isTelemetryAvailable = continuityResidual !== null || momentumResidual !== null || energyResidual !== null;
  const isContinuityGood = continuityResidual !== null && continuityResidual < 1e-3;
  const isMomentumGood = momentumResidual !== null && momentumResidual < 1e-3;
  const isEnergyGood = energyResidual !== null && energyResidual < 1e-3;

  const isPaused = !isRunning && !isConverged && !isFailed && iteration > 0;
  const isReady = !isRunning && !isConverged && !isFailed && iteration === 0;

  return (
    <div className="glass-surface bg-white/95 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Top Header with Convergence State & ETA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${
            isFailed
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
              : isConverged
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
              : isRunning
              ? 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {isFailed ? (
              <AlertCircle className="w-4 h-4" />
            ) : isConverged ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Navier-Stokes Iteration Progress
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  isFailed
                    ? 'bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                    : isConverged
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                    : isRunning
                    ? 'bg-teal-100 text-teal-800 border border-teal-300 dark:bg-teal-950 dark:text-teal-300 shadow-[0_0_6px_rgba(20,184,166,0.25)]'
                    : isPaused
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isFailed ? 'FAILED' : isConverged ? 'CONVERGED' : isRunning ? 'SOLVING' : isPaused ? 'PAUSED' : 'READY'}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1">
              <span className="font-semibold text-slate-900 dark:text-slate-200">{currentPhase.label}</span>
              <span className="hidden sm:inline text-slate-400">•</span>
              <span className="truncate max-w-[280px] sm:max-w-none">{currentPhase.sub}</span>
            </div>
          </div>
        </div>

        {/* Live Numbers */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono self-start sm:self-auto shrink-0 mt-2 sm:mt-0">
          <div className="text-right">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Solve Rate</span>
            <span className="font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1">
              <Zap className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              {itersPerSec.toFixed(1)} it/s
            </span>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

          <div className="text-right">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Est. Time Remaining</span>
            <span className="font-bold text-slate-900 dark:text-white flex items-center justify-end gap-1">
              <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              {isConverged ? '0.0s' : `${etaSeconds.toFixed(1)}s`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Progress Bar with Milestones */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
              {iteration.toLocaleString()}
            </span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600 dark:text-slate-400 tabular-nums">
              {maxIterations.toLocaleString()} iterations
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Convergence:</span>
            <span className={`font-extrabold text-sm tabular-nums ${isFailed ? 'text-rose-600' : isConverged ? 'text-emerald-600' : 'text-teal-600'}`}>
              {isTelemetryAvailable ? `${progressPercent}%` : '—'}
            </span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="relative w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
          <motion.div
            className={`h-full relative ${
              isFailed
                ? 'bg-rose-500'
                : isConverged
                ? 'bg-gradient-to-r from-teal-600 to-emerald-500'
                : 'bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          >
            {isRunning && !isConverged && !isFailed && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
              />
            )}
          </motion.div>

          <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
            <div className="w-px h-full bg-white/40" style={{ left: '25%' }} />
            <div className="w-px h-full bg-white/40" style={{ left: '50%' }} />
            <div className="w-px h-full bg-white/40" style={{ left: '75%' }} />
          </div>
        </div>

        <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 px-0.5">
          <span>0 (Init)</span>
          <span>Wake Development</span>
          <span>SIMPLE Coupling</span>
          <span>Relaxation</span>
          <span>{maxIterations} (Limit)</span>
        </div>
      </div>

      {/* Residual Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Continuity (p)</span>
            <span className={`w-2 h-2 rounded-full ${continuityResidual === null ? 'bg-slate-300' : isContinuityGood ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <span className="font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {continuityResidual === null ? '—' : continuityResidual.toExponential(2)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Momentum (Ux)</span>
            <span className={`w-2 h-2 rounded-full ${momentumResidual === null ? 'bg-slate-300' : isMomentumGood ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <span className="font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {momentumResidual === null ? '—' : momentumResidual.toExponential(2)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Turbulence (k-ω)</span>
            <span className={`w-2 h-2 rounded-full ${energyResidual === null ? 'bg-slate-300' : isEnergyGood ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <span className="font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {energyResidual === null ? '—' : energyResidual.toExponential(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConvergenceProgressBar;
