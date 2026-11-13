import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckSquare,
  Download,
  FileText,
  GitCompareArrows,
  Minus,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react';
import { CfdLogo } from '../components/common/CfdLogo';
import { usePlatform } from '../context/PlatformContext';
import {
  deleteSimulationHistoryEntry,
  loadSimulationHistory,
  resetSimulationHistoryDefaults,
} from '../services/simulationHistoryService';
import {
  buildComparisonMatrix,
  formatDeltaBadge,
  SimulationHistoryEntry,
} from '../utils/simulationComparison';
import { generateSimulationPdfReport } from '../utils/pdfGenerator';
import { sound } from '../utils/soundEffects';

export const HistoryComparisonPage: React.FC = () => {
  const { setPage, triggerConfetti } = usePlatform();
  const [runs, setRuns] = useState<SimulationHistoryEntry[]>(() => loadSimulationHistory());
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const initial = loadSimulationHistory();
    return initial.slice(0, 2).map((r) => r.id);
  });
  const [baselineId, setBaselineId] = useState<string>(() => {
    const initial = loadSimulationHistory();
    return initial[0]?.id || '';
  });
  const [filterQuery, setFilterQuery] = useState('');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const filteredRuns = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter(
      (r) =>
        r.projectName.toLowerCase().includes(q) ||
        r.material.name.toLowerCase().includes(q) ||
        r.solver.toLowerCase().includes(q)
    );
  }, [runs, filterQuery]);

  const selectedRuns = useMemo(() => {
    return runs.filter((r) => selectedIds.includes(r.id));
  }, [runs, selectedIds]);

  const effectiveBaselineId = useMemo(() => {
    if (selectedIds.includes(baselineId)) return baselineId;
    return selectedRuns[0]?.id || '';
  }, [baselineId, selectedIds, selectedRuns]);

  const matrix = useMemo(() => {
    if (selectedRuns.length < 2) return [];
    return buildComparisonMatrix(selectedRuns, effectiveBaselineId);
  }, [selectedRuns, effectiveBaselineId]);

  const toggleSelectRun = (id: string) => {
    sound.playTick();
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleDeleteRun = (id: string) => {
    sound.playTick();
    const updated = deleteSimulationHistoryEntry(id);
    setRuns(updated);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleResetSeeds = () => {
    sound.playTick();
    const updated = resetSimulationHistoryDefaults();
    setRuns(updated);
    setSelectedIds(updated.slice(0, 2).map((r) => r.id));
    setBaselineId(updated[0]?.id || '');
  };

  const handleExportRunPdf = async (entry: SimulationHistoryEntry) => {
    setIsExporting(entry.id);
    sound.playSave();
    try {
      await generateSimulationPdfReport(
        {
          simulationId: entry.caseId || entry.id,
          projectId: entry.id,
          projectName: entry.projectName,
          solver: entry.solver,
          status: 'completed',
          completedAt: entry.timestamp,
          executionTime: entry.executionTime,
          iterations: entry.iterations,
          meshCells: entry.meshCells,
          metrics: {
            maxVelocity: entry.metrics.maxVelocity,
            minVelocity: 0,
            avgVelocity: Number((entry.metrics.maxVelocity * 0.68).toFixed(2)),
            maxPressure: entry.metrics.maxPressure,
            minPressure: entry.metrics.minPressure ?? 100500,
            pressureDrop: Math.abs(entry.metrics.maxPressure - (entry.metrics.minPressure ?? 100500)),
            cL: entry.metrics.cL,
            cD: entry.metrics.cD,
            liftToDrag: entry.metrics.liftToDrag,
            materialName: entry.material.name,
            simulationMode: entry.simulationMode,
            maxSolidTemp: entry.metrics.maxSolidTemp ?? undefined,
            heatFlux: entry.metrics.heatFlux ?? undefined,
            wheelRpm: entry.wheelRpm ?? 0,
            meshHealth: entry.meshHealth ?? undefined,
          },
          availableFields: ['Velocity Magnitude', 'Pressure Field'],
          config: {
            projectId: entry.id,
            solver: entry.solver as any,
            simulationMode: entry.simulationMode,
            parallelMode: entry.parallelMode,
            solidWallTemperature: entry.solidWallTemperature,
            material: entry.material as any,
            inletVelocity: entry.inletVelocity,
            inletAngle: entry.inletAngle,
            outletPressure: 0,
            wallCondition: 'no_slip',
            fluid: {
              type: entry.fluid.type as any,
              density: entry.fluid.density,
              viscosity: entry.fluid.viscosity,
              temperature: entry.fluid.temperature,
              pressure: 101325,
            },
            mesh: {
              resolution: 'medium',
              baseCellSizeMm: 12,
              inflationLayers: 18,
              growthRate: 1.18,
              firstCellHeightMm: 0.012,
              estimatedCells: entry.meshCells,
            },
            solverSettings: {
              maxIterations: entry.iterations,
              convergenceTolerance: 1e-5,
              cflNumber: 1.0,
              multigridLevels: 3,
            },
          },
        },
        {
          projectId: entry.id,
          solver: entry.solver as any,
          simulationMode: entry.simulationMode,
          parallelMode: entry.parallelMode,
          solidWallTemperature: entry.solidWallTemperature,
          material: entry.material as any,
          inletVelocity: entry.inletVelocity,
          inletAngle: entry.inletAngle,
          outletPressure: 0,
          wallCondition: 'no_slip',
          fluid: {
            type: entry.fluid.type as any,
            density: entry.fluid.density,
            viscosity: entry.fluid.viscosity,
            temperature: entry.fluid.temperature,
            pressure: 101325,
          },
          mesh: {
            resolution: 'medium',
            baseCellSizeMm: 12,
            inflationLayers: 18,
            growthRate: 1.18,
            firstCellHeightMm: 0.012,
            estimatedCells: entry.meshCells,
          },
          solverSettings: {
            maxIterations: entry.iterations,
            convergenceTolerance: 1e-5,
            cflNumber: 1.0,
            multigridLevels: 3,
          },
        },
        {
          residualSeries: entry.residuals,
          wheelRpm: entry.wheelRpm ?? 0,
          meshHealth: entry.meshHealth ?? undefined,
        }
      );
      triggerConfetti();
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto select-none text-[#0F172A] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">
                Simulation History &amp; Compare
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] font-bold">
                {runs.length} SAVED RUNS
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Select 2 or more completed OpenFOAM runs to compare aerodynamic &amp; thermal deltas against a baseline.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter by metal, solver, or project..."
            className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A] min-w-[210px]"
          />
          <button
            type="button"
            onClick={handleResetSeeds}
            className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#334155] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Benchmarks</span>
          </button>
          <button
            type="button"
            onClick={() => setPage('runner')}
            className="px-3.5 py-2 rounded-lg bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-bold cursor-pointer"
          >
            New Simulation Run
          </button>
        </div>
      </div>

      {/* Saved Runs Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F8FAFC]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
            <GitCompareArrows className="w-4 h-4 text-[#2563EB]" />
            <span>Saved Simulation Archive ({selectedRuns.length} selected for comparison)</span>
          </div>

          {selectedRuns.length >= 2 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748B] font-semibold">Baseline Run:</span>
              <select
                aria-label="Comparison Baseline Run"
                value={effectiveBaselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                className="px-2.5 py-1 rounded border border-[#CBD5E1] bg-white text-[#0F172A] font-semibold text-xs cursor-pointer"
              >
                {selectedRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.projectName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] font-semibold">
                <th className="py-2.5 px-3">Compare</th>
                <th className="py-2.5 px-3">Run / Project</th>
                <th className="py-2.5 px-3">Metal &amp; Mode</th>
                <th className="py-2.5 px-3">Fluid / Inflow</th>
                <th className="py-2.5 px-3">Mesh Cells</th>
                <th className="py-2.5 px-3">Cd</th>
                <th className="py-2.5 px-3">Cl</th>
                <th className="py-2.5 px-3">Peak Temp / Flux</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => {
                const isSelected = selectedIds.includes(run.id);
                const isBaseline = isSelected && effectiveBaselineId === run.id;
                return (
                  <tr
                    key={run.id}
                    data-testid={`history-row-${run.id}`}
                    className={`border-b border-[#E2E8F0] transition-colors ${
                      isSelected ? 'bg-[#EFF6FF]/60' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        aria-label={`Select ${run.projectName} for comparison`}
                        onClick={() => toggleSelectRun(run.id)}
                        className="flex items-center gap-1.5 text-[#2563EB] font-semibold cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#94A3B8]" />
                        )}
                        {isBaseline && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2563EB] text-white">
                            BASE
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[#0F172A]">{run.projectName}</div>
                      <div className="text-[10px] font-mono text-[#64748B]">
                        {run.solver} {run.parallelMode ? '(MPI 4x)' : '(1-Core)'} • {new Date(run.timestamp).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[#0F172A]">{run.material.name}</div>
                      <div className="text-[10px] font-mono text-[#64748B]">
                        k={run.material.thermalConductivity} W/m·K • Ks={run.material.surfaceRoughness} m
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {run.fluid.type} @ {run.inletVelocity} m/s
                    </td>
                    <td className="py-2.5 px-3 font-mono">{run.meshCells.toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0F172A]">{run.metrics.cD.toFixed(4)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#2563EB]">{run.metrics.cL.toFixed(4)}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {typeof run.metrics.maxSolidTemp === 'number'
                        ? `${run.metrics.maxSolidTemp.toFixed(1)} K / ${run.metrics.heatFlux ?? 0} W/m²`
                        : 'Aero-Only'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleExportRunPdf(run)}
                          disabled={isExporting === run.id}
                          title="Download Engineering Report (PDF)"
                          className="px-2 py-1 rounded border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{isExporting === run.id ? 'PDF...' : 'PDF'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRun(run.id)}
                          title="Delete run from local history"
                          className="p-1.5 rounded border border-[#E2E8F0] hover:border-[#FECACA] hover:bg-[#FEF2F2] text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      {selectedRuns.length < 2 ? (
        <div className="bg-white rounded-xl border border-dashed border-[#CBD5E1] p-8 text-center space-y-2">
          <GitCompareArrows className="w-8 h-8 text-[#64748B] mx-auto" />
          <h2 className="text-sm font-bold text-[#0F172A]">Select 2 or More Runs to Compare</h2>
          <p className="text-xs text-[#64748B]">
            Check at least two simulation rows above to compute side-by-side aerodynamic and thermal percentage deltas.
          </p>
        </div>
      ) : (
        <div
          data-testid="side-by-side-comparison-matrix"
          className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#0F172A] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <GitCompareArrows className="w-4 h-4 text-[#38BDF8]" />
                <span>Side-by-Side Engineering Comparison &amp; Delta Matrix</span>
              </h2>
              <p className="text-[11px] text-[#94A3B8]">
                Comparing {selectedRuns.length} runs against baseline:{' '}
                <strong className="text-white">
                  {selectedRuns.find((r) => r.id === effectiveBaselineId)?.projectName}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const base = selectedRuns.find((r) => r.id === effectiveBaselineId) || selectedRuns[0];
                if (base) handleExportRunPdf(base);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Baseline PDF</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="py-2.5 px-3 text-[#475569] font-bold min-w-[200px]">Parameter / Metric</th>
                  {selectedRuns.map((run) => (
                    <th key={run.id} className="py-2.5 px-3 min-w-[190px]">
                      <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                        <span className="truncate">{run.projectName}</span>
                        {run.id === effectiveBaselineId && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#2563EB] text-white shrink-0">
                            BASELINE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-[#64748B] font-normal">
                        {run.material.name} • {run.solver}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.key} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-semibold text-[#334155]">
                      {row.label}
                      {row.unit && <span className="text-[#94A3B8] font-mono ml-1">({row.unit})</span>}
                    </td>
                    {row.values.map((cell) => {
                      const isBaselineCell = cell.runId === effectiveBaselineId;
                      const formattedVal =
                        cell.value === null
                          ? '—'
                          : row.decimals === 0
                          ? Math.round(cell.value).toLocaleString()
                          : cell.value.toFixed(row.decimals);
                      const deltaText = formatDeltaBadge(cell.delta, Math.min(4, row.decimals));

                      const deltaToneClass =
                        cell.delta.direction === 'improved'
                          ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]'
                          : cell.delta.direction === 'regressed'
                          ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]';

                      return (
                        <td key={cell.runId} className="py-2.5 px-3 font-mono">
                          <div className="font-bold text-[#0F172A]">{formattedVal}</div>
                          {!isBaselineCell && cell.delta.delta !== null && (
                            <span
                              className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${deltaToneClass}`}
                            >
                              {cell.delta.delta > 0 ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : cell.delta.delta < 0 ? (
                                <ArrowDownRight className="w-3 h-3" />
                              ) : (
                                <Minus className="w-3 h-3" />
                              )}
                              <span>{deltaText}</span>
                            </span>
                          )}
                          {isBaselineCell && (
                            <span className="mt-1 inline-block text-[10px] text-[#2563EB] font-semibold">
                              Reference
                            </span>
                          )}
                        </td>
                      );
                    })}
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

export default HistoryComparisonPage;
