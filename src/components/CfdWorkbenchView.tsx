import React, { useState, useEffect } from 'react';
import {
  AirfoilPresetId,
  SimulationState,
  TurbulenceModel,
  ScalarFieldType,
  ProbePoint,
  MeshStatistics,
  ConsoleLogMessage,
  ResidualPoint
} from '../types';
import {
  AIRFOIL_PRESETS,
  computeAeroCoefficients,
  generateInitialResiduals,
  updateProbesWithState
} from '../utils/airfoilPhysics';
import { CommandHeader } from './CommandHeader';
import { LeftSidebar } from './LeftSidebar/LeftSidebar';
import { CfdViewport } from './Viewport/CfdViewport';
import { VtkPostProcessorViewer } from './Viewport/VtkPostProcessorViewer';
import { BottomDrawer } from './BottomDrawer/BottomDrawer';
import { ExportModal } from './ExportModal';
import { sound } from '../utils/soundEffects';
import { usePlatform } from '../context/PlatformContext';

export const CfdWorkbenchView: React.FC = () => {
  const { simConfig, geometries, currentGeometryId } = usePlatform();
  const currentGeom = geometries.find((g) => g.id === currentGeometryId) || geometries[0];
  const [viewerMode, setViewerMode] = useState<'workbench' | 'vtk3d'>('workbench');

  // Active aerodynamic scene
  const [activePresetId, setActivePresetId] = useState<AirfoilPresetId>('naca0012');
  const preset = AIRFOIL_PRESETS[activePresetId];

  // Simulation State
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: true,
    iteration: 1482,
    maxIterations: 2500,
    mach: preset.defaultMach,
    aoa: preset.defaultAoA,
    reynolds: preset.defaultRe,
    cflNumber: 1.25,
    freeStreamVelocity: preset.defaultMach * 340.29,
    staticTemp: 288.15,
    staticPressure: 101325,
    massFlowResidual: 1.42e-5,
    converged: false,
    statusText: 'CONVERGING',
  });

  // Turbulence model
  const [turbulenceModel, setTurbulenceModel] = useState<TurbulenceModel>('k-omega-sst');

  // Active Scalar Color field in viewport
  const [scalarType, setScalarType] = useState<ScalarFieldType>('pressure_cp');

  // Layout mode: standard, viewport-focus, telemetry-focus
  const [layoutMode, setLayoutMode] = useState<'standard' | 'viewport-focus' | 'telemetry-focus'>('standard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Export report modal
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Mesh Statistics
  const [meshStats, setMeshStats] = useState<MeshStatistics>({
    totalCells: 184520,
    totalNodes: 94180,
    minOrthogonalQuality: 0.84,
    maxAspectRatio: 24.2,
    maxSkewness: 0.28,
    yPlusAverage: 0.92,
    inflationLayers: 18,
    growthRate: 1.18,
    firstCellHeightMm: 0.012,
  });

  // Probes in domain
  const [probes, setProbes] = useState<ProbePoint[]>([
    {
      id: 'probe-1',
      name: 'Probe 01: Suction Peak',
      x: 0.15,
      y: 0.09,
      cp: -1.82,
      mach: 0.98,
      u: 334.2,
      v: 24.1,
      p: 82400,
      t: 271.4,
    },
    {
      id: 'probe-2',
      name: 'Probe 02: Shock Foot',
      x: 0.58,
      y: 0.07,
      cp: -0.42,
      mach: 1.12,
      u: 378.5,
      v: -12.4,
      p: 96800,
      t: 295.2,
    },
    {
      id: 'probe-3',
      name: 'Probe 03: Wake Core',
      x: 1.15,
      y: 0.01,
      cp: 0.12,
      mach: 0.65,
      u: 220.1,
      v: -8.0,
      p: 101200,
      t: 288.9,
    },
    {
      id: 'probe-4',
      name: 'Probe 04: LE Stagnation',
      x: -0.03,
      y: 0.0,
      cp: 0.98,
      mach: 0.11,
      u: 38.0,
      v: 2.0,
      p: 148500,
      t: 304.5,
    },
  ]);

  const [selectedProbeId, setSelectedProbeId] = useState<string | null>('probe-1');

  // Residuals history
  const [residuals, setResiduals] = useState<ResidualPoint[]>(() =>
    generateInitialResiduals(1482)
  );

  // Solver Console Logs
  const [logs, setLogs] = useState<ConsoleLogMessage[]>([
    {
      id: '1',
      timestamp: '04:25:01',
      iteration: 1420,
      level: 'info',
      message: 'Multigrid W-Cycle level 3 smoothing converged. Residual: 2.41e-5',
    },
    {
      id: '2',
      timestamp: '04:25:15',
      iteration: 1450,
      level: 'metric',
      message: 'Courant CFL number dynamically elevated from 1.00 to 1.25.',
    },
    {
      id: '3',
      timestamp: '04:25:30',
      iteration: 1475,
      level: 'info',
      message: 'Transonic upper normal shock localized at chord station x/c = 0.582.',
    },
    {
      id: '4',
      timestamp: '04:25:48',
      iteration: 1482,
      level: 'success',
      message: 'Mass flux balance converged: Δṁ = 1.42e-5 kg/s across boundary boundaries.',
    },
  ]);

  // Compute live aerodynamic force coefficients
  const coefficients = computeAeroCoefficients(
    activePresetId,
    simulationState.mach,
    simulationState.aoa
  );

  // Handle Preset Change
  const handlePresetChange = (presetId: AirfoilPresetId) => {
    sound.playClick();
    const p = AIRFOIL_PRESETS[presetId];
    setActivePresetId(presetId);
    setSimulationState((prev) => ({
      ...prev,
      mach: p.defaultMach,
      aoa: p.defaultAoA,
      reynolds: p.defaultRe,
      freeStreamVelocity: p.defaultMach * 340.29,
      iteration: 120,
    }));
    setResiduals(generateInitialResiduals(120));

    // Log event
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        iteration: 120,
        level: 'info',
        message: `Aerodynamic case switched to ${p.name} (${p.category}). Geometry re-initialized.`,
      },
    ]);
  };

  // Run / Pause Toggle
  const handleTogglePlay = () => {
    if (simulationState.isRunning) {
      sound.playStop();
    } else {
      sound.playStartSimulation();
    }
    setSimulationState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        iteration: simulationState.iteration,
        level: simulationState.isRunning ? 'warn' : 'info',
        message: simulationState.isRunning ? 'Iterative solver paused by operator.' : 'Resuming Navier-Stokes solver iterations.',
      },
    ]);
  };

  // Single iteration step
  const handleStep = () => {
    sound.playTick();
    setSimulationState((prev) => {
      const nextIter = Math.min(prev.maxIterations, prev.iteration + 1);
      return { ...prev, iteration: nextIter };
    });
  };

  // Reset solver
  const handleReset = () => {
    sound.playTick();
    setSimulationState((prev) => ({
      ...prev,
      iteration: 1,
      massFlowResidual: 2.5e-1,
      converged: false,
    }));
    setResiduals(generateInitialResiduals(1));
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        iteration: 1,
        level: 'warn',
        message: 'Flowfield initialized to uniform free-stream condition.',
      },
    ]);
  };

  // Layout mode switcher
  const handleLayoutModeChange = (mode: 'standard' | 'viewport-focus' | 'telemetry-focus') => {
    sound.playClick();
    setLayoutMode(mode);
    if (mode === 'viewport-focus') {
      setIsSidebarCollapsed(true);
      setIsDrawerCollapsed(true);
    } else if (mode === 'telemetry-focus') {
      setIsSidebarCollapsed(false);
      setIsDrawerCollapsed(false);
    } else {
      setIsSidebarCollapsed(false);
      setIsDrawerCollapsed(false);
    }
  };

  // Mach change
  const handleMachChange = (mach: number) => {
    const clamped = Math.max(0.1, Math.min(2.5, Number(mach.toFixed(3))));
    setSimulationState((prev) => ({
      ...prev,
      mach: clamped,
      freeStreamVelocity: clamped * 340.29,
    }));
  };

  // AoA change
  const handleAoAChange = (aoa: number) => {
    const clamped = Math.max(-6.0, Math.min(20.0, Number(aoa.toFixed(2))));
    setSimulationState((prev) => ({ ...prev, aoa: clamped }));
  };

  // CFL change
  const handleCflChange = (cfl: number) => {
    setSimulationState((prev) => ({ ...prev, cflNumber: cfl }));
  };

  // Reynolds change
  const handleReynoldsChange = (re: number) => {
    setSimulationState((prev) => ({ ...prev, reynolds: re }));
  };

  // Remesh handler
  const handleRegenerateMesh = () => {
    sound.playTick();
    setMeshStats((prev) => ({
      ...prev,
      totalCells: Math.round(prev.totalCells * (0.95 + Math.random() * 0.1)),
      totalNodes: Math.round(prev.totalNodes * (0.95 + Math.random() * 0.1)),
      minOrthogonalQuality: Number((0.82 + Math.random() * 0.06).toFixed(2)),
    }));
    setLogs((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        iteration: simulationState.iteration,
        level: 'info',
        message: 'Mesh remeshed. Hybrid prism-quad grid topology reconstructed.',
      },
    ]);
  };

  // Inflation layer update
  const handleUpdateInflation = (layers: number, growthRate: number) => {
    setMeshStats((prev) => ({
      ...prev,
      inflationLayers: layers,
      growthRate,
    }));
  };

  // Probe updates
  const handleUpdateProbePosition = (id: string, x: number, y: number) => {
    setProbes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x, y } : p))
    );
  };

  const handleAddProbe = () => {
    sound.playTick();
    const newId = `probe-${Date.now()}`;
    const newProbe: ProbePoint = {
      id: newId,
      name: `Probe 0${probes.length + 1}: Custom Point`,
      x: Number((0.2 + Math.random() * 0.5).toFixed(2)),
      y: Number((0.05 + Math.random() * 0.15).toFixed(2)),
      cp: -0.5,
      mach: simulationState.mach,
      u: 280,
      v: 10,
      p: 98000,
      t: 285,
    };
    setProbes((prev) => [...prev, newProbe]);
    setSelectedProbeId(newId);
  };

  const handleAddProbeAtCoords = (x: number, y: number) => {
    sound.playTick();
    const newId = `probe-${Date.now()}`;
    const newProbe: ProbePoint = {
      id: newId,
      name: `Probe 0${probes.length + 1}: (${x}, ${y})`,
      x,
      y,
      cp: -0.5,
      mach: simulationState.mach,
      u: 280,
      v: 10,
      p: 98000,
      t: 285,
    };
    setProbes((prev) => [...prev, newProbe]);
    setSelectedProbeId(newId);
  };

  const handleDeleteProbe = (id: string) => {
    sound.playTick();
    setProbes((prev) => prev.filter((p) => p.id !== id));
    if (selectedProbeId === id) setSelectedProbeId(null);
  };

  // Solver Iteration Simulation Loop
  useEffect(() => {
    if (!simulationState.isRunning) return;

    const interval = setInterval(() => {
      setSimulationState((prev) => {
        if (prev.iteration >= prev.maxIterations) {
          return { ...prev, isRunning: false, converged: true };
        }

        const nextIter = prev.iteration + 1;
        const massRes = Math.max(1e-6, prev.massFlowResidual * (1 - 0.0012));

        return {
          ...prev,
          iteration: nextIter,
          massFlowResidual: massRes,
        };
      });

      // Update residual plot periodically
      setResiduals((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        const decay = 0.9985;
        const noise = (Math.random() - 0.49) * 0.04;
        const newPoint: ResidualPoint = {
          iteration: last.iteration + 1,
          continuity: Math.max(1e-6, last.continuity * decay + noise * 1e-6),
          xMomentum: Math.max(1e-6, last.xMomentum * decay + noise * 1e-6),
          yMomentum: Math.max(1e-6, last.yMomentum * decay + noise * 1e-6),
          kTurbulence: Math.max(1e-6, last.kTurbulence * decay + noise * 1e-6),
          omegaDissipation: Math.max(1e-6, last.omegaDissipation * decay + noise * 1e-6),
        };
        const updated = [...prev, newPoint];
        if (updated.length > 120) updated.shift();
        return updated;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [simulationState.isRunning]);

  // Update probes with real physics as parameters change
  useEffect(() => {
    setProbes((prev) =>
      updateProbesWithState(
        prev,
        activePresetId,
        simulationState.mach,
        simulationState.aoa,
        simulationState.staticPressure,
        simulationState.staticTemp
      )
    );
  }, [
    activePresetId,
    simulationState.mach,
    simulationState.aoa,
    simulationState.staticPressure,
    simulationState.staticTemp,
  ]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
      {/* 1. Global Command Header */}
      <CommandHeader
        simulationState={simulationState}
        activePresetId={activePresetId}
        onPresetChange={handlePresetChange}
        onTogglePlay={handleTogglePlay}
        onStep={handleStep}
        onReset={handleReset}
        layoutMode={layoutMode}
        onLayoutModeChange={handleLayoutModeChange}
        onOpenExport={() => {
          sound.playClick();
          setIsExportOpen(true);
        }}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-row overflow-hidden relative min-h-0">
        {/* 2. Collapsible Left Sidebar Shelf */}
        <LeftSidebar
          simulationState={simulationState}
          turbulenceModel={turbulenceModel}
          onTurbulenceModelChange={(m) => {
            sound.playTick();
            setTurbulenceModel(m);
          }}
          onMachChange={handleMachChange}
          onAoAChange={handleAoAChange}
          onCflChange={handleCflChange}
          onReynoldsChange={handleReynoldsChange}
          probes={probes}
          selectedProbeId={selectedProbeId}
          onSelectProbe={(id) => {
            sound.playTick();
            setSelectedProbeId(id);
          }}
          onToggleProbeVisibility={() => {}}
          onAddProbe={handleAddProbe}
          meshStats={meshStats}
          onRegenerateMesh={handleRegenerateMesh}
          onUpdateInflation={handleUpdateInflation}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => {
            sound.playTick();
            setIsSidebarCollapsed((v) => !v);
          }}
        />

        {/* Center Workspace: Viewport & Bottom Drawer */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Quick Mode Switcher between 2D CFD Flow Workbench & 3D VTK Post-Processor */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-white/90 border-b border-[#E2E8F0] shrink-0">
            <span className="text-[11px] font-bold text-[#334155]">
              Results Post-Processing Mode
            </span>
            <div className="flex items-center gap-1 rounded-lg bg-[#F1F5F9] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setViewerMode('workbench')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  viewerMode === 'workbench' ? 'bg-white text-[#0F172A] shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                2D Flow &amp; Probes
              </button>
              <button
                type="button"
                data-testid="results-switch-vtk3d"
                onClick={() => setViewerMode('vtk3d')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  viewerMode === 'vtk3d' ? 'bg-[#2563EB] text-white shadow-2xs' : 'text-[#64748B]'
                }`}
              >
                3D VTK Post-Processor
              </button>
            </div>
          </div>

          {viewerMode === 'vtk3d' ? (
            <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC]">
              <VtkPostProcessorViewer
                geometryLabel={currentGeom?.name || preset.name}
                inletVelocity={simConfig.inletVelocity}
                solidWallTemperature={simConfig.solidWallTemperature}
                includeThermalSample={simConfig.simulationMode === 'conjugate_heat_transfer'}
                height={440}
              />
            </div>
          ) : (
            <>
              {/* 3. Primary 3D/2D CFD Viewport */}
              <CfdViewport
                activePresetId={activePresetId}
                simulationState={simulationState}
                scalarType={scalarType}
                onScalarTypeChange={(t) => {
                  sound.playClick();
                  setScalarType(t);
                }}
                probes={probes}
                selectedProbeId={selectedProbeId}
                onSelectProbe={(id) => {
                  sound.playTick();
                  setSelectedProbeId(id);
                }}
                onUpdateProbePosition={handleUpdateProbePosition}
                onAddProbeAtCoords={handleAddProbeAtCoords}
              />

              {/* 4. Bottom Drawer */}
              <BottomDrawer
                residuals={residuals}
                currentIteration={simulationState.iteration}
                coefficients={coefficients}
                mach={simulationState.mach}
                aoa={simulationState.aoa}
                presetId={activePresetId}
                logs={logs}
                onClearLogs={() => {
                  sound.playTick();
                  setLogs([]);
                }}
                probes={probes}
                selectedProbeId={selectedProbeId}
                onSelectProbe={(id) => {
                  sound.playTick();
                  setSelectedProbeId(id);
                }}
                onDeleteProbe={handleDeleteProbe}
                isCollapsed={isDrawerCollapsed}
                onToggleCollapse={() => {
                  sound.playTick();
                  setIsDrawerCollapsed((v) => !v);
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Export & Technical Compliance Report Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        simulationState={simulationState}
        coefficients={coefficients}
        activePreset={preset}
        probes={probes}
      />
    </div>
  );
};
