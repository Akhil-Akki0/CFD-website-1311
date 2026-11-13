import { SimulationMode } from '../types';

export interface ResidualSeriesPoint {
  iteration: number;
  Ux?: number;
  Uy?: number;
  Uz?: number;
  p?: number;
  k?: number;
  omega?: number;
  h?: number;
  continuity?: number;
  xMomentum?: number;
  yMomentum?: number;
  kTurbulence?: number;
  omegaDissipation?: number;
}

export interface SimulationHistoryEntry {
  id: string;
  caseId?: string;
  projectName: string;
  geometryName: string;
  solver: string;
  simulationMode: SimulationMode;
  parallelMode: boolean;
  material: {
    presetId: string;
    name: string;
    density: number;
    specificHeat: number;
    thermalConductivity: number;
    surfaceRoughness: number;
  };
  fluid: {
    type: string;
    density: number;
    viscosity: number;
    temperature: number;
  };
  inletVelocity: number;
  inletAngle: number;
  wheelRpm?: number;
  solidWallTemperature: number;
  meshCells: number;
  meshHealth?: {
    status: 'PASS' | 'WARNING' | 'FAIL';
    totalCells: number;
    maxNonOrthogonality: number | null;
    maxSkewness: number | null;
    summary?: string;
  } | null;
  iterations: number;
  executionTime: number;
  metrics: {
    cD: number;
    cL: number;
    liftToDrag: number;
    maxVelocity: number;
    maxPressure: number;
    minPressure?: number;
    maxSolidTemp?: number | null;
    heatFlux?: number | null;
  };
  residuals?: ResidualSeriesPoint[];
  vtkText?: string;
  timestamp: string;
  source: 'native' | 'benchmark';
}

export interface MetricDeltaResult {
  baselineValue: number | null;
  candidateValue: number | null;
  delta: number | null;
  percentDelta: number | null;
  direction: 'improved' | 'regressed' | 'neutral';
}

export function computeMetricDelta(
  baselineVal: number | null | undefined,
  candidateVal: number | null | undefined,
  preference: 'lower' | 'higher' | 'neutral' = 'neutral'
): MetricDeltaResult {
  const baseValid = typeof baselineVal === 'number' && Number.isFinite(baselineVal);
  const candValid = typeof candidateVal === 'number' && Number.isFinite(candidateVal);

  if (!baseValid || !candValid) {
    return {
      baselineValue: baseValid ? baselineVal! : null,
      candidateValue: candValid ? candidateVal! : null,
      delta: null,
      percentDelta: null,
      direction: 'neutral',
    };
  }

  const delta = Number((candidateVal! - baselineVal!).toFixed(6));
  const denom = Math.abs(baselineVal!);
  const percentDelta = denom > 1e-12 ? Number((((candidateVal! - baselineVal!) / denom) * 100).toFixed(2)) : null;

  let direction: 'improved' | 'regressed' | 'neutral' = 'neutral';
  if (Math.abs(delta) > 1e-9 && preference !== 'neutral') {
    if (preference === 'lower') {
      direction = delta < 0 ? 'improved' : 'regressed';
    } else {
      direction = delta > 0 ? 'improved' : 'regressed';
    }
  }

  return {
    baselineValue: baselineVal!,
    candidateValue: candidateVal!,
    delta,
    percentDelta,
    direction,
  };
}

export interface ComparisonMetricRow {
  key: string;
  label: string;
  unit: string;
  preference: 'lower' | 'higher' | 'neutral';
  decimals: number;
  values: {
    runId: string;
    value: number | null;
    delta: MetricDeltaResult;
  }[];
}

export function buildComparisonMatrix(
  runs: SimulationHistoryEntry[],
  baselineId: string
): ComparisonMetricRow[] {
  if (runs.length === 0) return [];
  const baseline = runs.find((r) => r.id === baselineId) || runs[0];

  const defs: {
    key: string;
    label: string;
    unit: string;
    preference: 'lower' | 'higher' | 'neutral';
    decimals: number;
    extract: (r: SimulationHistoryEntry) => number | null | undefined;
  }[] = [
    { key: 'cD', label: 'Drag Coefficient (Cd)', unit: '', preference: 'lower', decimals: 4, extract: (r) => r.metrics.cD },
    { key: 'cL', label: 'Lift / Downforce Coeff (Cl)', unit: '', preference: 'higher', decimals: 4, extract: (r) => r.metrics.cL },
    { key: 'liftToDrag', label: 'Aero Efficiency (L/D)', unit: '', preference: 'higher', decimals: 2, extract: (r) => r.metrics.liftToDrag },
    { key: 'maxVelocity', label: 'Max Flow Velocity', unit: 'm/s', preference: 'neutral', decimals: 2, extract: (r) => r.metrics.maxVelocity },
    { key: 'maxPressure', label: 'Peak Stagnation Pressure', unit: 'Pa', preference: 'neutral', decimals: 1, extract: (r) => r.metrics.maxPressure },
    { key: 'meshCells', label: 'Mesh Cell Count', unit: 'cells', preference: 'neutral', decimals: 0, extract: (r) => r.meshCells },
    { key: 'wheelRpm', label: 'Wheel Rotation Speed', unit: 'RPM', preference: 'neutral', decimals: 0, extract: (r) => r.wheelRpm ?? 0 },
    { key: 'maxNonOrthogonality', label: 'Mesh Max Non-Ortho', unit: 'deg', preference: 'lower', decimals: 1, extract: (r) => r.meshHealth?.maxNonOrthogonality },
    { key: 'surfaceRoughness', label: 'Surface Roughness (Ks)', unit: 'm', preference: 'lower', decimals: 6, extract: (r) => r.material.surfaceRoughness },
    { key: 'thermalConductivity', label: 'Solid Thermal Conductivity (k)', unit: 'W/(m·K)', preference: 'higher', decimals: 1, extract: (r) => r.material.thermalConductivity },
    { key: 'maxSolidTemp', label: 'Peak Solid Temperature', unit: 'K', preference: 'lower', decimals: 2, extract: (r) => r.metrics.maxSolidTemp },
    { key: 'heatFlux', label: 'Wall Heat Flux', unit: 'W/m²', preference: 'higher', decimals: 1, extract: (r) => r.metrics.heatFlux },
    { key: 'executionTime', label: 'Solver Wall Time', unit: 's', preference: 'lower', decimals: 1, extract: (r) => r.executionTime },
  ];

  return defs.map((def) => {
    const baseVal = def.extract(baseline);
    return {
      key: def.key,
      label: def.label,
      unit: def.unit,
      preference: def.preference,
      decimals: def.decimals,
      values: runs.map((run) => {
        const val = def.extract(run);
        return {
          runId: run.id,
          value: typeof val === 'number' && Number.isFinite(val) ? val : null,
          delta:
            run.id === baseline.id
              ? {
                  baselineValue: typeof baseVal === 'number' ? baseVal : null,
                  candidateValue: typeof val === 'number' ? val : null,
                  delta: 0,
                  percentDelta: 0,
                  direction: 'neutral',
                }
              : computeMetricDelta(baseVal, val, def.preference),
        };
      }),
    };
  });
}

export function formatDeltaBadge(delta: MetricDeltaResult, decimals = 3): string {
  if (delta.delta === null) return '—';
  if (Math.abs(delta.delta) < 1e-12) return 'Baseline';
  const sign = delta.delta > 0 ? '+' : '';
  const deltaStr = `${sign}${delta.delta.toFixed(decimals)}`;
  if (delta.percentDelta === null) return deltaStr;
  const pctSign = delta.percentDelta > 0 ? '+' : '';
  return `${deltaStr} (${pctSign}${delta.percentDelta.toFixed(1)}%)`;
}
