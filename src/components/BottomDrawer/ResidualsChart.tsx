import React from 'react';
import { ResidualPoint } from '../../types';

interface ResidualsChartProps {
  residuals: ResidualPoint[];
  currentIteration: number;
}

export const ResidualsChart: React.FC<ResidualsChartProps> = ({ residuals, currentIteration }) => {
  const width = 640;
  const height = 150;
  const padding = { top: 12, right: 30, bottom: 22, left: 45 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Logarithmic scale from 10^0 (1.0) down to 10^-6 (0.000001)
  const logMin = -6;
  const logMax = 0;

  const yToPixel = (val: number) => {
    const logVal = Math.log10(Math.max(1e-6, Math.min(1.0, val)));
    const frac = (logVal - logMin) / (logMax - logMin);
    return padding.top + (1 - frac) * plotH;
  };

  const xToPixel = (iter: number, maxIter: number) => {
    const safeMax = Math.max(50, maxIter);
    return padding.left + (iter / safeMax) * plotW;
  };

  const maxIter = Math.max(100, currentIteration);

  // Generate SVG path for a residual series
  const makePath = (accessor: (r: ResidualPoint) => number) => {
    if (residuals.length === 0) return '';
    return residuals
      .map((r, i) => {
        const x = xToPixel(r.iteration, maxIter);
        const y = yToPixel(accessor(r));
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const latest = residuals[residuals.length - 1] || {
    continuity: 1.4e-5,
    xMomentum: 2.1e-5,
    yMomentum: 1.8e-5,
    kTurbulence: 8.4e-5,
    omegaDissipation: 4.2e-5,
  };

  return (
    <div className="flex flex-col md:flex-row items-stretch h-full gap-4 p-2.5 select-none font-mono">
      {/* Chart Canvas Area */}
      <div className="flex-1 relative flex flex-col justify-center min-w-0">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full max-h-[160px] overflow-visible"
        >
          {/* Background Grid Lines (10^-1 to 10^-6) */}
          {[-1, -2, -3, -4, -5, -6].map((p) => {
            const y = yToPixel(Math.pow(10, p));
            return (
              <g key={p}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={p === -5 ? '#CBD5E1' : '#EDF2F7'}
                  strokeDasharray={p === -5 ? '3 3' : undefined}
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94A3B8"
                >
                  10^{p}
                </text>
              </g>
            );
          })}

          {/* Convergence Criteria Line at 10^-5 */}
          <line
            x1={padding.left}
            y1={yToPixel(1e-5)}
            x2={width - padding.right}
            y2={yToPixel(1e-5)}
            stroke="#10B981"
            strokeDasharray="4 2"
            strokeWidth="1.2"
          />
          <text
            x={width - padding.right - 4}
            y={yToPixel(1e-5) - 3}
            textAnchor="end"
            fontSize="8"
            fill="#10B981"
            fontWeight="bold"
          >
            TARGET 10^-5
          </text>

          {/* X Axis & Labels */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#CBD5E1"
            strokeWidth="1"
          />
          {[0, Math.round(maxIter * 0.25), Math.round(maxIter * 0.5), Math.round(maxIter * 0.75), maxIter].map(
            (it, idx) => {
              const x = xToPixel(it, maxIter);
              return (
                <g key={idx}>
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
                    {it}
                  </text>
                </g>
              );
            }
          )}

          {/* Residual Paths */}
          {/* Continuity (Cobalt) */}
          <path
            d={makePath((r) => r.continuity)}
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.8"
          />
          {/* X-Momentum (Cyan) */}
          <path
            d={makePath((r) => r.xMomentum)}
            fill="none"
            stroke="#06B6D4"
            strokeWidth="1.5"
          />
          {/* Y-Momentum (Violet) */}
          <path
            d={makePath((r) => r.yMomentum)}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="1.5"
          />
          {/* k-Turbulence (Amber) */}
          <path
            d={makePath((r) => r.kTurbulence)}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="1.3"
          />
          {/* omega-Dissipation (Emerald) */}
          <path
            d={makePath((r) => r.omegaDissipation)}
            fill="none"
            stroke="#10B981"
            strokeWidth="1.3"
          />
        </svg>
      </div>

      {/* Residual Values Legend & Status */}
      <div className="w-full md:w-56 shrink-0 flex flex-col justify-center gap-1.5 border-t md:border-t-0 md:border-l border-[#E2E8F0] md:pl-4 text-xs">
        <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
          <span className="font-semibold text-[#0F172A] text-[11px] font-sans">
            RESIDUAL NORMS (L2)
          </span>
          <span className="text-[9px] px-1.5 py-0.2 bg-[#EFF6FF] text-[#2563EB] rounded font-bold">
            LOG10
          </span>
        </div>

        <div className="space-y-1 text-[11px] tabular-nums">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#475569]">
              <span className="w-2 h-2 rounded-xs bg-[#2563EB]"></span>
              Continuity (ρ)
            </span>
            <span className="font-bold text-[#0F172A]">
              {latest.continuity.toExponential(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#475569]">
              <span className="w-2 h-2 rounded-xs bg-[#06B6D4]"></span>
              X-Momentum (Ux)
            </span>
            <span className="font-bold text-[#0F172A]">
              {latest.xMomentum.toExponential(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#475569]">
              <span className="w-2 h-2 rounded-xs bg-[#8B5CF6]"></span>
              Y-Momentum (Uy)
            </span>
            <span className="font-bold text-[#0F172A]">
              {latest.yMomentum.toExponential(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#475569]">
              <span className="w-2 h-2 rounded-xs bg-[#F59E0B]"></span>
              Turbulent k
            </span>
            <span className="font-bold text-[#0F172A]">
              {latest.kTurbulence.toExponential(2)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#475569]">
              <span className="w-2 h-2 rounded-xs bg-[#10B981]"></span>
              Dissipation ω
            </span>
            <span className="font-bold text-[#0F172A]">
              {latest.omegaDissipation.toExponential(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
