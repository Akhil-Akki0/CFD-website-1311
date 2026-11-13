import React from 'react';
import {
  ScalarFieldType
} from '../../types';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Wind,
  Grid,
  Activity,
  Zap,
  Eye,
  Camera,
  RotateCcw
} from 'lucide-react';

interface ViewportHudProps {
  scalarType: ScalarFieldType;
  onScalarTypeChange: (type: ScalarFieldType) => void;
  showContours: boolean;
  onToggleContours: () => void;
  showStreamlines: boolean;
  onToggleStreamlines: () => void;
  showMesh: boolean;
  onToggleMesh: () => void;
  showVectors: boolean;
  onToggleVectors: () => void;
  showShockLine: boolean;
  onToggleShockLine: () => void;
  showProbes: boolean;
  onToggleProbes: () => void;
  onResetCamera: () => void;
  onSetCameraPreset: (preset: 'chord' | 'le' | 'shock' | 'wake' | 'farfield') => void;
  streamlineSpeed: number;
  onStreamlineSpeedChange: (speed: number) => void;
}

export const ViewportHud: React.FC<ViewportHudProps> = ({
  scalarType,
  onScalarTypeChange,
  showContours,
  onToggleContours,
  showStreamlines,
  onToggleStreamlines,
  showMesh,
  onToggleMesh,
  showVectors,
  onToggleVectors,
  showShockLine,
  onToggleShockLine,
  showProbes,
  onToggleProbes,
  onResetCamera,
  onSetCameraPreset,
  streamlineSpeed,
  onStreamlineSpeedChange,
}) => {
  const scalarOptions: { id: ScalarFieldType; label: string }[] = [
    { id: 'pressure_cp', label: 'Cp Pressure' },
    { id: 'mach', label: 'Mach (M)' },
    { id: 'velocity_u', label: 'Velocity (|U|)' },
    { id: 'vorticity', label: 'Vorticity (ω)' },
    { id: 'turbulent_ke', label: 'TKE (k)' },
    { id: 'temperature', label: 'Temp (T)' },
  ];

  return (
    <>
      {/* Top Floating Bar: Scalar Field Selector & Display Layers */}
      <div className="absolute top-2.5 left-2 sm:left-3 right-2 sm:right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Scalar Selector Pills */}
        <div className="pointer-events-auto flex items-center bg-white/85 backdrop-blur-md border border-[#E2E8F0]/90 rounded-md p-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] overflow-x-auto no-scrollbar max-w-full">
          <div className="flex items-center gap-0.5 shrink-0">
            {scalarOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onScalarTypeChange(opt.id)}
                className={`px-2 py-1 rounded text-[11px] font-mono whitespace-nowrap transition-all ${
                  scalarType === opt.id
                    ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Layer Toggles & Streamline speed */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-white/85 backdrop-blur-md border border-[#E2E8F0]/90 rounded-md p-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] overflow-x-auto no-scrollbar max-w-full">
          {/* Contours Toggle */}
          <button
            onClick={onToggleContours}
            title="Toggle Pressure/Scalar Contour Heatmap"
            className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
              showContours
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Activity className="w-3 h-3 text-[#2563EB]" />
            <span className="hidden sm:inline">Contours</span>
          </button>

          {/* Streamlines Toggle */}
          <button
            onClick={onToggleStreamlines}
            title="Toggle Animated Fluid Streamlines & Particles"
            className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
              showStreamlines
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Wind className="w-3 h-3 text-[#06B6D4]" />
            <span className="hidden sm:inline">Streamlines</span>
          </button>

          {/* Mesh Toggle */}
          <button
            onClick={onToggleMesh}
            title="Toggle Prism Boundary Layer & CFD Mesh Grid"
            className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
              showMesh
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Grid className="w-3 h-3 text-[#10B981]" />
            <span className="hidden sm:inline">Grid Mesh</span>
          </button>

          {/* Vectors Toggle */}
          <button
            onClick={onToggleVectors}
            title="Toggle Velocity Direction Quiver Vectors"
            className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
              showVectors
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Zap className="w-3 h-3 text-[#F59E0B]" />
            <span className="hidden sm:inline">Vectors</span>
          </button>

          {/* Shockwave Toggle */}
          <button
            onClick={onToggleShockLine}
            title="Toggle Transonic Normal Shock / Schlieren Gradient"
            className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
              showShockLine
                ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
            <span className="hidden sm:inline">Shock</span>
          </button>
        </div>
      </div>

      {/* Camera Navigation Quick Presets (Bottom Center HUD) */}
      <div className="hidden sm:flex absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto items-center gap-1 bg-white/85 backdrop-blur-md border border-[#E2E8F0]/90 rounded-md px-2 py-1 shadow-[0_2px_8px_rgba(15,23,42,0.06)] text-xs select-none max-w-[95vw] overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-mono text-[#94A3B8] mr-1 flex items-center gap-1">
          <Camera className="w-3 h-3 text-[#64748B]" />
          VIEW:
        </span>
        <button
          onClick={() => onSetCameraPreset('chord')}
          className="px-1.5 py-0.5 hover:bg-[#F1F5F9] rounded text-[11px] font-mono text-[#475569] hover:text-[#0F172A]"
        >
          Chord
        </button>
        <span className="text-[#CBD5E1]">|</span>
        <button
          onClick={() => onSetCameraPreset('le')}
          className="px-1.5 py-0.5 hover:bg-[#F1F5F9] rounded text-[11px] font-mono text-[#475569] hover:text-[#0F172A]"
        >
          Leading Edge
        </button>
        <span className="text-[#CBD5E1]">|</span>
        <button
          onClick={() => onSetCameraPreset('shock')}
          className="px-1.5 py-0.5 hover:bg-[#F1F5F9] rounded text-[11px] font-mono text-[#475569] hover:text-[#0F172A]"
        >
          Shock Foot
        </button>
        <span className="text-[#CBD5E1]">|</span>
        <button
          onClick={() => onSetCameraPreset('wake')}
          className="px-1.5 py-0.5 hover:bg-[#F1F5F9] rounded text-[11px] font-mono text-[#475569] hover:text-[#0F172A]"
        >
          Wake Vortex
        </button>
        <span className="text-[#CBD5E1]">|</span>
        <button
          onClick={() => onSetCameraPreset('farfield')}
          className="px-1.5 py-0.5 hover:bg-[#F1F5F9] rounded text-[11px] font-mono text-[#475569] hover:text-[#0F172A]"
        >
          Domain
        </button>
        <span className="text-[#CBD5E1]">|</span>
        <button
          onClick={onResetCamera}
          title="Reset Camera Zoom & Pan"
          className="p-1 hover:bg-[#F1F5F9] rounded text-[#2563EB]"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
    </>
  );
};
