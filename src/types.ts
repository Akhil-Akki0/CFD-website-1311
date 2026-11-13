// Core Types for AI CFD Platform & Aerodynamic Simulation Engine

export type AirfoilPresetId = 'naca0012' | 'rae2822' | 'diamond_wedge' | 'turbine_vane';

export interface AirfoilPreset {
  id: AirfoilPresetId;
  name: string;
  category: 'Subsonic' | 'Transonic' | 'Transonic Wing' | 'Supercritical' | 'Supersonic' | 'Turbomachinery';
  description: string;
  defaultMach: number;
  defaultAoA: number; // degrees
  defaultRe: number; // Reynolds number
  chord: number; // meters
}

export type TurbulenceModel =
  | 'k-omega-sst'
  | 'spalart-allmaras'
  | 'k-epsilon-realizable'
  | 'laminar'
  | 'inviscid-euler';

export type ScalarFieldType =
  | 'pressure_cp'
  | 'mach'
  | 'velocity_u'
  | 'vorticity'
  | 'turbulent_ke'
  | 'temperature';

export interface ScalarMetadata {
  id: string;
  name: string;
  symbol: string;
  unit: string;
  min: number;
  max: number;
  colormap: string;
}

export interface TreeItem {
  id: string;
  name: string;
  type: 'group' | 'surface' | 'curve' | 'probe' | 'boundary';
  visible: boolean;
  children?: TreeItem[];
}

export interface BoundaryCondition {
  id: string;
  name: string;
  type: 'velocity-inlet' | 'pressure-outlet' | 'no-slip-wall' | 'symmetry-slip' | 'farfield' | string;
  value: string;
  color?: string;
  active?: boolean;
}

export interface SimulationState {
  isRunning: boolean;
  iteration: number;
  maxIterations: number;
  mach: number;
  aoa: number; // angle of attack, degrees
  reynolds: number;
  cflNumber: number;
  freeStreamVelocity: number; // m/s
  staticTemp: number; // K
  staticPressure: number; // Pa
  massFlowResidual: number;
  converged: boolean;
  statusText: 'INITIALIZING' | 'MESHING' | 'SOLVING' | 'CONVERGING' | 'CONVERGED' | 'PAUSED';
}

export interface AeroCoefficients {
  cL: number; // Lift coefficient
  cD: number; // Total drag coefficient
  cDp: number; // Form/pressure/wave drag
  cDf: number; // Skin friction drag
  cM: number; // Quarter-chord pitching moment
  liftToDrag: number; // L/D ratio
}

export interface ProbePoint {
  id: string;
  name: string;
  x: number; // chord normalized (0 to 1)
  y: number; // chord normalized
  cp: number;
  mach: number;
  u: number; // m/s
  v: number; // m/s
  p: number; // Pa
  t: number; // K
}

export interface MeshStatistics {
  totalCells: number;
  totalNodes: number;
  minOrthogonalQuality: number;
  maxAspectRatio: number;
  maxSkewness: number;
  yPlusAverage: number;
  inflationLayers: number;
  growthRate: number;
  firstCellHeightMm: number;
}

export interface ConsoleLogMessage {
  id: string;
  timestamp: string;
  iteration: number;
  level: 'info' | 'warn' | 'success' | 'metric';
  message: string;
}

export interface ResidualPoint {
  iteration: number;
  continuity: number;
  xMomentum: number;
  yMomentum: number;
  kTurbulence: number;
  omegaDissipation: number;
  h?: number;
}

// ------------------------------------------------------------
// GitHub Project (Cwebsite-CFD-001) Core Entities
// ------------------------------------------------------------

export type PageId =
  | 'intro-robot'
  | 'limits'
  | 'landing'
  | 'dashboard'
  | 'projects'
  | 'geometry'
  | 'setup'
  | 'runner'
  | 'live-sim'
  | 'sweeps'
  | 'results'
  | 'history'
  | 'ai'
  | 'reporting'
  | 'docs';

export type ThemeMode = 'light' | 'dark';

export type LightThemeId =
  | 'sky-aero'
  | 'solar-amber'
  | 'aurora-emerald'
  | 'lavender-breeze'
  | 'radiant-coral'
  | 'electric-azure';

export interface LightThemeConfig {
  id: LightThemeId;
  name: string;
  badge: string;
  bgGradient: string;
  cardBg: string;
  accentColor: string;
  glowColor: string;
}

export type CfdType =
  | 'External Aerodynamics'
  | 'Internal Flow'
  | 'Pipe Flow'
  | 'Airflow'
  | 'Heat Transfer'
  | 'Compressible High-Speed'
  | 'Custom';

export type FluidType = 'Air' | 'Water' | 'Kerosene' | 'Custom';
export type SimulationType = 'Steady State' | 'Transient';

export interface Project {
  projectId: string;
  name: string;
  description: string;
  cfdType: CfdType;
  fluidType: FluidType;
  simulationType: SimulationType;
  status: 'active' | 'completed' | 'draft';
  createdAt: string;
  geometryId?: string;
}

export interface ParsedMeshData {
  vertices: [number, number, number][]; // [x, y, z]
  faces: [number, number, number][]; // [v0, v1, v2]
  normals?: [number, number, number][];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  surfaceArea: number; // m^2
  volume: number; // m^3
  aspectRatioMax: number;
  isWatertight: boolean;
}

export interface GeometryRecord {
  id: string;
  projectId: string;
  name: string;
  filename: string;
  format: 'STL' | 'OBJ' | 'VTK' | 'STEP' | 'PLY' | 'IGES' | 'OFF' | 'CUSTOM' | string;
  fileSize: number; // bytes
  points: number;
  cells: number;
  maxSize: number; // meters
  isTriangulated: boolean;
  volume: number; // m^3
  validationStatus: 'valid' | 'invalid' | 'warning';
  validationMessage: string;
  warnings: string[];
  type: 'preset' | 'upload';
  geometryType:
    | 'cylinder'
    | 'sphere'
    | 'cube'
    | 'airfoil'
    | 'fsae_wing'
    | 'propeller'
    | 'five_spoke_rim'
    | 'aero_disc_rim'
    | 'multi_spoke_rim'
    | 'custom';
  meshData?: ParsedMeshData;
  stlBase64?: string; // Raw STL base64 representation for real OpenFOAM solver
  serverCaseId?: string; // Pre-staged /api/upload-stl UUID
}

export type MetalPresetId =
  | 'aluminum_6061_t6'
  | 'pure_copper'
  | 'stainless_steel_304'
  | 'titanium_ti6al4v'
  | 'cast_iron'
  | 'forged_magnesium'
  | 'custom';

export type SimulationMode = 'aerodynamic_roughness' | 'conjugate_heat_transfer';

export interface SolidMaterialProperties {
  presetId: MetalPresetId;
  name: string;
  density: number; // kg/m^3
  specificHeat: number; // J/(kg*K)
  thermalConductivity: number; // W/(m*K)
  surfaceRoughness: number; // Ks in m
}

export interface SimulationConfig {
  projectId: string;
  solver: 'simpleFoam' | 'chtMultiRegionSimpleFoam' | 'rhoSimpleFoam' | 'buoyantSimpleFoam' | 'SU2_CFD';
  simulationMode: SimulationMode;
  parallelMode?: boolean;
  wheelRpm?: number;
  solidWallTemperature: number; // K
  material: SolidMaterialProperties;
  inletVelocity: number; // m/s
  inletAngle: number; // degrees
  outletPressure: number; // Pa gauge
  wallCondition: 'no_slip' | 'slip' | 'moving';
  fluid: {
    presetId?: 'air_20c' | 'hot_brake_air_150c' | 'water_20c' | 'custom';
    type: FluidType;
    name?: string;
    density: number; // kg/m3
    viscosity: number; // m2/s
    temperature: number; // K
    pressure: number; // Pa
  };
  mesh: {
    resolution: 'coarse' | 'medium' | 'fine' | 'ultra_fine';
    baseCellSizeMm: number;
    inflationLayers: number;
    growthRate: number;
    firstCellHeightMm: number;
    estimatedCells: number;
  };
  solverSettings: {
    maxIterations: number;
    convergenceTolerance: number;
    cflNumber: number;
    multigridLevels: number;
  };
}

export interface SimulationRecord {
  simulationId: string;
  projectId: string;
  projectName: string;
  solver: string;
  status: 'queued' | 'preparing' | 'meshing' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  executionTime: number; // seconds
  iterations: number;
  meshCells: number;
  metrics: {
    maxVelocity: number;
    minVelocity: number;
    avgVelocity: number;
    maxPressure: number;
    minPressure: number;
    pressureDrop: number;
    cL?: number;
    cD?: number;
    liftToDrag?: number;
    materialName?: string;
    simulationMode?: SimulationMode;
    wheelRpm?: number;
    maxSolidTemp?: number;
    heatFlux?: number;
    meshHealth?: {
      status: 'PASS' | 'WARNING' | 'FAIL';
      totalCells: number;
      maxNonOrthogonality: number | null;
      maxSkewness: number | null;
      summary?: string;
    };
  };
  availableFields: string[];
  config: SimulationConfig;
  logLines?: string[];
  usedFallback?: boolean;
  fallbackReason?: string;
  errorMessage?: string;
  snappyHexMeshSuccess?: boolean;
  caseId?: string;
  vtkData?: {
    pointsCount?: number;
    cellsCount?: number;
    maxVelocity?: number;
    maxPressure?: number;
    minPressure?: number;
    wakeDeficit?: number;
    vtkPath?: string;
  };
}

export interface AIModelRecord {
  modelId: string;
  name: string;
  version: string;
  modelType: 'FNO' | 'PINN' | 'DeepONet' | 'Surrogate';
  description: string;
  inputFeatures: string[];
  outputFeatures: string[];
  trainRmse: number;
  valRmse: number;
  isActive: boolean;
}

export interface AIPredictionResult {
  modelName: string;
  modelType: string;
  confidence: number;
  timestamp: string;
  prediction: {
    maxVelocity: number;
    avgVelocity: number;
    pressureDrop: number;
    estimatedCL: number;
    estimatedCD: number;
    wallShearStress: number;
    recirculationLength: number;
    inferenceTimeMs: number;
  };
}

// ------------------------------------------------------------
// Simulation Queue & Job Execution Types
// ------------------------------------------------------------

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused';

export interface CheckMeshResult {
  status: 'PASSED' | 'WARNING' | 'FAILED_FALLBACK';
  maxNonOrthogonality: number; // degrees (< 70 good, > 85 failed)
  maxSkewness: number; // (< 4 good, > 20 failed)
  maxAspectRatio: number;
  minTetQuality: number;
  domainClearanceOk: boolean;
  watertight: boolean;
  summary: string;
  recommendation: string;
}

export interface SimulationJob {
  id: string;
  name: string;
  geometryName: string;
  solver: string;
  aoa: number; // degrees
  velocity: number; // m/s
  status: JobStatus;
  progress: number; // 0 - 100
  iteration: number;
  maxIterations: number;
  residuals: {
    continuity: number;
    xMomentum: number;
    kTurbulence: number;
    omegaDissipation: number;
  };
  cL: number;
  cD: number;
  liftToDrag: number;
  checkMeshResult?: CheckMeshResult;
  syntheticWakeActive?: boolean;
  caseId?: string;
  logs: string[];
  startedAt: string;
  completedAt?: string;
  executionTimeSeconds: number;
  errorMessage?: string;
}

// ------------------------------------------------------------
// Parametric Sweeps & Polars
// ------------------------------------------------------------

export interface PolarDataPoint {
  aoa: number;
  cL: number;
  cD: number;
  cM: number;
  liftToDrag: number;
  isStalled: boolean;
  recirculationLength: number;
  convergenceIterations: number;
  syntheticWakeUsed: boolean;
  residualContinuity: number;
}

export interface ParametricSweepConfig {
  minAoA: number;
  maxAoA: number;
  stepAoA: number;
  velocity: number;
  turbulenceModel: TurbulenceModel;
  meshResolution: 'coarse' | 'medium' | 'fine';
}

export interface BayesianOptimizationPoint {
  iteration: number;
  aoa: number;
  predictedLiftToDrag: number;
  uncertaintySigma: number;
  acquisitionValue: number;
  isBest: boolean;
}

