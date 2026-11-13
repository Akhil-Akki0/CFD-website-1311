import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ResidualSeriesPoint } from '../../utils/simulationComparison';

ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  Title,
  Tooltip,
  Legend
);

export interface LiveResidualLogChartHandle {
  toBase64Image: () => string;
}

interface LiveResidualLogChartProps {
  residuals: ResidualSeriesPoint[];
  isRunning?: boolean;
  maxIterations?: number;
  title?: string;
  height?: number;
}

const SERIES_CONFIG: {
  key: keyof ResidualSeriesPoint;
  fallbackKey?: keyof ResidualSeriesPoint;
  label: string;
  color: string;
  dashed?: boolean;
}[] = [
  { key: 'Ux', fallbackKey: 'xMomentum', label: 'Ux (X-Momentum)', color: '#2563EB' },
  { key: 'Uy', fallbackKey: 'yMomentum', label: 'Uy (Y-Momentum)', color: '#0284C7' },
  { key: 'Uz', label: 'Uz (Z-Momentum)', color: '#06B6D4', dashed: true },
  { key: 'p', fallbackKey: 'continuity', label: 'p (Continuity)', color: '#DC2626' },
  { key: 'k', fallbackKey: 'kTurbulence', label: 'k (Turb. Kinetic Energy)', color: '#059669' },
  { key: 'omega', fallbackKey: 'omegaDissipation', label: 'omega (Specific Diss.)', color: '#D97706', dashed: true },
  { key: 'h', label: 'h (Enthalpy / Energy)', color: '#9333EA', dashed: true },
];

export const LiveResidualLogChart = forwardRef<LiveResidualLogChartHandle, LiveResidualLogChartProps>(
  ({ residuals, isRunning = false, maxIterations = 500, title = 'OpenFOAM Logarithmic Residual Convergence (Ux, Uy, Uz, p, k, omega, h)', height = 240 }, ref) => {
    const chartRef = useRef<ChartJS<'line'> | null>(null);

    useImperativeHandle(ref, () => ({
      toBase64Image: () => {
        try {
          if (chartRef.current) {
            return chartRef.current.toBase64Image('image/png', 1);
          }
        } catch {}
        return '';
      },
    }));

    const hasLivePoints = residuals && residuals.length > 0;

    const chartData: ChartData<'line', { x: number; y: number }[]> = useMemo(() => {
      const source = hasLivePoints
        ? residuals
        : [
            { iteration: 0, Ux: 1.0, Uy: 1.0, Uz: 1.0, p: 1.0, k: 1.0, omega: 1.0, h: 1.0 },
          ];

      return {
        datasets: SERIES_CONFIG.map((cfg) => {
          const points = source
            .map((pt) => {
              const rawVal = pt[cfg.key] ?? (cfg.fallbackKey ? pt[cfg.fallbackKey] : undefined);
              if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || rawVal <= 0) {
                return null;
              }
              return {
                x: pt.iteration,
                y: Math.max(1e-8, Math.min(10, rawVal)),
              };
            })
            .filter((p): p is { x: number; y: number } => p !== null);

          return {
            label: cfg.label,
            data: points,
            borderColor: cfg.color,
            backgroundColor: cfg.color,
            borderWidth: 2,
            borderDash: cfg.dashed ? [4, 3] : undefined,
            pointRadius: points.length <= 24 ? 2.5 : 0,
            pointHoverRadius: 4,
            tension: 0.15,
            fill: false,
          };
        }),
      };
    }, [residuals, hasLivePoints]);

    const chartOptions: ChartOptions<'line'> = useMemo(
      () => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              boxHeight: 2,
              font: {
                family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                size: 10,
              },
              color: '#334155',
            },
          },
          title: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: (items) => (items[0] ? `Iteration ${items[0].parsed.x}` : ''),
              label: (ctx) => {
                const val = ctx.parsed.y;
                return `${ctx.dataset.label}: ${typeof val === 'number' ? val.toExponential(3) : '—'}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            suggestedMax: hasLivePoints ? undefined : Math.max(50, maxIterations),
            title: {
              display: true,
              text: 'Solver Iteration',
              font: { size: 10, weight: 'bold' },
              color: '#475569',
            },
            ticks: {
              font: { size: 10 },
              color: '#64748B',
              maxTicksLimit: 8,
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.18)',
            },
          },
          y: {
            type: 'logarithmic',
            min: 1e-7,
            max: 1,
            title: {
              display: true,
              text: 'Initial Residual (log10)',
              font: { size: 10, weight: 'bold' },
              color: '#475569',
            },
            ticks: {
              font: {
                family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                size: 10,
              },
              color: '#64748B',
              callback: (val) => {
                const num = Number(val);
                if (!Number.isFinite(num) || num <= 0) return '';
                const exp = Math.log10(num);
                if (Math.abs(exp - Math.round(exp)) < 1e-6) {
                  return `1e${Math.round(exp)}`;
                }
                return '';
              },
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.22)',
            },
          },
        },
      }),
      [hasLivePoints, maxIterations]
    );

    const latestPoint = hasLivePoints ? residuals[residuals.length - 1] : null;

    return (
      <div
        data-testid="live-residual-log-chart"
        className="h-full bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs flex flex-col justify-between gap-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#0F172A]">{title}</h3>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isRunning
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]'
                    : hasLivePoints
                    ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'
                }`}
              >
                {isRunning ? 'SSE STREAMING' : hasLivePoints ? `${residuals.length} ITERS` : 'AWAITING SOLVER'}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B]">
              {hasLivePoints
                ? `Latest Iteration ${latestPoint?.iteration ?? 0} — Target Convergence Threshold: 1e-4`
                : 'Live OpenFOAM residuals stream via SSE as soon as simpleFoam / chtMultiRegionSimpleFoam begins iterating.'}
            </p>
          </div>

          {latestPoint && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              {(['Ux', 'Uy', 'Uz', 'p', 'k', 'omega', 'h'] as const).map((field) => {
                const fallback =
                  field === 'Ux'
                    ? latestPoint.xMomentum
                    : field === 'Uy'
                    ? latestPoint.yMomentum
                    : field === 'p'
                    ? latestPoint.continuity
                    : field === 'k'
                    ? latestPoint.kTurbulence
                    : field === 'omega'
                    ? latestPoint.omegaDissipation
                    : undefined;
                const val = latestPoint[field] ?? fallback;
                if (typeof val !== 'number') return null;
                return (
                  <span
                    key={field}
                    className="px-1.5 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A]"
                  >
                    {field}: <strong>{val.toExponential(1)}</strong>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ minHeight: height }} className="relative w-full flex-1">
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </div>
      </div>
    );
  }
);

LiveResidualLogChart.displayName = 'LiveResidualLogChart';
export default LiveResidualLogChart;
