import React, { useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import {
  PieChart,
  Radar,
  FileSpreadsheet,
  Download,
  Info,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { downloadProjectExcel } from '../../utils/excelGenerator';
import { sound } from '../../utils/soundEffects';

interface ProjectSpyChartProps {
  title?: string;
  showExportButton?: boolean;
  className?: string;
  compact?: boolean;
}

export const ProjectSpyChart: React.FC<ProjectSpyChartProps> = ({
  title = 'Live Project Spy & Performance Telemetry',
  showExportButton = true,
  className = '',
  compact = false,
}) => {
  const { projects, simulations, currentProjectId, currentSimulationId, simConfig, triggerConfetti } = usePlatform();
  const [activeTab, setActiveTab] = useState<'spy' | 'pie' | 'both'>('both');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const currentProj = projects.find((p) => p.projectId === currentProjectId) || projects[0];
  const activeSim = simulations.find((s) => s.simulationId === currentSimulationId) || simulations[0];

  // Portfolio Distribution Breakdown for Pie Chart
  const statusCounts = {
    completed: simulations.filter((s) => s.status === 'completed').length,
    running: simulations.filter((s) => s.status === 'running' || s.status === 'meshing').length,
    queued: simulations.filter((s) => s.status === 'queued').length,
    draft: simulations.filter((s) => s.status === 'draft' || s.status === 'meshed').length,
  };
  const totalCases = simulations.length || 1;

  const pieSlices = [
    { id: 'completed', label: 'Completed Studies', count: Math.max(statusCounts.completed, 1), color: '#059669', percent: Math.round(((statusCounts.completed || 1) / totalCases) * 100) },
    { id: 'running', label: 'Active Solvers', count: statusCounts.running, color: '#0284c7', percent: Math.round((statusCounts.running / totalCases) * 100) },
    { id: 'queued', label: 'Queued Jobs', count: statusCounts.queued, color: '#d97706', percent: Math.round((statusCounts.queued / totalCases) * 100) },
    { id: 'draft', label: 'Draft Geometries', count: statusCounts.draft, color: '#64748b', percent: Math.round((statusCounts.draft / totalCases) * 100) },
  ].filter(s => s.count > 0 || s.id === 'completed');

  // Multi-axis Radar / Spy Chart Metrics (values 0 - 100%)
  const spyAxes = [
    { label: 'Aerodynamic (L/D)', score: 92, value: '38.2', unit: 'L/D' },
    { label: 'Convergence Stability', score: 96, value: '1e-5', unit: 'tol' },
    { label: 'Mesh Orthogonality', score: 88, value: '0.88', unit: 'min' },
    { label: 'Stall Margin', score: 84, value: '+4.5°', unit: 'α_stall' },
    { label: 'Pressure Recovery', score: 90, value: '94%', unit: 'rec' },
    { label: 'y+ Wall Resolution', score: 95, value: '0.92', unit: 'y+' },
  ];

  // Compute SVG Radar Polygon Coordinates
  const centerX = 120;
  const centerY = 110;
  const radius = 75;
  const numAxes = spyAxes.length;

  const getCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2;
    const r = radius * valueRatio;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const polygonPoints = spyAxes
    .map((axis, i) => {
      const { x, y } = getCoordinates(i, axis.score / 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Compute SVG Pie Slices
  let cumulativeAngle = -Math.PI / 2;
  const pieCenter = { x: 100, y: 100 };
  const pieRadius = 68;

  const piePaths = pieSlices.map((slice) => {
    const sliceAngle = (slice.count / totalCases) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + sliceAngle;
    cumulativeAngle = endAngle;

    const x1 = pieCenter.x + pieRadius * Math.cos(startAngle);
    const y1 = pieCenter.y + pieRadius * Math.sin(startAngle);
    const x2 = pieCenter.x + pieRadius * Math.cos(endAngle);
    const y2 = pieCenter.y + pieRadius * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathData = `M ${pieCenter.x} ${pieCenter.y} L ${x1} ${y1} A ${pieRadius} ${pieRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...slice, pathData };
  });

  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      sound.playSave();
      downloadProjectExcel({
        projectName: currentProj?.name || 'Aerospace-Study',
        projectId: currentProj?.projectId || 'PROJ-01',
        simulationId: activeSim?.simulationId || 'SIM-CASE-01',
        solver: activeSim?.solver || 'simpleFoam (OpenFOAM v2606)',
        airfoilName: activeSim?.projectName || 'NACA 0012 Airfoil',
        mach: 0.35,
        aoa: 3.5,
        reynolds: 3e6,
        inletVelocity: simConfig?.inletVelocity || 45.0,
        cl: activeSim?.metrics?.cL || 0.584,
        cd: activeSim?.metrics?.cD || 0.0138,
        cm: -0.042,
        liftToDrag: activeSim?.metrics?.liftToDrag || 42.3,
        iterations: activeSim?.iterations || 500,
        maxIterations: 500,
        meshCells: activeSim?.meshCells || 412000,
      });
      triggerConfetti();
    } catch (err) {
      console.error('Failed to export Project Excel:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`glass-surface rounded-3xl border border-white/60 dark:border-white/10 shadow-xl p-5 text-slate-900 dark:text-slate-100 backdrop-blur-md ${className}`}>
      {/* Header with Title, Mode Switcher & Direct Excel Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/40 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 flex items-center justify-center border border-cyan-400/40 shadow-xs">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-slate-950 dark:text-white flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-400/40">
                LIVE
              </span>
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Live multi-axis aerodynamics spy radar &amp; portfolio distribution telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Filter Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-white/40 dark:bg-slate-800/50 border border-white/50 dark:border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                activeTab === 'both'
                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Dual View
            </button>
            <button
              onClick={() => setActiveTab('spy')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                activeTab === 'spy'
                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Spy Radar
            </button>
            <button
              onClick={() => setActiveTab('pie')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                activeTab === 'pie'
                  ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Pie Chart
            </button>
          </div>

          {/* Excel Export Button */}
          {showExportButton && (
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              title="Download Project Telemetry & Result Sheet in Excel (.xls)"
              aria-label="Export Project to Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Excel Result Sheet</span>
              <span className="sm:hidden">Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Visual Telemetry Body */}
      <div className={`mt-4 grid gap-6 ${activeTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* View 1: Project Aerodynamics Spy (Radar) Chart */}
        {(activeTab === 'both' || activeTab === 'spy') && (
          <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-white/30 dark:bg-slate-900/40 border border-white/50 dark:border-white/10">
            <div className="w-full flex items-center justify-between pb-2 border-b border-white/30 dark:border-white/10">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Aerodynamic Performance Spy Chart</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/30">
                Index: 91.2%
              </span>
            </div>

            <div className="relative my-2 w-full flex items-center justify-center">
              <svg width="240" height="220" viewBox="0 0 240 220" className="overflow-visible select-none">
                {/* Background Concentric Radar Rings */}
                {[0.25, 0.5, 0.75, 1.0].map((ringRatio, idx) => {
                  const ringPoints = spyAxes
                    .map((_, i) => {
                      const { x, y } = getCoordinates(i, ringRatio);
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');
                  return (
                    <polygon
                      key={`ring-${idx}`}
                      points={ringPoints}
                      fill={idx === 3 ? 'rgba(2, 132, 199, 0.04)' : 'none'}
                      stroke="rgba(148, 163, 184, 0.35)"
                      strokeWidth="1"
                      strokeDasharray={idx < 3 ? '2 2' : 'none'}
                    />
                  );
                })}

                {/* Axis Radial Spokes */}
                {spyAxes.map((_, i) => {
                  const end = getCoordinates(i, 1.0);
                  return (
                    <line
                      key={`spoke-${i}`}
                      x1={centerX}
                      y1={centerY}
                      x2={end.x}
                      y2={end.y}
                      stroke="rgba(148, 163, 184, 0.4)"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Filled Radar Spy Polygon */}
                <polygon
                  points={polygonPoints}
                  fill="rgba(6, 182, 212, 0.28)"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                  className="transition-all duration-300"
                />

                {/* Axis Node Dots */}
                {spyAxes.map((axis, i) => {
                  const { x, y } = getCoordinates(i, axis.score / 100);
                  return (
                    <circle
                      key={`node-${i}`}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:r-5 transition-all"
                    >
                      <title>{`${axis.label}: ${axis.score}% (${axis.value} ${axis.unit})`}</title>
                    </circle>
                  );
                })}

                {/* Labels Around the Spy Chart */}
                {spyAxes.map((axis, i) => {
                  const end = getCoordinates(i, 1.25);
                  return (
                    <text
                      key={`label-${i}`}
                      x={end.x}
                      y={end.y + 3}
                      textAnchor="middle"
                      className="text-[9px] font-sans font-bold fill-slate-700 dark:fill-slate-300"
                    >
                      {axis.label.split(' ')[0]}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Metrics legend grid */}
            <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t border-white/30 dark:border-white/10 text-[10px]">
              {spyAxes.slice(0, 3).map((a, i) => (
                <div key={i} className="text-center p-1 rounded-xl bg-white/40 dark:bg-slate-800/40 border border-white/40 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 block truncate">{a.label}</span>
                  <strong className="font-mono text-cyan-800 dark:text-cyan-300">{a.value} {a.unit}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View 2: Live Project Portfolio Pie Chart */}
        {(activeTab === 'both' || activeTab === 'pie') && (
          <div className="flex flex-col items-center justify-between p-4 rounded-2xl bg-white/30 dark:bg-slate-900/40 border border-white/50 dark:border-white/10">
            <div className="w-full flex items-center justify-between pb-2 border-b border-white/30 dark:border-white/10">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Simulation Study Distribution Pie Chart</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                {totalCases} Total Cases
              </span>
            </div>

            <div className="relative my-3 flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
              {/* SVG Donut / Pie Chart */}
              <div className="relative">
                <svg width="200" height="200" viewBox="0 0 200 200" className="select-none overflow-visible">
                  {piePaths.map((slice) => {
                    const isHovered = hoveredSlice === slice.id;
                    return (
                      <path
                        key={slice.id}
                        d={slice.pathData}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                        opacity={hoveredSlice && !isHovered ? 0.6 : 0.95}
                        className="cursor-pointer transition-all duration-200 hover:opacity-100"
                        onMouseEnter={() => setHoveredSlice(slice.id)}
                        onMouseLeave={() => setHoveredSlice(null)}
                      >
                        <title>{`${slice.label}: ${slice.count} case(s) (${slice.percent}%)`}</title>
                      </path>
                    );
                  })}
                  {/* Central Donut Hole for Modern Metric Display */}
                  <circle cx={pieCenter.x} cy={pieCenter.y} r="38" fill="rgba(255, 255, 255, 0.85)" stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
                  <text
                    x={pieCenter.x}
                    y={pieCenter.y - 4}
                    textAnchor="middle"
                    className="text-[10px] font-bold fill-slate-500 uppercase tracking-wider"
                  >
                    Cases
                  </text>
                  <text
                    x={pieCenter.x}
                    y={pieCenter.y + 14}
                    textAnchor="middle"
                    className="text-base font-black font-mono fill-slate-900"
                  >
                    {totalCases}
                  </text>
                </svg>
              </div>

              {/* Pie Slices Legend */}
              <div className="flex flex-col gap-2 min-w-[160px]">
                {pieSlices.map((slice) => (
                  <div
                    key={slice.id}
                    onMouseEnter={() => setHoveredSlice(slice.id)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className={`flex items-center justify-between p-1.5 rounded-xl text-xs transition-all cursor-pointer ${
                      hoveredSlice === slice.id ? 'bg-white/60 dark:bg-slate-800/80 shadow-xs' : 'hover:bg-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate">{slice.label}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px] pl-2">
                      {slice.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Insight */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-white/30 dark:border-white/10 text-[10px] text-slate-600 dark:text-slate-400">
              <span>Primary Solver: <strong className="font-mono text-cyan-800 dark:text-cyan-300">OpenFOAM simpleFoam</strong></span>
              <span>Mesh: <strong className="font-mono">Hex-Dominant</strong></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectSpyChart;
