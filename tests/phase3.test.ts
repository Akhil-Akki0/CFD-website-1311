import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createResidualStreamParser,
  parseResidualsDetailed,
} from '../backend/openfoamDiagnostics.js';
import {
  parseAsciiVtk,
  mapScalarToColorArray,
  generateSampleCfdVtk,
} from '../src/utils/vtkParser';
import {
  computeMetricDelta,
  buildComparisonMatrix,
  formatDeltaBadge,
} from '../src/utils/simulationComparison';
import { generateSampleGeometry } from '../src/utils/cadFileParser';

test('OpenFOAM multi-field residual parser handles Ux, Uy, Uz, p, k, omega streaming & batch', () => {
  const sampleStdout = [
    'Starting time loop',
    'Time = 1',
    'smoothSolver:  Solving for Ux, Initial residual = 0.4512, Final residual = 0.012, No Iterations 4',
    'smoothSolver:  Solving for Uy, Initial residual = 0.3105, Final residual = 0.008, No Iterations 4',
    'smoothSolver:  Solving for Uz, Initial residual = 0.1201, Final residual = 0.004, No Iterations 3',
    'GAMG:  Solving for p, Initial residual = 0.9120, Final residual = 0.045, No Iterations 6',
    'smoothSolver:  Solving for k, Initial residual = 0.2850, Final residual = 0.009, No Iterations 4',
    'smoothSolver:  Solving for omega, Initial residual = 0.1940, Final residual = 0.006, No Iterations 4',
    'Time = 2',
    'smoothSolver:  Solving for Ux, Initial residual = 0.1240, Final residual = 0.004, No Iterations 3',
    'smoothSolver:  Solving for Uy, Initial residual = 0.0880, Final residual = 0.002, No Iterations 3',
    'smoothSolver:  Solving for Uz, Initial residual = 0.0410, Final residual = 0.001, No Iterations 2',
    'GAMG:  Solving for p_rgh, Initial residual = 0.2450, Final residual = 0.011, No Iterations 5',
    'smoothSolver:  Solving for k, Initial residual = 0.0910, Final residual = 0.003, No Iterations 3',
    'smoothSolver:  Solving for omega, Initial residual = 0.0620, Final residual = 0.002, No Iterations 3',
  ].join('\n');

  const batch = parseResidualsDetailed(sampleStdout);
  assert.equal(batch.length, 2);
  assert.equal(batch[0].iteration, 1);
  assert.equal(batch[0].Ux, 0.4512);
  assert.equal(batch[0].Uy, 0.3105);
  assert.equal(batch[0].Uz, 0.1201);
  assert.equal(batch[0].p, 0.9120);
  assert.equal(batch[0].k, 0.2850);
  assert.equal(batch[0].omega, 0.1940);
  // Backward compatibility aliases
  assert.equal(batch[0].xMomentum, 0.4512);
  assert.equal(batch[0].continuity, 0.9120);

  // Verify p_rgh maps to p in thermal CHT mode
  assert.equal(batch[1].iteration, 2);
  assert.equal(batch[1].p, 0.2450);

  // Verify incremental streaming emits completed iteration when next Time = arrives
  const stream = createResidualStreamParser();
  const completedEvents: any[] = [];
  for (const line of sampleStdout.split('\n')) {
    const { completedPoint } = stream.pushLine(line);
    if (completedPoint) completedEvents.push(completedPoint);
  }
  assert.equal(completedEvents.length, 1);
  assert.equal(completedEvents[0].iteration, 1);
  const flushed = stream.flush();
  assert.equal(flushed.length, 2);
});

test('ASCII VTK parser triangulates polygons and extracts Velocity |U|, Pressure p, Temperature T', () => {
  const sampleVtk = generateSampleCfdVtk({
    inletVelocity: 30,
    solidWallTemperature: 400,
    includeThermal: true,
  });

  const parsed = parseAsciiVtk(sampleVtk);
  assert.ok(parsed.pointCount > 100);
  assert.ok(parsed.triangleCount > 100);
  assert.equal(parsed.positions.length, parsed.pointCount * 3);
  assert.equal(parsed.indices.length, parsed.triangleCount * 3);

  assert.ok(parsed.fields.velocity);
  assert.ok(parsed.fields.pressure);
  assert.ok(parsed.fields.temperature);
  assert.ok(parsed.bounds.velocity && parsed.bounds.velocity.max > 30);
  assert.ok(parsed.bounds.pressure && parsed.bounds.pressure.max > parsed.bounds.pressure.min);
  assert.ok(parsed.bounds.temperature && parsed.bounds.temperature.max > parsed.bounds.temperature.min);

  const colors = mapScalarToColorArray(
    parsed.fields.velocity!,
    parsed.bounds.velocity!.min,
    parsed.bounds.velocity!.max,
    'turbo'
  );
  assert.equal(colors.length, parsed.pointCount * 3);
  for (let i = 0; i < colors.length; i++) {
    assert.ok(colors[i] >= 0 && colors[i] <= 1);
  }
});

test('Simulation history comparison computes accurate signed deltas and percentage differences', () => {
  const improvedDrag = computeMetricDelta(0.5, 0.4, 'lower');
  assert.equal(improvedDrag.delta, -0.1);
  assert.equal(improvedDrag.percentDelta, -20);
  assert.equal(improvedDrag.direction, 'improved');
  assert.equal(formatDeltaBadge(improvedDrag, 2), '-0.10 (-20.0%)');

  const zeroBase = computeMetricDelta(0, 1.5, 'higher');
  assert.equal(zeroBase.delta, 1.5);
  assert.equal(zeroBase.percentDelta, null);
  assert.equal(zeroBase.direction, 'improved');

  const matrix = buildComparisonMatrix(
    [
      {
        id: 'base',
        projectName: 'Baseline Al',
        geometryName: 'Rim',
        solver: 'simpleFoam',
        simulationMode: 'aerodynamic_roughness',
        parallelMode: false,
        material: {
          presetId: 'aluminum_6061_t6',
          name: 'Aluminum 6061-T6',
          density: 2700,
          specificHeat: 896,
          thermalConductivity: 167,
          surfaceRoughness: 0.000015,
        },
        fluid: { type: 'Air', density: 1.225, viscosity: 1.5e-5, temperature: 288.15 },
        inletVelocity: 25,
        inletAngle: 0,
        solidWallTemperature: 350,
        meshCells: 180000,
        iterations: 500,
        executionTime: 40,
        metrics: { cD: 0.40, cL: 0.10, liftToDrag: 0.25, maxVelocity: 38, maxPressure: 101700 },
        timestamp: '2026-09-16T10:00:00Z',
        source: 'native',
      },
      {
        id: 'cand',
        projectName: 'Polished Copper',
        geometryName: 'Rim',
        solver: 'chtMultiRegionSimpleFoam',
        simulationMode: 'conjugate_heat_transfer',
        parallelMode: true,
        material: {
          presetId: 'pure_copper',
          name: 'Pure Copper',
          density: 8960,
          specificHeat: 385,
          thermalConductivity: 401,
          surfaceRoughness: 0.0000015,
        },
        fluid: { type: 'Air', density: 1.225, viscosity: 1.5e-5, temperature: 288.15 },
        inletVelocity: 25,
        inletAngle: 0,
        solidWallTemperature: 400,
        meshCells: 200000,
        iterations: 500,
        executionTime: 50,
        metrics: { cD: 0.36, cL: 0.12, liftToDrag: 0.33, maxVelocity: 39, maxPressure: 101740, maxSolidTemp: 375, heatFlux: 14500 },
        timestamp: '2026-09-16T11:00:00Z',
        source: 'native',
      },
    ],
    'base'
  );

  const cdRow = matrix.find((r) => r.key === 'cD');
  assert.ok(cdRow);
  assert.equal(cdRow!.values[1].delta.delta, -0.04);
  assert.equal(cdRow!.values[1].delta.percentDelta, -10);
  assert.equal(cdRow!.values[1].delta.direction, 'improved');
});

test('Parses enthalpy h residual in CHT runs and generates 3D rim benchmark meshes', () => {
  const chtLog = [
    'Time = 5',
    'smoothSolver:  Solving for Ux, Initial residual = 0.21, Final residual = 0.01, No Iterations 3',
    'GAMG:  Solving for p_rgh, Initial residual = 0.44, Final residual = 0.02, No Iterations 4',
    'smoothSolver:  Solving for h, Initial residual = 0.085, Final residual = 0.002, No Iterations 3',
  ].join('\n');

  const parsed = parseResidualsDetailed(chtLog);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].h, 0.085);

  for (const rimType of ['five_spoke_rim', 'aero_disc_rim', 'multi_spoke_rim'] as const) {
    const geom = generateSampleGeometry(rimType);
    assert.ok(geom.vertices.length > 50);
    assert.ok(geom.faces.length > 50);
  }
});
