import { METAL_MATERIAL_PRESETS } from '../data/metalMaterials';
import { SimulationHistoryEntry } from '../utils/simulationComparison';

const STORAGE_KEY = 'rimz_cfd_simulation_history_v1';

export const SEED_HISTORY_RUNS: SimulationHistoryEntry[] = [
  {
    id: 'run-al6061-aero-01',
    caseId: '10000001-0000-4000-8000-000000000001',
    projectName: 'RIMZ Aero Rim — Aluminum 6061-T6 Baseline',
    geometryName: 'Cylinder / Wheel Rim Bluff Body',
    solver: 'simpleFoam',
    simulationMode: 'aerodynamic_roughness',
    parallelMode: false,
    material: { ...METAL_MATERIAL_PRESETS.aluminum_6061_t6 },
    fluid: { type: 'Air', density: 1.225, viscosity: 1.5e-5, temperature: 288.15 },
    inletVelocity: 25.0,
    inletAngle: 0,
    wheelRpm: 0,
    solidWallTemperature: 350,
    meshCells: 184520,
    meshHealth: { status: 'PASS', totalCells: 184520, maxNonOrthogonality: 48.2, maxSkewness: 1.84 },
    iterations: 500,
    executionTime: 42.4,
    metrics: {
      cD: 0.4185,
      cL: 0.042,
      liftToDrag: 0.10,
      maxVelocity: 39.8,
      maxPressure: 101708,
      minPressure: 100620,
      maxSolidTemp: null,
      heatFlux: null,
    },
    residuals: Array.from({ length: 12 }, (_, idx) => {
      const iter = (idx + 1) * 40;
      const decay = Math.pow(0.58, idx);
      return {
        iteration: iter,
        Ux: Number((0.42 * decay).toExponential(3)),
        Uy: Number((0.28 * decay).toExponential(3)),
        Uz: Number((0.18 * decay).toExponential(3)),
        p: Number((0.85 * decay).toExponential(3)),
        k: Number((0.34 * decay).toExponential(3)),
        omega: Number((0.22 * decay).toExponential(3)),
      };
    }),
    timestamp: '2026-09-16T10:15:00Z',
    source: 'benchmark',
  },
  {
    id: 'run-copper-cht-02',
    caseId: '10000001-0000-4000-8000-000000000002',
    projectName: 'RIMZ Brake-Rim CHT — Pure Copper',
    geometryName: '10-Spoke Endurance Brake-Cooling Rim',
    solver: 'chtMultiRegionSimpleFoam',
    simulationMode: 'conjugate_heat_transfer',
    parallelMode: true,
    material: { ...METAL_MATERIAL_PRESETS.pure_copper },
    fluid: { type: 'Air', density: 0.834, viscosity: 2.86e-5, temperature: 423.15 },
    inletVelocity: 35.0,
    inletAngle: 0,
    wheelRpm: 1200,
    solidWallTemperature: 650,
    meshCells: 212400,
    meshHealth: { status: 'PASS', totalCells: 212400, maxNonOrthogonality: 52.6, maxSkewness: 2.15 },
    iterations: 600,
    executionTime: 64.8,
    metrics: {
      cD: 0.3912,
      cL: 0.049,
      liftToDrag: 0.13,
      maxVelocity: 49.4,
      maxPressure: 101845,
      minPressure: 100490,
      maxSolidTemp: 612.4,
      heatFlux: 18420.5,
    },
    residuals: Array.from({ length: 12 }, (_, idx) => {
      const iter = (idx + 1) * 50;
      const decay = Math.pow(0.55, idx);
      return {
        iteration: iter,
        Ux: Number((0.46 * decay).toExponential(3)),
        Uy: Number((0.31 * decay).toExponential(3)),
        Uz: Number((0.21 * decay).toExponential(3)),
        p: Number((0.91 * decay).toExponential(3)),
        k: Number((0.39 * decay).toExponential(3)),
        omega: Number((0.25 * decay).toExponential(3)),
        h: Number((0.31 * decay).toExponential(3)),
      };
    }),
    timestamp: '2026-09-16T12:30:00Z',
    source: 'benchmark',
  },
  {
    id: 'run-ti6al4v-aero-03',
    caseId: '10000001-0000-4000-8000-000000000003',
    projectName: 'RIMZ Lightweight Hub — Titanium Ti-6Al-4V',
    geometryName: '5-Spoke Performance Rim (18" Forged)',
    solver: 'simpleFoam',
    simulationMode: 'aerodynamic_roughness',
    parallelMode: true,
    material: { ...METAL_MATERIAL_PRESETS.titanium_ti6al4v },
    fluid: { type: 'Air', density: 1.225, viscosity: 1.5e-5, temperature: 293.15 },
    inletVelocity: 27.78,
    inletAngle: 0,
    wheelRpm: 850,
    solidWallTemperature: 350,
    meshCells: 248900,
    meshHealth: { status: 'PASS', totalCells: 248900, maxNonOrthogonality: 44.1, maxSkewness: 1.62 },
    iterations: 500,
    executionTime: 31.6,
    metrics: {
      cD: 0.3640,
      cL: 0.084,
      liftToDrag: 0.23,
      maxVelocity: 42.1,
      maxPressure: 101780,
      minPressure: 100440,
      maxSolidTemp: null,
      heatFlux: null,
    },
    timestamp: '2026-09-17T08:45:00Z',
    source: 'benchmark',
  },
  {
    id: 'run-magnesium-f1-05',
    caseId: '10000001-0000-4000-8000-000000000005',
    projectName: 'F1 Aero-Disc Wheel (300 km/h) — Forged Magnesium',
    geometryName: 'F1 Aero-Disc Wheel Fairing (Low Drag)',
    solver: 'simpleFoam',
    simulationMode: 'aerodynamic_roughness',
    parallelMode: true,
    material: { ...METAL_MATERIAL_PRESETS.forged_magnesium },
    fluid: { type: 'Air', density: 1.225, viscosity: 1.5e-5, temperature: 293.15 },
    inletVelocity: 83.33,
    inletAngle: 0,
    wheelRpm: 2400,
    solidWallTemperature: 350,
    meshCells: 420800,
    meshHealth: { status: 'PASS', totalCells: 420800, maxNonOrthogonality: 41.8, maxSkewness: 1.48 },
    iterations: 600,
    executionTime: 58.2,
    metrics: {
      cD: 0.2894,
      cL: -0.142,
      liftToDrag: -0.49,
      maxVelocity: 118.4,
      maxPressure: 105578,
      minPressure: 98120,
      maxSolidTemp: null,
      heatFlux: null,
    },
    timestamp: '2026-09-17T09:20:00Z',
    source: 'benchmark',
  },
  {
    id: 'run-castiron-rough-04',
    caseId: '10000001-0000-4000-8000-000000000004',
    projectName: 'RIMZ Sand-Cast Rotor — Cast Iron (High Ks)',
    geometryName: 'Cylinder Bluff Body (Karman Vortex)',
    solver: 'simpleFoam',
    simulationMode: 'aerodynamic_roughness',
    parallelMode: false,
    material: { ...METAL_MATERIAL_PRESETS.cast_iron },
    fluid: { type: 'Air', density: 1.225, viscosity: 1.5e-5, temperature: 293.15 },
    inletVelocity: 25.0,
    inletAngle: 0,
    wheelRpm: 0,
    solidWallTemperature: 390,
    meshCells: 184520,
    meshHealth: { status: 'WARNING', totalCells: 184520, maxNonOrthogonality: 66.4, maxSkewness: 2.91 },
    iterations: 500,
    executionTime: 46.2,
    metrics: {
      cD: 0.4695,
      cL: 0.036,
      liftToDrag: 0.08,
      maxVelocity: 38.6,
      maxPressure: 101690,
      minPressure: 100710,
      maxSolidTemp: null,
      heatFlux: null,
    },
    timestamp: '2026-09-17T10:05:00Z',
    source: 'benchmark',
  },
];

export function loadSimulationHistory(): SimulationHistoryEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [...SEED_HISTORY_RUNS];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_HISTORY_RUNS));
      return [...SEED_HISTORY_RUNS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [...SEED_HISTORY_RUNS];
  } catch {
    return [...SEED_HISTORY_RUNS];
  }
}

export function saveSimulationToHistory(entry: SimulationHistoryEntry): SimulationHistoryEntry[] {
  const existing = loadSimulationHistory();
  const deduped = existing.filter((item) => item.id !== entry.id && (!entry.caseId || item.caseId !== entry.caseId));
  const updated = [entry, ...deduped].slice(0, 40);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {
    // Ignore quota errors
  }
  return updated;
}

export function deleteSimulationHistoryEntry(id: string): SimulationHistoryEntry[] {
  const updated = loadSimulationHistory().filter((item) => item.id !== id);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
  return updated;
}

export function resetSimulationHistoryDefaults(): SimulationHistoryEntry[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_HISTORY_RUNS));
    }
  } catch {}
  return [...SEED_HISTORY_RUNS];
}
