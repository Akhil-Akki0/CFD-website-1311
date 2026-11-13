import React from 'react';
import { AirfoilPresetId } from '../../types';
import { getCpDistribution } from '../../utils/airfoilPhysics';

interface CpDistributionPlotProps {
  presetId: AirfoilPresetId;
  mach: number;
  aoa: number;
}

export const CpDistributionPlot: React.FC<CpDistributionPlotProps> = ({
  presetId,
  mach,
  aoa,
}) => {
  const points = getCpDistribution(presetId, mach, aoa);

  const width = 640;
  const height = 150;
  const padding = { top: 14, right: 30, bottom: 24, left: 45 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Aerodynamic convention: -Cp is UPWARD (top is -2.5, bottom is +1.2)
  const cpMin = -2.5; // Top of chart
  const cpMax = 1.0;  // Bottom of chart

  const cpToY = (cp: number) => {
    // Invert: cpMin maps to top, cpMax maps to bottom
    const clamped = Math.max(cpMin, Math.min(cpMax, cp));
    const frac = (clamped - cpMin) / (cpMax - cpMin);
    return padding.top + frac * plotH;
  };

  const xToPixel = (x: number) => {
    return padding.left + x * plotW;
  };

  // Paths
  const upperPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToPixel(p.x).toFixed(1)} ${cpToY(p.cpUpper).toFixed(1)}`)
    .join(' ');

  const lowerPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToPixel(p.x).toFixed(1)} ${cpToY(p.cpLower).toFixed(1)}`)
    .join(' ');

  // Peak suction point
  const peakSuction = points.reduce(
    (min, p) => (p.cpUpper < min.cpUpper ? p : min),
    points[0]
  );

  return (
    <div className="flex flex-col md:flex-row items-stretch h-full gap-4 p-2.5 select-none font-mono">
      <div className="flex-1 relative flex flex-col justify-center min-w-0">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full max-h-[160px] overflow-visible"
        >
          {/* Background Grid Lines for Cp (-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0) */}
          {[-2.0, -1.0, 0.0, 1.0].map((val) => {
            const y = cpToY(val);
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={val === 0 ? '#CBD5E1' : '#EDF2F7'}
                  strokeDasharray={val === 0 ? '2 2' : undefined}
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94A3B8"
                >
                  {val >= 0 && val !== 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* X Axis at bottom */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#CBD5E1"
            strokeWidth="1"
          />
          {[0.0, 0.2, 0.4, 0.6, 0.8, 1.0].map((xc) => {
            const x = xToPixel(xc);
            return (
              <g key={xc}>
                <line
                  x1={x}
                  y1={height - padding.bottom}
                  x2={x}
                  y2={height - padding.bottom + 4}
                  stroke="#94A3B8"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 13}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#64748B"
                >
                  {xc.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Axis Titles */}
          <text
            x={padding.left}
            y={padding.top - 3}
            fontSize="9"
            fill="#64748B"
            fontWeight="bold"
          >
            -Cp (Suction ↑)
          </text>
          <text
            x={width - padding.right}
            y={height - padding.bottom + 13}
            fontSize="9"
            fill="#64748B"
            textAnchor="end"
          >
            x/c
          </text>

          {/* Upper Surface Curve (Cobalt) */}
          <path d={upperPath} fill="none" stroke="#2563EB" strokeWidth="2" />

          {/* Lower Surface Curve (Cyan dashed) */}
          <path
            d={lowerPath}
            fill="none"
            stroke="#06B6D4"
            strokeWidth="1.8"
            strokeDasharray="4 2"
          />

          {/* Suction Peak Dot */}
          <circle
            cx={xToPixel(peakSuction.x)}
            cy={cpToY(peakSuction.cpUpper)}
            r="3"
            fill="#EF4444"
          />
          <text
            x={xToPixel(peakSuction.x) + 5}
            y={cpToY(peakSuction.cpUpper) - 3}
            fontSize="8"
            fill="#EF4444"
            fontWeight="bold"
          >
            Cp,min {peakSuction.cpUpper.toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Side Legend & Peak Readouts */}
      <div className="w-full md:w-56 shrink-0 flex flex-col justify-center gap-1.5 border-t md:border-t-0 md:border-l border-[#E2E8F0] md:pl-4 text-xs">
        <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
          <span className="font-semibold text-[#0F172A] text-[11px] font-sans">
            SURFACE PRESSURE (Cp)
          </span>
          <span className="text-[9px] px-1.5 py-0.2 bg-[#EFF6FF] text-[#2563EB] rounded font-bold">
            -Cp UP
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] tabular-nums">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#475569]">
              <span className="w-2 h-2 rounded-xs bg-[#2563EB]"></span>
              Upper (Suction)
            </span>
            <span className="font-bold text-[#0F172A]">
              Cp,min: {peakSuction.cpUpper.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#475569]">
              <span className="w-2 h-2 rounded-xs bg-[#06B6D4]"></span>
              Lower (Pressure)
            </span>
            <span className="font-bold text-[#0F172A]">
              Stag: +1.00
            </span>
          </div>

          <div className="p-1.5 bg-[#F1F5F9] rounded border border-[#E2E8F0] text-[10px] text-[#64748B]">
            Enclosed loop area represents total inviscid normal force coefficient (Cn ~ Cl).
          </div>
        </div>
      </div>
    </div>
  );
};
