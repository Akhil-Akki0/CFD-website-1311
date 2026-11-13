import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  PieChart as PieIcon,
  TrendingUp,
  BarChart2,
  Table as TableIcon,
  Plus,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle2,
  HelpCircle,
  Eye,
  Sliders,
  Maximize2
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';

export interface ResultRow {
  id: string;
  station: string;
  chordFraction: number; // x/c
  pressureKPa: number; // kPa
  cp: number; // Pressure coefficient
  velocity: number; // m/s
  mach: number;
  temperatureC: number; // °C
  shearStressPa: number; // Pa
  dragContributionN: number; // N
  liftContributionKN: number; // kN
}

interface LiveResultSheetDashboardProps {
  initialRows?: ResultRow[];
  projectName?: string;
  simulationId?: string;
  mach?: number;
  aoa?: number;
  cL?: number;
  cD?: number;
  liftToDrag?: number;
  materialName?: string;
  simulationMode?: 'aerodynamic_roughness' | 'conjugate_heat_transfer';
  maxSolidTemp?: number;
  heatFlux?: number;
  isCompact?: boolean;
}

const DEFAULT_ROWS: ResultRow[] = [
  { id: 'R1', station: 'Station 01 (Stagnation Point)', chordFraction: 0.00, pressureKPa: 124.6, cp: 1.00, velocity: 12.4, mach: 0.04, temperatureC: 42.1, shearStressPa: 8.5, dragContributionN: 48.2, liftContributionKN: 2.1 },
  { id: 'R2', station: 'Station 02 (LE Suction Peak)', chordFraction: 0.08, pressureKPa: 68.2, cp: -1.78, velocity: 342.1, mach: 1.01, temperatureC: 18.4, shearStressPa: 42.8, dragContributionN: 82.5, liftContributionKN: 18.4 },
  { id: 'R3', station: 'Station 03 (Upper Transonic Shock)', chordFraction: 0.22, pressureKPa: 74.1, cp: -1.25, velocity: 318.5, mach: 0.94, temperatureC: 22.0, shearStressPa: 38.1, dragContributionN: 114.2, liftContributionKN: 26.5 },
  { id: 'R4', station: 'Station 04 (Mid-Chord Suction Crest)', chordFraction: 0.40, pressureKPa: 86.4, cp: -0.68, velocity: 275.0, mach: 0.81, temperatureC: 26.5, shearStressPa: 28.4, dragContributionN: 68.4, liftContributionKN: 21.0 },
  { id: 'R5', station: 'Station 05 (Aft Adverse Pressure)', chordFraction: 0.65, pressureKPa: 95.8, cp: -0.24, velocity: 232.0, mach: 0.68, temperatureC: 29.8, shearStressPa: 18.2, dragContributionN: 54.0, liftContributionKN: 14.2 },
  { id: 'R6', station: 'Station 06 (Trailing Edge Recovery)', chordFraction: 0.92, pressureKPa: 102.5, cp: 0.08, velocity: 198.4, mach: 0.58, temperatureC: 31.2, shearStressPa: 9.6, dragContributionN: 38.6, liftContributionKN: 5.8 },
  { id: 'R7', station: 'Station 07 (Lower LE Ramp)', chordFraction: 0.12, pressureKPa: 112.4, cp: 0.48, velocity: 210.0, mach: 0.62, temperatureC: 34.6, shearStressPa: 22.4, dragContributionN: 44.5, liftContributionKN: 8.9 },
  { id: 'R8', station: 'Station 08 (Lower Flat Mid-Panel)', chordFraction: 0.50, pressureKPa: 106.2, cp: 0.22, velocity: 228.0, mach: 0.67, temperatureC: 32.1, shearStressPa: 20.1, dragContributionN: 49.0, liftContributionKN: 11.2 },
  { id: 'R9', station: 'Station 09 (Near Wake Core)', chordFraction: 1.15, pressureKPa: 101.3, cp: 0.00, velocity: 220.0, mach: 0.65, temperatureC: 30.5, shearStressPa: 4.2, dragContributionN: 24.0, liftContributionKN: 0.8 },
];

export const LiveResultSheetDashboard: React.FC<LiveResultSheetDashboardProps> = ({
  initialRows = DEFAULT_ROWS,
  projectName = 'RIMZ High-Capability Aerodynamic Run',
  simulationId = 'RIMZ-RUN-2606',
  mach = 0.68,
  aoa = 3.5,
  cL = 0.584,
  cD = 0.0138,
  liftToDrag = 42.3,
  materialName,
  simulationMode,
  maxSolidTemp,
  heatFlux,
  isCompact = false,
}) => {
  const [rows, setRows] = useState<ResultRow[]>(initialRows);
  const [activeTab, setActiveTab] = useState<'excel' | 'pie' | 'normal' | 'all'>('all');
  const [chartMetric, setChartMetric] = useState<keyof ResultRow>('pressureKPa');
  const [pieMode, setPieMode] = useState<'drag' | 'airload' | 'cooling'>('drag');
  const [normalMode, setNormalMode] = useState<'cp' | 'convergence' | 'polar'>('cp');
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [filterText, setFilterText] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Filtered rows for Excel sheet
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter((r) => r.station.toLowerCase().includes(lower) || r.id.toLowerCase().includes(lower));
  }, [rows, filterText]);

  // Statistical Excel Formulas calculated live
  const stats = useMemo(() => {
    if (rows.length === 0) return { avgP: 0, maxP: 0, minP: 0, maxVel: 0, sumDrag: 0, sumLift: 0, avgTemp: 0 };
    const avgP = rows.reduce((acc, r) => acc + r.pressureKPa, 0) / rows.length;
    const maxP = Math.max(...rows.map((r) => r.pressureKPa));
    const minP = Math.min(...rows.map((r) => r.pressureKPa));
    const maxVel = Math.max(...rows.map((r) => r.velocity));
    const sumDrag = rows.reduce((acc, r) => acc + r.dragContributionN, 0);
    const sumLift = rows.reduce((acc, r) => acc + r.liftContributionKN, 0);
    const avgTemp = rows.reduce((acc, r) => acc + r.temperatureC, 0) / rows.length;
    return { avgP, maxP, minP, maxVel, sumDrag, sumLift, avgTemp };
  }, [rows]);

  // Handle cell edit
  const handleCellChange = (id: string, field: keyof ResultRow, value: string) => {
    const num = parseFloat(value);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            [field]: isNaN(num) ? r[field] : num,
          };
        }
        return r;
      })
    );
  };

  // Export to CSV / Excel spreadsheet
  const handleExportCsv = () => {
    sound.playSave();
    const headers = [
      'Row ID',
      'Inspection Station / Zone',
      'Chord Fraction (x/c)',
      'Pressure (kPa)',
      'Pressure Coefficient Cp',
      'Airflow Velocity (m/s)',
      'Local Mach #',
      'Skin Temp (°C)',
      'Wall Shear Stress (Pa)',
      'Drag Contribution (N)',
      'Lift Contribution (kN)',
    ];

    const lines = rows.map((r) => [
      r.id,
      `"${r.station}"`,
      r.chordFraction.toFixed(3),
      r.pressureKPa.toFixed(2),
      r.cp.toFixed(3),
      r.velocity.toFixed(1),
      r.mach.toFixed(2),
      r.temperatureC.toFixed(1),
      r.shearStressPa.toFixed(1),
      r.dragContributionN.toFixed(1),
      r.liftContributionKN.toFixed(2),
    ]);

    const csvContent =
      `# RIMZ AERODYNAMIC LIVE RESULT SHEET - OFFICIAL TELEMETRY REPORT\n` +
      `# Project: ${projectName} | Simulation ID: ${simulationId} | Mach: ${mach} | AoA: ${aoa}°\n` +
      `# Formula Summary: AVERAGE(Pressure)=${stats.avgP.toFixed(2)} kPa, MAX(Velocity)=${stats.maxVel.toFixed(1)} m/s, SUM(Drag)=${stats.sumDrag.toFixed(1)} N\n` +
      headers.join(',') +
      '\n' +
      lines.map((l) => l.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RIMZ_Live_Result_Sheet_${simulationId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3500);
  };

  // Pie Chart Slices Configuration
  const pieData = useMemo(() => {
    if (pieMode === 'drag') {
      const form = Math.max(10, stats.sumDrag * 0.58);
      const friction = Math.max(8, stats.sumDrag * 0.28);
      const induced = Math.max(5, stats.sumDrag * 0.11);
      const wave = Math.max(2, stats.sumDrag * 0.03);
      const total = form + friction + induced + wave;
      return [
        { label: 'Form Pressure Drag (C_Dp)', value: form, percent: (form / total) * 100, color: '#2563EB' },
        { label: 'Skin Friction Drag (C_Df)', value: friction, percent: (friction / total) * 100, color: '#06B6D4' },
        { label: 'Induced Vortex Drag (C_Di)', value: induced, percent: (induced / total) * 100, color: '#10B981' },
        { label: 'Wave Shockwave Drag (C_Dw)', value: wave, percent: (wave / total) * 100, color: '#F59E0B' },
      ];
    } else if (pieMode === 'airload') {
      return [
        { label: 'Wing Suction Side', value: 48, percent: 48.0, color: '#3B82F6' },
        { label: 'Wing Pressure Bottom', value: 32, percent: 32.0, color: '#10B981' },
        { label: 'Fuselage & Radome', value: 12, percent: 12.0, color: '#8B5CF6' },
        { label: 'Empennage / Stabilizers', value: 8, percent: 8.0, color: '#F97316' },
      ];
    } else {
      return [
        { label: 'Convective Ram Air Extraction', value: 52, percent: 52.0, color: '#06B6D4' },
        { label: 'Surface Radiative Dissipation', value: 30, percent: 30.0, color: '#6366F1' },
        { label: 'Active Liquid Chiller Cooling', value: 18, percent: 18.0, color: '#14B8A6' },
      ];
    }
  }, [pieMode, stats.sumDrag]);

  // Compute SVG arc coordinates for the Pie Chart
  const pieSlices = useMemo(() => {
    let cumulative = 0;
    return pieData.map((slice) => {
      const startAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
      cumulative += slice.percent;
      const endAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
      const largeArc = slice.percent > 50 ? 1 : 0;

      const rOuter = 82;
      const rInner = 44;
      const x1Outer = 100 + rOuter * Math.cos(startAngle);
      const y1Outer = 100 + rOuter * Math.sin(startAngle);
      const x2Outer = 100 + rOuter * Math.cos(endAngle);
      const y2Outer = 100 + rOuter * Math.sin(endAngle);

      const x1Inner = 100 + rInner * Math.cos(endAngle);
      const y1Inner = 100 + rInner * Math.sin(endAngle);
      const x2Inner = 100 + rInner * Math.cos(startAngle);
      const y2Inner = 100 + rInner * Math.sin(startAngle);

      const pathData = `
        M ${x1Outer} ${y1Outer}
        A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}
        L ${x1Inner} ${y1Inner}
        A ${rInner} ${rInner} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}
        Z
      `;

      return {
        ...slice,
        pathData,
      };
    });
  }, [pieData]);

  // Normal Chart Data Calculation
  const normalChartData = useMemo(() => {
    if (normalMode === 'cp') {
      // Sort by chord
      const upper = rows.filter((r) => r.cp <= 0).sort((a, b) => a.chordFraction - b.chordFraction);
      const lower = rows.filter((r) => r.cp > 0).sort((a, b) => a.chordFraction - b.chordFraction);
      return { upper, lower };
    } else if (normalMode === 'convergence') {
      // 10 synthetic iterations converging
      const iters = Array.from({ length: 12 }, (_, i) => {
        const it = (i + 1) * 45;
        const cont = Math.max(1e-5, 0.08 * Math.pow(0.5, i * 0.95));
        const uRes = Math.max(1.2e-5, 0.06 * Math.pow(0.48, i * 0.92));
        const kRes = Math.max(8e-6, 0.04 * Math.pow(0.52, i * 0.88));
        return { iteration: it, continuity: cont, momentum: uRes, kTurb: kRes };
      });
      return { iters };
    } else {
      // Polar AoA sweep
      const polar = Array.from({ length: 11 }, (_, i) => {
        const a = -2 + i * 2;
        const clVal = 0.11 * a + 0.15;
        const cdVal = 0.008 + 0.0018 * Math.pow(a - 1.5, 2);
        return { aoa: a, cl: clVal, cd: cdVal, ld: clVal / Math.max(0.001, cdVal) };
      });
      return { polar };
    }
  }, [normalMode, rows]);

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-sky-300/40 dark:border-white/10 shadow-xl p-4 sm:p-6 space-y-6 select-none transition-all">
      {/* Top Header & Mode Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  RIMZ Live Result Sheet & Dynamic Visual Charts
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300/50">
                  LIVE EXCEL ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Synchronized real-time tabular engineering spreadsheet, linked bar/line excel chart, interactive drag pie chart, and Navier-Stokes polar curve.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Navigation Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => { sound.playTick(); setActiveTab('all'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Views
            </button>
            <button
              onClick={() => { sound.playTick(); setActiveTab('excel'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'excel'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Live Excel Sheet</span>
            </button>
            <button
              onClick={() => { sound.playTick(); setActiveTab('pie'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pie'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Pie Chart</span>
            </button>
            <button
              onClick={() => { sound.playTick(); setActiveTab('normal'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'normal'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Normal Chart</span>
            </button>
          </div>

          {/* Export to Excel Button */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel Sheet</span>
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Telemetry spreadsheet successfully compiled with all formula cells and downloaded to your computer!</span>
          </div>
          <span className="font-mono text-[10px] font-bold uppercase">XLSX READY</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">AVERAGE PRESSURE</span>
          <span className="text-lg font-mono font-black text-slate-900 dark:text-white">{stats.avgP.toFixed(1)} <span className="text-xs font-normal">kPa</span></span>
          <span className="text-[10px] text-sky-600 font-mono block">=AVERAGE(C2:C10)</span>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">PEAK STAGNATION</span>
          <span className="text-lg font-mono font-black text-blue-600 dark:text-blue-400">{stats.maxP.toFixed(1)} <span className="text-xs font-normal">kPa</span></span>
          <span className="text-[10px] text-blue-600 font-mono block">=MAX(Pressure)</span>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">MAX AIR VELOCITY</span>
          <span className="text-lg font-mono font-black text-teal-600 dark:text-teal-400">{stats.maxVel.toFixed(1)} <span className="text-xs font-normal">m/s</span></span>
          <span className="text-[10px] text-teal-600 font-mono block">Mach {(stats.maxVel / 340.29).toFixed(2)}</span>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">INTEGRATED DRAG</span>
          <span className="text-lg font-mono font-black text-rose-600 dark:text-rose-400">{stats.sumDrag.toFixed(1)} <span className="text-xs font-normal">N</span></span>
          <span className="text-[10px] text-rose-600 font-mono block">=SUM(DragCol)</span>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">TOTAL LIFT FORCE</span>
          <span className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">{stats.sumLift.toFixed(1)} <span className="text-xs font-normal">kN</span></span>
          <span className="text-[10px] text-emerald-600 font-mono block">C_L = {cL.toFixed(3)}</span>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">AVG SKIN TEMP</span>
          <span className="text-lg font-mono font-black text-amber-600 dark:text-amber-400">{stats.avgTemp.toFixed(1)} <span className="text-xs font-normal">°C</span></span>
          <span className="text-[10px] text-amber-600 font-mono block">Aerodynamic Heating</span>
        </div>
      </div>

      {(materialName || maxSolidTemp !== undefined || heatFlux !== undefined) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Solid Metal Alloy</span>
            <strong className="text-slate-900 dark:text-white">{materialName || 'Aluminum 6061-T6'}</strong>
            <span className="text-[10px] text-sky-600 block">
              {simulationMode === 'conjugate_heat_transfer' ? 'chtMultiRegionSimpleFoam' : 'simpleFoam (nutkRoughWallFunction)'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Drag Coefficient (Cd)</span>
            <strong className="text-blue-600 dark:text-blue-400">{cD.toFixed(4)}</strong>
          </div>
          {simulationMode === 'conjugate_heat_transfer' && (
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] text-orange-600 uppercase block">Max Solid Temp</span>
                <strong className="text-orange-700 dark:text-orange-400">{maxSolidTemp ?? '—'} K</strong>
              </div>
              <div>
                <span className="text-[10px] text-orange-600 uppercase block">Wall Heat Flux</span>
                <strong className="text-orange-700 dark:text-orange-400">{heatFlux ?? '—'} W/m²</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHARTS ROW (PIE CHART + NORMAL CHART + LIVE EXCEL CHART) */}
      {(activeTab === 'all' || activeTab === 'pie' || activeTab === 'normal') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 1. LIVE PIE CHART (Interactive SVG) */}
          {(activeTab === 'all' || activeTab === 'pie') && (
            <div className={`${activeTab === 'pie' ? 'lg:col-span-12' : 'lg:col-span-5'} bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Live Dynamic Pie Chart
                  </h3>
                </div>

                {/* Pie Mode Selector */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    onClick={() => { sound.playTick(); setPieMode('drag'); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${pieMode === 'drag' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xs' : 'text-slate-500'}`}
                  >
                    Drag
                  </button>
                  <button
                    onClick={() => { sound.playTick(); setPieMode('airload'); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${pieMode === 'airload' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xs' : 'text-slate-500'}`}
                  >
                    Airload
                  </button>
                  <button
                    onClick={() => { sound.playTick(); setPieMode('cooling'); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${pieMode === 'cooling' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-xs' : 'text-slate-500'}`}
                  >
                    Cooling
                  </button>
                </div>
              </div>

              {/* Pie SVG Rendering with Center Label */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    {pieSlices.map((slice, i) => (
                      <path
                        key={i}
                        d={slice.pathData}
                        fill={slice.color}
                        className="transition-all duration-300 hover:opacity-85 cursor-pointer"
                        onMouseEnter={() => setHoveredPoint({ ...slice, type: 'pie' })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        <title>{`${slice.label}: ${slice.percent.toFixed(1)}%`}</title>
                      </path>
                    ))}
                  </svg>
                  {/* Donut Center Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {pieMode === 'drag' ? 'TOTAL DRAG' : pieMode === 'airload' ? 'TOTAL LIFT' : 'HEAT SINK'}
                    </span>
                    <span className="text-sm font-black font-mono text-slate-800 dark:text-white">
                      {pieMode === 'drag' ? `${stats.sumDrag.toFixed(1)} N` : pieMode === 'airload' ? `${stats.sumLift.toFixed(1)} kN` : '100%'}
                    </span>
                  </div>
                </div>

                {/* Slices Legend */}
                <div className="space-y-2 flex-1 w-full text-xs">
                  {pieData.map((slice, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: slice.color }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px] sm:max-w-none">
                          {slice.label}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0 ml-2">
                        {slice.percent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. LIVE NORMAL CHART (SVG Line & Area Chart) */}
          {(activeTab === 'all' || activeTab === 'normal') && (
            <div className={`${activeTab === 'normal' ? 'lg:col-span-12' : 'lg:col-span-7'} bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Live Normal Engineering Chart
                  </h3>
                </div>

                {/* Normal Chart Mode Selector */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    onClick={() => { sound.playTick(); setNormalMode('cp'); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${normalMode === 'cp' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-xs' : 'text-slate-500'}`}
                  >
                    -Cp vs x/c
                  </button>
                  <button
                    onClick={() => { sound.playTick(); setNormalMode('convergence'); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${normalMode === 'convergence' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-xs' : 'text-slate-500'}`}
                  >
                    Residuals
                  </button>
                  <button
                    onClick={() => { sound.playTick(); setNormalMode('polar'); }}
                    className={`px-2 py-0.5 rounded cursor-pointer ${normalMode === 'polar' ? 'bg-white dark:bg-slate-800 text-purple-600 shadow-xs' : 'text-slate-500'}`}
                  >
                    Lift Polar
                  </button>
                </div>
              </div>

              {/* Chart Canvas / SVG */}
              <div className="w-full h-52 relative flex items-center justify-center bg-slate-900 text-white rounded-xl p-3 overflow-hidden border border-slate-800">
                <svg viewBox="0 0 500 200" className="w-full h-full">
                  {/* Grid lines */}
                  <line x1="40" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3 3" />
                  <line x1="40" y1="65" x2="480" y2="65" stroke="#334155" strokeDasharray="3 3" />
                  <line x1="40" y1="110" x2="480" y2="110" stroke="#334155" strokeDasharray="3 3" />
                  <line x1="40" y1="155" x2="480" y2="155" stroke="#334155" strokeDasharray="3 3" />
                  <line x1="40" y1="180" x2="480" y2="180" stroke="#475569" strokeWidth="1.5" />
                  <line x1="40" y1="20" x2="40" y2="180" stroke="#475569" strokeWidth="1.5" />

                  {/* Mode 1: -Cp distribution */}
                  {normalMode === 'cp' && (
                    <>
                      {/* Upper surface line (Suction) */}
                      <path
                        d="M 45 60 Q 90 25 150 45 T 260 90 T 380 140 T 460 170"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="2.5"
                      />
                      {/* Lower surface line (Compression) */}
                      <path
                        d="M 45 60 Q 110 130 200 150 T 340 165 T 460 170"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2.5"
                      />
                      {/* Points */}
                      {rows.map((r, i) => {
                        const px = 45 + r.chordFraction * 380;
                        const py = 110 - r.cp * 45;
                        return (
                          <circle
                            key={i}
                            cx={Math.min(470, Math.max(45, px))}
                            cy={Math.min(175, Math.max(25, py))}
                            r="4.5"
                            fill={r.cp < 0 ? '#38BDF8' : '#F59E0B'}
                            stroke="#0F172A"
                            strokeWidth="1.5"
                            className="cursor-pointer hover:scale-150 transition-transform"
                          >
                            <title>{`${r.station}: Cp = ${r.cp.toFixed(3)} at x/c = ${r.chordFraction}`}</title>
                          </circle>
                        );
                      })}
                    </>
                  )}

                  {/* Mode 2: Residuals decay */}
                  {normalMode === 'convergence' && (
                    <>
                      {/* Continuity residual */}
                      <path
                        d="M 45 35 Q 120 70 200 110 T 360 145 T 470 165"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.5"
                      />
                      {/* Momentum residual */}
                      <path
                        d="M 45 45 Q 140 85 240 125 T 390 155 T 470 170"
                        fill="none"
                        stroke="#60A5FA"
                        strokeWidth="2"
                      />
                    </>
                  )}

                  {/* Mode 3: Lift polar */}
                  {normalMode === 'polar' && (
                    <>
                      {/* CL vs CD curve */}
                      <path
                        d="M 60 160 Q 160 140 280 80 T 400 40 T 470 60"
                        fill="none"
                        stroke="#A855F7"
                        strokeWidth="3"
                      />
                    </>
                  )}
                </svg>

                {/* Live Chart Legend & Metrics */}
                <div className="absolute top-2 right-3 flex items-center gap-3 bg-slate-950/80 px-2.5 py-1 rounded-md text-[10px] font-mono border border-slate-800">
                  {normalMode === 'cp' && (
                    <>
                      <span className="flex items-center gap-1 text-sky-400">
                        <span className="w-2 h-2 rounded-full bg-sky-400"></span> Upper Suction
                      </span>
                      <span className="flex items-center gap-1 text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span> Lower Pressure
                      </span>
                    </>
                  )}
                  {normalMode === 'convergence' && (
                    <>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Continuity 1e-5
                      </span>
                      <span className="flex items-center gap-1 text-blue-400">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span> X-Momentum 1e-5
                      </span>
                    </>
                  )}
                  {normalMode === 'polar' && (
                    <span className="flex items-center gap-1 text-purple-400">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span> L/D Max = {liftToDrag.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. LIVE EXCEL BAR CHART (Linked directly to spreadsheet columns) */}
      {(activeTab === 'all' || activeTab === 'excel') && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Live Excel Chart (Linked to Spreadsheet Grid)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Instant visual bar graph automatically recalculated from the table rows below.
                </p>
              </div>
            </div>

            {/* Metric selector to chart */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Column to Chart:</span>
              <select
                value={chartMetric}
                onChange={(e) => { sound.playTick(); setChartMetric(e.target.value as any); }}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="pressureKPa">Pressure (kPa)</option>
                <option value="cp">Pressure Coeff (Cp)</option>
                <option value="velocity">Velocity (m/s)</option>
                <option value="temperatureC">Temperature (°C)</option>
                <option value="dragContributionN">Drag Contribution (N)</option>
                <option value="liftContributionKN">Lift Contribution (kN)</option>
              </select>
            </div>
          </div>

          {/* Dynamic Linked Bars */}
          <div className="h-44 flex items-end gap-2 sm:gap-4 px-2 py-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            {rows.map((row) => {
              const val = row[chartMetric] as number;
              const maxVal = Math.max(...rows.map((r) => Math.abs(r[chartMetric] as number))) || 1;
              const heightPct = Math.min(100, Math.max(12, (Math.abs(val) / maxVal) * 90));

              return (
                <div key={row.id} className="flex-1 flex flex-col items-center gap-1 min-w-[36px] group">
                  <span className="text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400 group-hover:text-emerald-500 transition-colors">
                    {val.toFixed(1)}
                  </span>
                  <div className="w-full h-28 flex items-end justify-center">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 cursor-pointer ${
                        val < 0
                          ? 'bg-gradient-to-t from-rose-600 to-rose-400'
                          : 'bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300'
                      }`}
                      title={`${row.station}: ${val} ${chartMetric === 'pressureKPa' ? 'kPa' : chartMetric === 'velocity' ? 'm/s' : ''}`}
                    />
                  </div>
                  <span className="text-[9px] font-mono font-semibold text-slate-500 truncate max-w-[44px]">
                    {row.id}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. INTERACTIVE LIVE EXCEL SPREADSHEET TABLE */}
      {(activeTab === 'all' || activeTab === 'excel') && (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Live Engineering Result Sheet (Editable Cells)
              </h3>
              <span className="text-xs text-slate-500">
                ({filteredRows.length} rows recorded)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter stations..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none w-36 sm:w-44"
              />
              <button
                onClick={() => {
                  sound.playTick();
                  const newId = `R${rows.length + 1}`;
                  setRows((prev) => [
                    ...prev,
                    {
                      id: newId,
                      station: `Station 0${rows.length + 1} (Custom Point)`,
                      chordFraction: 0.5,
                      pressureKPa: 101.3,
                      cp: 0.0,
                      velocity: 250.0,
                      mach: 0.73,
                      temperatureC: 28.0,
                      shearStressPa: 15.0,
                      dragContributionN: 45.0,
                      liftContributionKN: 10.0,
                    },
                  ]);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
              <button
                onClick={() => { sound.playTick(); setRows(DEFAULT_ROWS); }}
                title="Reset to benchmark baseline"
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[380px] scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 z-10">
                <tr>
                  <th className="py-2.5 px-3 font-mono">Row</th>
                  <th className="py-2.5 px-3 min-w-[160px]">Station / Point</th>
                  <th className="py-2.5 px-3 font-mono">x/c</th>
                  <th className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400">P (kPa)</th>
                  <th className="py-2.5 px-3 font-mono text-purple-600 dark:text-purple-400">Cp</th>
                  <th className="py-2.5 px-3 font-mono text-teal-600 dark:text-teal-400">V (m/s)</th>
                  <th className="py-2.5 px-3 font-mono">Mach</th>
                  <th className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">T (°C)</th>
                  <th className="py-2.5 px-3 font-mono">Shear (Pa)</th>
                  <th className="py-2.5 px-3 font-mono text-rose-600 dark:text-rose-400">Drag (N)</th>
                  <th className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400">Lift (kN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-mono">
                {filteredRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-400">{r.id}</td>
                    <td className="py-2 px-3 font-sans font-medium text-slate-900 dark:text-white">
                      {r.station}
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="0.05"
                        value={r.chordFraction}
                        onChange={(e) => handleCellChange(r.id, 'chordFraction', e.target.value)}
                        className="w-16 px-1.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="1"
                        value={r.pressureKPa}
                        onChange={(e) => handleCellChange(r.id, 'pressureKPa', e.target.value)}
                        className="w-20 px-1.5 py-0.5 font-bold text-blue-600 dark:text-blue-400 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="0.05"
                        value={r.cp}
                        onChange={(e) => handleCellChange(r.id, 'cp', e.target.value)}
                        className={`w-16 px-1.5 py-0.5 font-bold ${r.cp < 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-300'} bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none`}
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="5"
                        value={r.velocity}
                        onChange={(e) => handleCellChange(r.id, 'velocity', e.target.value)}
                        className="w-20 px-1.5 py-0.5 text-teal-600 dark:text-teal-400 font-bold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="0.02"
                        value={r.mach}
                        onChange={(e) => handleCellChange(r.id, 'mach', e.target.value)}
                        className="w-16 px-1.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="1"
                        value={r.temperatureC}
                        onChange={(e) => handleCellChange(r.id, 'temperatureC', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-amber-600 dark:text-amber-400 font-bold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="1"
                        value={r.shearStressPa}
                        onChange={(e) => handleCellChange(r.id, 'shearStressPa', e.target.value)}
                        className="w-16 px-1.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="5"
                        value={r.dragContributionN}
                        onChange={(e) => handleCellChange(r.id, 'dragContributionN', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-rose-600 dark:text-rose-400 font-bold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        step="1"
                        value={r.liftContributionKN}
                        onChange={(e) => handleCellChange(r.id, 'liftContributionKN', e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400 font-bold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 rounded focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Excel Formulas Footer Row */}
              <tfoot className="bg-slate-100 dark:bg-slate-900 font-mono font-bold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 text-xs uppercase tracking-wider text-slate-500">
                    EXCEL FORMULAS TOTALS:
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-[10px]">AVG</td>
                  <td className="py-2.5 px-3 text-blue-600 dark:text-blue-400">
                    {stats.avgP.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">avg</span>
                  </td>
                  <td className="py-2.5 px-3 text-purple-600 dark:text-purple-400">
                    {rows.length > 0 ? (rows.reduce((acc, r) => acc + r.cp, 0) / rows.length).toFixed(2) : '0.00'}
                  </td>
                  <td className="py-2.5 px-3 text-teal-600 dark:text-teal-400">
                    {stats.maxVel.toFixed(1)} <span className="text-[9px] text-slate-400 font-normal">max</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">
                    {mach.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-amber-600 dark:text-amber-400">
                    {stats.avgTemp.toFixed(1)}°C
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">-</td>
                  <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400">
                    {stats.sumDrag.toFixed(1)} N
                  </td>
                  <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">
                    {stats.sumLift.toFixed(1)} kN
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
