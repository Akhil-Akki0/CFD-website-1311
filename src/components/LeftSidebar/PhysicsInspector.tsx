import React from 'react';
import {
  TurbulenceModel,
  SimulationState,
  BoundaryCondition
} from '../../types';
import { Sliders, Activity, ShieldCheck, Flame, Compass, Wind } from 'lucide-react';

interface PhysicsInspectorProps {
  simulationState: SimulationState;
  turbulenceModel: TurbulenceModel;
  onTurbulenceModelChange: (model: TurbulenceModel) => void;
  onMachChange: (mach: number) => void;
  onAoAChange: (aoa: number) => void;
  onCflChange: (cfl: number) => void;
  onReynoldsChange: (re: number) => void;
}

export const PhysicsInspector: React.FC<PhysicsInspectorProps> = ({
  simulationState,
  turbulenceModel,
  onTurbulenceModelChange,
  onMachChange,
  onAoAChange,
  onCflChange,
  onReynoldsChange,
}) => {
  // Boundary conditions with 3px left border
  const boundaryConditions: BoundaryCondition[] = [
    {
      id: 'bc_inlet',
      name: 'Velocity Farfield Inlet',
      type: 'velocity-inlet',
      value: `M = ${simulationState.mach.toFixed(3)}, P0 = 101.3 kPa`,
      color: '#2563EB', // Cobalt
      active: true,
    },
    {
      id: 'bc_outlet',
      name: 'Static Pressure Outlet',
      type: 'pressure-outlet',
      value: 'P_back = 101,325 Pa, Re-entrant OFF',
      color: '#06B6D4', // Cyan
      active: true,
    },
    {
      id: 'bc_wall',
      name: 'Aerofoil Wall Surface',
      type: 'no-slip-wall',
      value: 'No-Slip Adiabatic (∂T/∂n = 0)',
      color: '#475569', // Slate
      active: true,
    },
    {
      id: 'bc_symmetry',
      name: 'Domain Top/Bottom Boundary',
      type: 'symmetry-slip',
      value: 'Free-Slip Farfield (vn = 0, ∂vt/∂n = 0)',
      color: '#8B5CF6', // Violet
      active: true,
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto text-xs select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <span className="font-semibold text-[#0F172A] tracking-tight uppercase text-[10px]">
          Physics & Boundary Conditions
        </span>
        <p className="text-[11px] text-[#64748B]">Navier-Stokes solver formulation</p>
      </div>

      <div className="p-3 space-y-4">
        {/* Viscous Turbulence Model Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-[#0F172A] mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#2563EB]" />
              Turbulence Closure Model
            </span>
            <span className="text-[9px] font-mono text-[#2563EB] bg-[#EFF6FF] px-1.5 py-0.2 rounded border border-[#DBEAFE]">
              RANS
            </span>
          </label>
          <div className="bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
            <select
              value={turbulenceModel}
              onChange={(e) => onTurbulenceModelChange(e.target.value as TurbulenceModel)}
              className="w-full bg-white text-[#0F172A] border border-[#CBD5E1] rounded px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-[#2563EB] transition-colors"
            >
              <option value="k-omega-sst">Menter k-ω SST (Transonic Standard)</option>
              <option value="spalart-allmaras">Spalart-Allmaras 1-Equation (Aero)</option>
              <option value="k-epsilon-realizable">Realizable k-ε High-Re</option>
              <option value="laminar-ns">Laminar Full Navier-Stokes</option>
              <option value="inviscid-euler">Inviscid Compressible Euler</option>
            </select>
          </div>
        </div>

        {/* Operating Conditions: Mach Number */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-[#475569] flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Free-stream Mach Number (M∞)</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0.1"
                max="2.5"
                value={simulationState.mach}
                onChange={(e) => onMachChange(parseFloat(e.target.value) || 0.1)}
                className="w-16 bg-[#F1F5F9] border border-[#CBD5E1] rounded px-1.5 py-0.5 text-right font-mono text-xs text-[#0F172A] font-semibold focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
          <input
            type="range"
            min="0.10"
            max="2.20"
            step="0.01"
            value={simulationState.mach}
            onChange={(e) => onMachChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#94A3B8] mt-0.5">
            <span>0.10 Subsonic</span>
            <span className="text-[#2563EB] font-medium">0.80 Transonic</span>
            <span>2.20 Supersonic</span>
          </div>
        </div>

        {/* Angle of Attack (AoA) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-medium text-[#475569] flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>Angle of Attack (α)</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.5"
                min="-6.0"
                max="20.0"
                value={simulationState.aoa}
                onChange={(e) => onAoAChange(parseFloat(e.target.value) || 0)}
                className="w-16 bg-[#F1F5F9] border border-[#CBD5E1] rounded px-1.5 py-0.5 text-right font-mono text-xs text-[#0F172A] font-semibold focus:outline-none focus:border-[#2563EB]"
              />
              <span className="text-[#64748B] text-xs">deg</span>
            </div>
          </div>
          <input
            type="range"
            min="-5.0"
            max="18.0"
            step="0.25"
            value={simulationState.aoa}
            onChange={(e) => onAoAChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
          />
          {/* Quick preset buttons */}
          <div className="flex gap-1 mt-1.5">
            {[-2.0, 0.0, 2.0, 5.0, 10.0, 15.0].map((deg) => (
              <button
                key={deg}
                onClick={() => onAoAChange(deg)}
                className={`flex-1 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                  Math.abs(simulationState.aoa - deg) < 0.1
                    ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB] font-bold'
                    : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                {deg >= 0 ? `+${deg}°` : `${deg}°`}
              </button>
            ))}
          </div>
        </div>

        {/* 3-Axis Vector Inputs (X, Y, Z) - Spec requirement */}
        <div>
          <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
            Free-Stream Velocity Vector Direction (Normalized)
          </label>
          <div className="flex items-center rounded border border-[#E2E8F0] overflow-hidden bg-[#F1F5F9] focus-within:border-[#2563EB] transition-colors">
            {/* X component */}
            <div className="flex-1 flex items-center border-r border-[#E2E8F0] px-1.5 py-1">
              <span className="text-[10px] font-mono font-bold text-white bg-[#EF4444] px-1 rounded-xs mr-1.5">
                X
              </span>
              <input
                type="text"
                readOnly
                value={Math.cos((simulationState.aoa * Math.PI) / 180).toFixed(4)}
                className="w-full bg-transparent font-mono text-[11px] text-[#0F172A] focus:outline-none"
              />
            </div>
            {/* Y component */}
            <div className="flex-1 flex items-center border-r border-[#E2E8F0] px-1.5 py-1">
              <span className="text-[10px] font-mono font-bold text-white bg-[#10B981] px-1 rounded-xs mr-1.5">
                Y
              </span>
              <input
                type="text"
                readOnly
                value={Math.sin((simulationState.aoa * Math.PI) / 180).toFixed(4)}
                className="w-full bg-transparent font-mono text-[11px] text-[#0F172A] focus:outline-none"
              />
            </div>
            {/* Z component */}
            <div className="flex-1 flex items-center px-1.5 py-1">
              <span className="text-[10px] font-mono font-bold text-white bg-[#2563EB] px-1 rounded-xs mr-1.5">
                Z
              </span>
              <input
                type="text"
                readOnly
                value="0.0000"
                className="w-full bg-transparent font-mono text-[11px] text-[#0F172A] focus:outline-none"
              />
            </div>
          </div>
          <span className="text-[10px] text-[#94A3B8] font-mono block mt-0.5">
            Unit vector in wind-axes coordinate system
          </span>
        </div>

        {/* Solver Courant Number (CFL) & Reynolds */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[10px] font-medium text-[#475569] block mb-0.5">
              Courant (CFL)
            </label>
            <div className="flex items-center bg-[#F1F5F9] rounded border border-[#CBD5E1] px-1.5 py-1">
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="5.0"
                value={simulationState.cflNumber}
                onChange={(e) => onCflChange(parseFloat(e.target.value) || 1.0)}
                className="w-full bg-transparent font-mono text-xs text-[#0F172A] font-semibold focus:outline-none"
              />
              <span className="text-[10px] text-[#64748B] font-mono">step</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-[#475569] block mb-0.5">
              Reynolds (Re)
            </label>
            <div className="flex items-center bg-[#F1F5F9] rounded border border-[#CBD5E1] px-1.5 py-1">
              <input
                type="number"
                step="500000"
                min="500000"
                max="20000000"
                value={simulationState.reynolds}
                onChange={(e) => onReynoldsChange(parseInt(e.target.value, 10) || 3200000)}
                className="w-full bg-transparent font-mono text-xs text-[#0F172A] font-semibold focus:outline-none"
              />
              <span className="text-[10px] text-[#64748B] font-mono">1/c</span>
            </div>
          </div>
        </div>

        {/* Boundary Condition Badges (Solid 3px left border from design spec) */}
        <div>
          <label className="block text-[11px] font-semibold text-[#0F172A] mb-1.5">
            Boundary Condition Enforcements
          </label>
          <div className="space-y-1.5">
            {boundaryConditions.map((bc) => (
              <div
                key={bc.id}
                style={{ borderLeftColor: bc.color }}
                className="p-2 bg-white rounded-r border-y border-r border-[#E2E8F0] border-l-[3px] shadow-2xs hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0F172A] text-[11px]">{bc.name}</span>
                  <span
                    style={{ color: bc.color }}
                    className="font-mono text-[9px] uppercase font-bold"
                  >
                    Active
                  </span>
                </div>
                <div className="font-mono text-[10px] text-[#64748B] mt-0.5">{bc.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
