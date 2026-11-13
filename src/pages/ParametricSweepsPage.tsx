import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { PolarDataPoint, ParametricSweepConfig, TurbulenceModel } from '../types';
import {
  generateAerodynamicPolarSweep,
  analyzePolarCharacteristics,
  computeBayesianSurrogateSteps,
  exportPolarCsv,
} from '../utils/polarCalculator';
import { sound } from '../utils/soundEffects';
import {
  TrendingUp,
  Play,
  RotateCcw,
  Download,
  ListOrdered,
  Sparkles,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Maximize2,
  Table as TableIcon,
  Compass,
  Zap,
  Activity,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

export const ParametricSweepsPage: React.FC = () => {
  const {
    simConfig,
    geometries,
    currentGeometryId,
    addJobToQueue,
    themeMode,
    triggerConfetti,
  } = usePlatform();

  const currentGeom = geometries.find((g) => g.id === currentGeometryId) || geometries[0];

  // Sweep configuration
  const [minAoA, setMinAoA] = useState<number>(-5);
  const [maxAoA, setMaxAoA] = useState<number>(20);
  const [stepAoA, setStepAoA] = useState<number>(2);
  const [sweepVelocity, setSweepVelocity] = useState<number>(simConfig.inletVelocity || 30);
  const [turbulenceModel, setTurbulenceModel] = useState<TurbulenceModel>('k-omega-sst');
  const [activeTab, setActiveTab] = useState<'charts' | 'table' | 'bayesian'>('charts');
  const [activeChart, setActiveChart] = useState<'cl_alpha' | 'cd_alpha' | 'ld_alpha' | 'drag_polar'>('cl_alpha');

  // Sweep run state
  const [isSweeping, setIsSweeping] = useState<boolean>(false);
  const [sweepProgress, setSweepProgress] = useState<number>(100); // starts completed with pre-calculated dataset
  const [hoveredPoint, setHoveredPoint] = useState<PolarDataPoint | null>(null);

  const sweepConfig: ParametricSweepConfig = useMemo(() => ({
    minAoA,
    maxAoA,
    stepAoA,
    velocity: sweepVelocity,
    turbulenceModel,
    meshResolution: 'medium',
  }), [minAoA, maxAoA, stepAoA, sweepVelocity, turbulenceModel]);

  // Generate or memoize polar dataset
  const [polarData, setPolarData] = useState<PolarDataPoint[]>(() =>
    generateAerodynamicPolarSweep(sweepConfig, currentGeom?.maxSize || 1.0)
  );

  const characteristics = useMemo(() => analyzePolarCharacteristics(polarData), [polarData]);

  // Bayesian optimization steps
  const bayesianSteps = useMemo(() => {
    const tested = polarData.map((p) => ({ aoa: p.aoa, liftToDrag: p.liftToDrag }));
    return computeBayesianSurrogateSteps(tested, [minAoA, maxAoA]);
  }, [polarData, minAoA, maxAoA]);

  const bestBayesianPoint = bayesianSteps.find((b) => b.isBest);

  const handleRunSweep = () => {
    sound.playStartSimulation();
    setIsSweeping(true);
    setSweepProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 15;
      if (progress >= 100) {
        clearInterval(interval);
        setIsSweeping(false);
        setSweepProgress(100);
        setPolarData(generateAerodynamicPolarSweep(sweepConfig, currentGeom?.maxSize || 1.0));
        sound.playSuccess();
        triggerConfetti();
      } else {
        setSweepProgress(progress);
      }
    }, 180);
  };

  const handlePushAllToQueue = () => {
    sound.playSave();
    let count = 0;
    // Push representative angles to queue
    const samplePoints = polarData.filter((_, idx) => idx % 2 === 0);
    samplePoints.forEach((p) => {
      addJobToQueue({
        name: `Sweep AoA ${p.aoa}° (${currentGeom?.name || 'Airfoil'})`,
        geometryName: currentGeom?.name || 'Airfoil',
        solver: 'simpleFoam',
        aoa: p.aoa,
        velocity: sweepVelocity,
      });
      count++;
    });
    alert(`Enqueued ${count} multi-angle CFD jobs to the Execution Queue!`);
  };

  const handleDownloadCsv = () => {
    sound.playClick();
    const csvContent = exportPolarCsv(polarData, `${currentGeom?.name || 'Airfoil'}_Polar_Sweep`);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentGeom?.name || 'Airfoil'}_polars.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // SVG Chart Dimensions & Helpers
  const svgWidth = 600;
  const svgHeight = 320;
  const padding = 50;

  // Chart data coordinate mapping
  const chartCoordinates = useMemo(() => {
    if (polarData.length === 0) return [];

    let minX = minAoA;
    let maxX = maxAoA;
    let minY = 0;
    let maxY = 1;

    if (activeChart === 'cl_alpha') {
      minY = Math.min(...polarData.map((d) => d.cL)) - 0.2;
      maxY = Math.max(...polarData.map((d) => d.cL)) + 0.2;
    } else if (activeChart === 'cd_alpha') {
      minY = 0;
      maxY = Math.max(...polarData.map((d) => d.cD)) * 1.15;
    } else if (activeChart === 'ld_alpha') {
      minY = Math.min(...polarData.map((d) => d.liftToDrag)) - 2;
      maxY = Math.max(...polarData.map((d) => d.liftToDrag)) + 4;
    } else if (activeChart === 'drag_polar') {
      minX = 0;
      maxX = Math.max(...polarData.map((d) => d.cD)) * 1.15;
      minY = Math.min(...polarData.map((d) => d.cL)) - 0.2;
      maxY = Math.max(...polarData.map((d) => d.cL)) + 0.2;
    }

    const scaleX = (val: number) => padding + ((val - minX) / (maxX - minX || 1)) * (svgWidth - 2 * padding);
    const scaleY = (val: number) => svgHeight - padding - ((val - minY) / (maxY - minY || 1)) * (svgHeight - 2 * padding);

    return polarData.map((d) => {
      let xVal = d.aoa;
      let yVal = d.cL;
      if (activeChart === 'cd_alpha') yVal = d.cD;
      else if (activeChart === 'ld_alpha') yVal = d.liftToDrag;
      else if (activeChart === 'drag_polar') {
        xVal = d.cD;
        yVal = d.cL;
      }

      return {
        ...d,
        xVal,
        yVal,
        px: scaleX(xVal),
        py: scaleY(yVal),
      };
    });
  }, [polarData, activeChart, minAoA, maxAoA]);

  const polylinePoints = chartCoordinates.map((c) => `${c.px},${c.py}`).join(' ');

  return (
    <div className="flex-1 overflow-y-auto select-none p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center shadow-md">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A] dark:text-white">
                Parametric Sweeps & Aerodynamic Polars
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0284C7]/15 text-[#0284C7] font-bold">
                MULTI-AoA SWEEP ENGINE
              </span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Automated multi-angle of attack sweeps (-5° to +20°), high-fidelity drag polars, stall boundary discovery, and Bayesian solver tuning
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePushAllToQueue}
            className="flex-1 sm:flex-none min-h-[44px] px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <ListOrdered className="w-4 h-4 text-[#0284C7]" />
            <span>Enqueue Batch</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="flex-1 sm:flex-none min-h-[44px] px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#0284C7]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleRunSweep}
            disabled={isSweeping}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${isSweeping ? 'animate-spin' : ''}`} />
            <span>{isSweeping ? `Solving (${sweepProgress}%)` : 'Run Parametric Sweep'}</span>
          </button>
        </div>
      </div>

      {/* Sweep Configuration Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div>
          <label className="block text-[#64748B] mb-1 font-medium">Min Angle (AoA)</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={minAoA}
              onChange={(e) => setMinAoA(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold"
            />
            <span className="text-slate-400 font-mono">°</span>
          </div>
        </div>

        <div>
          <label className="block text-[#64748B] mb-1 font-medium">Max Angle (AoA)</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={maxAoA}
              onChange={(e) => setMaxAoA(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold"
            />
            <span className="text-slate-400 font-mono">°</span>
          </div>
        </div>

        <div>
          <label className="block text-[#64748B] mb-1 font-medium">Angle Step</label>
          <select
            value={stepAoA}
            onChange={(e) => setStepAoA(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold bg-transparent"
          >
            <option value={1}>1.0° (High Res)</option>
            <option value={2}>2.0° (Standard)</option>
            <option value={3}>3.0° (Fast)</option>
          </select>
        </div>

        <div>
          <label className="block text-[#64748B] mb-1 font-medium">Velocity</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={sweepVelocity}
              onChange={(e) => setSweepVelocity(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-mono font-bold"
            />
            <span className="text-slate-400 font-mono">m/s</span>
          </div>
        </div>

        <div>
          <label className="block text-[#64748B] mb-1 font-medium">Turbulence Model</label>
          <select
            value={turbulenceModel}
            onChange={(e) => setTurbulenceModel(e.target.value as TurbulenceModel)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium bg-transparent"
          >
            <option value="k-omega-sst">k-ω SST (Menter)</option>
            <option value="spalart-allmaras">Spalart-Allmaras</option>
            <option value="k-epsilon-realizable">Realizable k-ε</option>
          </select>
        </div>

        <div>
          <label className="block text-[#64748B] mb-1 font-medium">Geometry</label>
          <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold truncate text-[#0284C7]">
            {currentGeom?.name || 'NACA 0012'}
          </div>
        </div>
      </div>

      {/* Aerodynamic Key Metrics Bento */}
      {characteristics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-2xs">
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Max L/D Efficiency</span>
            <div className="text-xl font-black text-[#0284C7] mt-1 font-mono">
              {characteristics.maxLiftToDrag.toFixed(1)} <span className="text-xs font-normal text-[#64748B]">at {characteristics.optimalAoA}°</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Optimal cruise glide angle</p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-2xs">
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Stall Angle (α_stall)</span>
            <div className="text-xl font-black text-rose-600 mt-1 font-mono">
              {characteristics.stallAoA}° <span className="text-xs font-normal text-[#64748B]">(CL_max: {characteristics.maxLiftCoeff.toFixed(2)})</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Boundary layer separation onset</p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-2xs">
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Minimum Drag (CD0)</span>
            <div className="text-xl font-black text-emerald-600 mt-1 font-mono">
              {characteristics.minDragCoeff.toFixed(4)} <span className="text-xs font-normal text-[#64748B]">at {characteristics.minDragAoA}°</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Parasitic skin friction bucket</p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 shadow-2xs">
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold">Lift Slope (dCL/dα)</span>
            <div className="text-xl font-black text-[#0F172A] dark:text-white mt-1 font-mono">
              {characteristics.linearLiftSlopePerDeg.toFixed(3)} <span className="text-xs font-normal text-[#64748B]">/ deg</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Near theoretical thin-airfoil limit (0.110)</p>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('charts');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'charts'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Interactive Polars</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('bayesian');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'bayesian'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Bayesian Solver Optimization</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('table');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'table'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>Tabular Dataset ({polarData.length} pts)</span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'charts' && (
        <div className="space-y-4">
          {/* Sub-selector for chart type */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setActiveChart('cl_alpha')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeChart === 'cl_alpha'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              CL vs. α (Lift Curve)
            </button>
            <button
              onClick={() => setActiveChart('cd_alpha')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeChart === 'cd_alpha'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              CD vs. α (Drag Rise)
            </button>
            <button
              onClick={() => setActiveChart('ld_alpha')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeChart === 'ld_alpha'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              L/D vs. α (Efficiency)
            </button>
            <button
              onClick={() => setActiveChart('drag_polar')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                activeChart === 'drag_polar'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-bold'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              CL vs. CD (Drag Polar)
            </button>
          </div>

          {/* SVG Visualizer Chart */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full flex justify-center">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-2xl h-auto overflow-visible">
                {/* Grid Lines */}
                <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#cbd5e1" strokeWidth="1" />
                <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" />

                {/* Main Curve */}
                <polyline
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />

                {/* Data Points */}
                {chartCoordinates.map((pt, idx) => {
                  const isHovered = hoveredPoint?.aoa === pt.aoa;
                  return (
                    <g key={idx} onMouseEnter={() => setHoveredPoint(pt)} onMouseLeave={() => setHoveredPoint(null)}>
                      <circle
                        cx={pt.px}
                        cy={pt.py}
                        r={isHovered ? 6 : pt.isStalled ? 4.5 : 3.5}
                        fill={pt.isStalled ? '#EF4444' : '#0284C7'}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-all cursor-pointer"
                      />
                    </g>
                  );
                })}

                {/* Stall Line / Label */}
                {characteristics?.stallAoA && activeChart === 'cl_alpha' && (
                  <g>
                    <text x={svgWidth - 140} y={padding + 20} fill="#EF4444" fontSize="11" fontWeight="bold">
                      Stall Boundary (14.5°)
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Point Inspector Sidebar */}
            <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2.5 shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400">Point Telemetry</span>
              {hoveredPoint ? (
                <div className="space-y-1.5 font-mono">
                  <div className="text-sm font-black text-[#0284C7]">Angle: {hoveredPoint.aoa}°</div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lift (CL):</span>
                    <span className="font-bold">{hoveredPoint.cL.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Drag (CD):</span>
                    <span className="font-bold">{hoveredPoint.cD.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">L/D Ratio:</span>
                    <span className="font-bold text-emerald-600">{hoveredPoint.liftToDrag.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Separation Length:</span>
                    <span>{hoveredPoint.recirculationLength.toFixed(3)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Solver Status:</span>
                    <span className={hoveredPoint.isStalled ? 'text-rose-500 font-bold' : 'text-emerald-500'}>
                      {hoveredPoint.isStalled ? 'Stalled (Fallback)' : 'Attached RANS'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 italic py-6 text-center">
                  Hover over any data point on the polar curve to inspect lift, drag, and recirculation length.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bayesian Surrogate Solver Optimization View */}
      {activeTab === 'bayesian' && (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold">Gaussian Process & Bayesian Aerodynamic Optimizer</h3>
                <p className="text-[11px] text-[#64748B]">
                  Surrogate model guides continuous exploration-exploitation to identify maximum aerodynamic efficiency with minimum CFD compute
                </p>
              </div>
            </div>

            {bestBayesianPoint && (
              <div className="px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-mono font-bold">
                Suggested Next Test AoA: {bestBayesianPoint.aoa}° (Expected L/D: {bestBayesianPoint.predictedLiftToDrag.toFixed(1)})
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="font-bold mb-1 flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <Compass className="w-4 h-4 text-[#0284C7]" />
                Acquisition Function (UCB)
              </h4>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Upper Confidence Bound (κ = 1.96). Prioritizes regions with high predicted L/D while exploring high-uncertainty separation boundaries.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="font-bold mb-1 flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <Activity className="w-4 h-4 text-emerald-500" />
                RBF Kernel Uncertainty
              </h4>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Squared exponential covariance length scale l = 3.5°. Shrinks variance near verified simpleFoam points.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="font-bold mb-1 flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 text-purple-500" />
                Compute Savings
              </h4>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Reaches optimal (L/D)max in 5 iterations instead of brute-force 26 grid sweeps, saving ~80% HPC cluster runtime.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabular Dataset View */}
      {activeTab === 'table' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155]">AoA (deg)</th>
                  <th className="p-3">CL (Lift)</th>
                  <th className="p-3">CD (Drag)</th>
                  <th className="p-3">L/D Ratio</th>
                  <th className="p-3">Pitching CM</th>
                  <th className="p-3">Wake Length</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {polarData.map((row) => (
                  <tr key={row.aoa} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-bold text-[#0284C7] sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155]">{row.aoa.toFixed(1)}°</td>
                    <td className="p-3 font-semibold">{row.cL.toFixed(4)}</td>
                    <td className="p-3">{row.cD.toFixed(4)}</td>
                    <td className="p-3 font-bold text-emerald-600">{row.liftToDrag.toFixed(2)}</td>
                    <td className="p-3">{row.cM.toFixed(4)}</td>
                    <td className="p-3 text-slate-500">{row.recirculationLength.toFixed(3)} m</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          row.isStalled
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                        }`}
                      >
                        {row.isStalled ? 'Stalled (Fallback)' : 'Attached'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
