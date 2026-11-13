import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Download,
  LayoutGrid,
  Maximize2,
  Cpu,
  Layers,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { AirfoilPresetId, SimulationState } from '../types';
import { AIRFOIL_PRESETS } from '../utils/airfoilPhysics';

interface CommandHeaderProps {
  simulationState: SimulationState;
  activePresetId: AirfoilPresetId;
  onPresetChange: (presetId: AirfoilPresetId) => void;
  onTogglePlay: () => void;
  onStep: () => void;
  onReset: () => void;
  layoutMode: 'standard' | 'viewport-focus' | 'telemetry-focus';
  onLayoutModeChange: (mode: 'standard' | 'viewport-focus' | 'telemetry-focus') => void;
  onOpenExport: () => void;
}

export const CommandHeader: React.FC<CommandHeaderProps> = ({
  simulationState,
  activePresetId,
  onPresetChange,
  onTogglePlay,
  onStep,
  onReset,
  layoutMode,
  onLayoutModeChange,
  onOpenExport,
}) => {
  const currentPreset = AIRFOIL_PRESETS[activePresetId];

  return (
    <header className="min-h-[44px] bg-white border-b border-[#E2E8F0] px-2.5 sm:px-3 py-1 sm:py-0 flex items-center justify-between text-xs select-none shrink-0 z-20 shadow-[0_1px_2px_rgba(15,23,42,0.03)] gap-2 overflow-x-auto no-scrollbar">
      {/* Left section: App Brand, Scene Selector, Live Solver State */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Brand Icon & Title */}
        <div className="flex items-center gap-1.5 sm:gap-2 pr-1.5 sm:pr-2 border-r border-[#E2E8F0]">
          <div className="w-5 h-5 rounded bg-[#2563EB] flex items-center justify-center text-white shadow-sm font-mono text-[10px] font-bold tracking-tight">
            ΔP
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-semibold text-[#0F172A] tracking-tight text-[11px] leading-tight flex items-center gap-1.5">
              RIMZ AERO PRECISION
              <span className="text-[9px] font-mono uppercase px-1 py-0.2 bg-[#EFF6FF] text-[#2563EB] rounded font-medium border border-[#DBEAFE]">
                RIMZ v4.2
              </span>
            </span>
          </div>
        </div>

        {/* Preset Selector Dropdown */}
        <div className="relative flex items-center">
          <label htmlFor="scene-select" className="sr-only">Select Aerodynamic Scene</label>
          <div className="flex items-center gap-1 bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-colors rounded px-2 py-1 text-[#0F172A] cursor-pointer border border-[#E2E8F0]">
            <Layers className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <select
              id="scene-select"
              value={activePresetId}
              onChange={(e) => onPresetChange(e.target.value as AirfoilPresetId)}
              className="bg-transparent font-medium text-xs text-[#0F172A] focus:outline-none cursor-pointer pr-3 max-w-[120px] sm:max-w-none truncate"
            >
              {Object.values(AIRFOIL_PRESETS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#64748B] pointer-events-none -ml-3 shrink-0" />
          </div>
        </div>

        {/* Live Solver Status Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] font-mono text-[11px]">
          <span className="relative flex h-2 w-2">
            {simulationState.isRunning ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981] shadow-[0_0_8px_#10b981]"></span>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F59E0B]"></span>
            )}
          </span>
          <span className="font-semibold text-[#0F172A] uppercase tracking-wider text-[10px]">
            {simulationState.isRunning ? 'SOLVER ACTIVE' : 'PAUSED'}
          </span>
          <span className="text-[#94A3B8]">|</span>
          <span className="text-[#475569] tabular-nums font-medium">
            Iter: <strong className="text-[#0F172A]">{simulationState.iteration.toLocaleString()}</strong>/{simulationState.maxIterations.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Center section: High-Precision Flow Telemetry Readouts */}
      <div className="hidden lg:flex items-center gap-3 font-mono text-[11px] tabular-nums text-[#475569]">
        <div className="flex items-center gap-1">
          <span className="text-[#94A3B8] font-normal">M∞:</span>
          <span className="font-semibold text-[#0F172A] bg-[#F1F5F9] px-1 rounded border border-[#E2E8F0]">
            {simulationState.mach.toFixed(3)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#94A3B8] font-normal">AoA:</span>
          <span className="font-semibold text-[#0F172A] bg-[#F1F5F9] px-1 rounded border border-[#E2E8F0]">
            {simulationState.aoa >= 0 ? `+${simulationState.aoa.toFixed(1)}°` : `${simulationState.aoa.toFixed(1)}°`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#94A3B8] font-normal">Re:</span>
          <span className="font-semibold text-[#0F172A]">
            {(simulationState.reynolds / 1e6).toFixed(2)}M
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#94A3B8] font-normal">CFL:</span>
          <span className="font-semibold text-[#0F172A]">{simulationState.cflNumber.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[#94A3B8] font-normal">Δṁ:</span>
          <span className="text-[#10B981] font-semibold">{simulationState.massFlowResidual.toExponential(2)}</span>
        </div>
      </div>

      {/* Right section: Execution Controls, Layout presets, Export */}
      <div className="flex items-center gap-2">
        {/* Solver Controls */}
        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
          <button
            id="solver-play-toggle-btn"
            onClick={onTogglePlay}
            title={simulationState.isRunning ? 'Pause iterative solver' : 'Run Navier-Stokes solver'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all shadow-sm ${
              simulationState.isRunning
                ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]'
                : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
            }`}
          >
            {simulationState.isRunning ? (
              <>
                <Pause className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Solve</span>
              </>
            )}
          </button>

          <button
            id="solver-single-step-btn"
            onClick={onStep}
            disabled={simulationState.isRunning}
            title="Single Iteration Step"
            className="p-1 text-[#475569] hover:text-[#0F172A] hover:bg-white rounded transition-colors disabled:opacity-40"
          >
            <StepForward className="w-3.5 h-3.5" />
          </button>

          <button
            id="solver-reset-btn"
            onClick={onReset}
            title="Reset Solver to Initial Free-Stream Field"
            className="p-1 text-[#475569] hover:text-[#0F172A] hover:bg-white rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Layout Mode Switcher */}
        <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
          <button
            onClick={() => onLayoutModeChange('standard')}
            title="Standard Workbench (All Panes)"
            className={`px-1.5 py-1 rounded transition-colors ${
              layoutMode === 'standard' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onLayoutModeChange('viewport-focus')}
            title="Maximize Viewport (Full Screen CFD)"
            className={`px-1.5 py-1 rounded transition-colors ${
              layoutMode === 'viewport-focus' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Technical Export / Report Button */}
        <button
          id="export-report-btn"
          onClick={onOpenExport}
          className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] rounded text-xs font-medium transition-colors shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="hidden md:inline">Export</span>
        </button>
      </div>
    </header>
  );
};
