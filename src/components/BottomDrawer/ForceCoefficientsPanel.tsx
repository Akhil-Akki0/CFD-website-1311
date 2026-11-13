import React from 'react';
import { AeroCoefficients } from '../../types';
import { ShieldAlert, TrendingUp, Gauge, Compass } from 'lucide-react';

interface ForceCoefficientsPanelProps {
  coefficients: AeroCoefficients;
  mach: number;
  aoa: number;
}

export const ForceCoefficientsPanel: React.FC<ForceCoefficientsPanelProps> = ({
  coefficients,
  mach,
  aoa,
}) => {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between h-full gap-4 p-3 select-none overflow-y-auto">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
        {/* Lift Coefficient CL */}
        <div className="p-2.5 bg-[#F1F5F9] rounded border border-[#E2E8F0] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#475569]">
            <span className="text-[11px] font-semibold font-sans">Lift Coeff (CL)</span>
            <span className="text-[9px] font-mono text-[#2563EB] bg-[#EFF6FF] px-1 rounded">
              LIFT
            </span>
          </div>
          <div className="font-mono text-xl font-bold text-[#0F172A] tabular-nums my-1">
            {coefficients.cL >= 0 ? `+${coefficients.cL.toFixed(4)}` : coefficients.cL.toFixed(4)}
          </div>
          <span className="text-[10px] text-[#64748B] font-mono">
            {coefficients.cL > 0.8 ? 'High Lift Region' : 'Linear Thin Airfoil'}
          </span>
        </div>

        {/* Drag Coefficient CD */}
        <div className="p-2.5 bg-[#F1F5F9] rounded border border-[#E2E8F0] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#475569]">
            <span className="text-[11px] font-semibold font-sans">Total Drag (CD)</span>
            <span className="text-[9px] font-mono text-[#EF4444] bg-[#FEF2F2] px-1 rounded">
              DRAG
            </span>
          </div>
          <div className="font-mono text-xl font-bold text-[#0F172A] tabular-nums my-1">
            {coefficients.cD.toFixed(4)}
          </div>
          <span className="text-[10px] text-[#64748B] font-mono">
            Wave: {coefficients.cDp.toFixed(4)} | Skin: {coefficients.cDf.toFixed(4)}
          </span>
        </div>

        {/* Pitching Moment CM, c/4 */}
        <div className="p-2.5 bg-[#F1F5F9] rounded border border-[#E2E8F0] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#475569]">
            <span className="text-[11px] font-semibold font-sans">Pitch Moment (CM)</span>
            <span className="text-[9px] font-mono text-[#8B5CF6] bg-[#F5F3FF] px-1 rounded">
              c/4
            </span>
          </div>
          <div className="font-mono text-xl font-bold text-[#0F172A] tabular-nums my-1">
            {coefficients.cM.toFixed(4)}
          </div>
          <span className="text-[10px] text-[#64748B] font-mono">
            {coefficients.cM < 0 ? 'Nose-down stability' : 'Nose-up pitch'}
          </span>
        </div>

        {/* Aerodynamic Efficiency L/D */}
        <div className="p-2.5 bg-[#F1F5F9] rounded border border-[#E2E8F0] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#475569]">
            <span className="text-[11px] font-semibold font-sans">Efficiency (L/D)</span>
            <span className="text-[9px] font-mono text-[#10B981] bg-[#ECFDF5] px-1 rounded">
              GLIDE
            </span>
          </div>
          <div className="font-mono text-xl font-bold text-[#10B981] tabular-nums my-1">
            {coefficients.liftToDrag.toFixed(2)}
          </div>
          <span className="text-[10px] text-[#64748B] font-mono">
            {coefficients.liftToDrag > 20 ? 'Optimal Cruise Regime' : 'Off-design condition'}
          </span>
        </div>
      </div>

      {/* Drag Polar Breakdown Bar */}
      <div className="w-full md:w-64 shrink-0 bg-white border border-[#E2E8F0] rounded p-2.5 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F172A]">
          <span>Drag Budget Decomposition</span>
          <span className="font-mono text-[10px] text-[#64748B]">CD = {coefficients.cD.toFixed(4)}</span>
        </div>

        {/* Stacked Bar */}
        <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden flex">
          <div
            className="bg-[#2563EB] h-full"
            style={{ width: `${Math.min(90, (coefficients.cDp / coefficients.cD) * 100)}%` }}
            title="Form & Wave Pressure Drag"
          ></div>
          <div
            className="bg-[#06B6D4] h-full"
            style={{ width: `${Math.min(90, (coefficients.cDf / coefficients.cD) * 100)}%` }}
            title="Skin Friction Drag"
          ></div>
        </div>

        <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#2563EB]"></span>
            Pressure: {((coefficients.cDp / coefficients.cD) * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#06B6D4]"></span>
            Friction: {((coefficients.cDf / coefficients.cD) * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};
