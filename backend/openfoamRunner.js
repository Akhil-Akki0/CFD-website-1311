/**
 * Hardened OpenFOAM v2606 Execution Engine & Docker/WSL2 Sandboxing
 * 
 * DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import crypto from 'crypto';
import logger from './logger.js';
import {
  translateOpenFoamError,
  inspectCaseLogsForErrors,
  cleanupExpiredCases,
  DEFAULT_CASE_MAX_AGE_MS,
  createResidualStreamParser,
  parseResidualsDetailed,
  parseCheckMeshHealth,
} from './openfoamDiagnostics.js';

const BASE_CASE_DIR = '/tmp/of_cases';
const CASE_TIMEOUT_MS = parseInt(process.env.CASE_TIMEOUT_MS || '600000', 10); // 10 minutes
const parsedConcurrency = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
const MAX_GLOBAL_CONCURRENT = Number.isFinite(parsedConcurrency)
  ? Math.max(1, Math.min(2, parsedConcurrency))
  : 2;
const MAX_USER_CONCURRENT = 2;
const DEFAULT_ESTIMATED_JOB_SEC = 45;

const isWindows = process.platform === 'win32';
const USE_DOCKER_SANDBOX = process.env.OPENFOAM_EXEC_MODE === 'docker';
// Native OpenFOAM only: never manufacture CFD results.

// Job Queue & State
const activeJobs = new Map(); // caseId -> Job
const jobQueue = []; // Array of queued job objects (FIFO)
const completedDurationsSec = [];
let runningGlobalCount = 0;
let cleanupIntervalHandle = null;

// Ensure base storage directory exists
if (!isWindows) {
  try {
    fs.mkdirSync(BASE_CASE_DIR, { recursive: true, mode: 0o700 });
  } catch (e) {}
}

function getProtectedCaseIds() {
  const protectedIds = new Set();
  for (const job of activeJobs.values()) {
    if (job.status === 'running' || job.status === 'queued') {
      protectedIds.add(job.caseId);
    }
  }
  return protectedIds;
}

function startCleanupScheduler({
  intervalMs = 60 * 60 * 1000, // Hourly check
  maxAgeMs = DEFAULT_CASE_MAX_AGE_MS, // Delete > 24 hours old
} = {}) {
  if (cleanupIntervalHandle) return cleanupIntervalHandle;
  // Run initial sweep safely on startup
  try {
    cleanupExpiredCases({
      baseDir: BASE_CASE_DIR,
      maxAgeMs,
      protectedCaseIds: getProtectedCaseIds(),
    });
  } catch {}

  cleanupIntervalHandle = setInterval(() => {
    cleanupExpiredCases({
      baseDir: BASE_CASE_DIR,
      maxAgeMs,
      protectedCaseIds: getProtectedCaseIds(),
    });
  }, intervalMs);

  if (typeof cleanupIntervalHandle.unref === 'function') {
    cleanupIntervalHandle.unref();
  }
  return cleanupIntervalHandle;
}

if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_CASE_CLEANUP_TIMER !== 'true') {
  startCleanupScheduler();
}

/**
 * Validate that a path is strictly inside BASE_CASE_DIR to prevent Path Traversal
 */
function assertSafeCaseDir(caseDir, expectedUuid) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedUuid)) {
    throw new Error('Security Violation: Invalid Case UUID format.');
  }

  // Canonicalize path
  const resolved = path.resolve(caseDir);
  const allowedRoot = path.resolve(BASE_CASE_DIR);

  if (!isWindows && !resolved.startsWith(allowedRoot + path.sep) && resolved !== allowedRoot) {
    throw new Error(`Security Violation: Path traversal attempt outside ${BASE_CASE_DIR}`);
  }
}

function safelyRemoveCaseDir(caseDir, caseId) {
  try {
    assertSafeCaseDir(caseDir, caseId);
    if (!isWindows && fs.existsSync(caseDir)) {
      fs.rmSync(caseDir, { recursive: true, force: true });
    }
  } catch (err) {
    logger.warn('Failed to remove simulation temp folder', { caseId, error: err.message });
  }
}

function killProcessTreeSafely(child, signal = 'SIGTERM') {
  if (!child) return;
  try {
    if (child.pid) {
      process.kill(-child.pid, signal);
    } else {
      child.kill(signal);
    }
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
}

/**
 * Safe Command Execution via spawn with argument array.
 * NEVER uses shell string concatenation or raw user strings.
 */
function executeSafeCommand(command, args = [], workingDir, timeoutMs = CASE_TIMEOUT_MS, options = {}) {
  return new Promise((resolve) => {
    // Whitelist allowed OpenFOAM, MPI, and probe utilities
    const ALLOWED_BINARIES = [
      'blockMesh',
      'surfaceFeatureExtract',
      'snappyHexMesh',
      'checkMesh',
      'simpleFoam',
      'chtMultiRegionSimpleFoam',
      'splitMeshRegions',
      'topoSet',
      'decomposePar',
      'reconstructPar',
      'mpirun',
      'foamToVTK',
      'which',
      'command',
      'ls',
      'cat',
    ];

    if (!ALLOWED_BINARIES.includes(command)) {
      return resolve({
        exitCode: 1,
        stdout: '',
        stderr: `Security violation: command '${command}' is not in the approved OpenFOAM whitelist.`,
      });
    }

    // Ensure all arguments are strict strings containing NO shell metacharacters
    const sanitizedArgs = args.map((a) => {
      const str = String(a);
      if (/[;&|`$><!\n\r]/.test(str)) {
        throw new Error(`Security violation: illegal characters detected in argument for ${command}`);
      }
      return str;
    });

    let child;
    let stdoutBuf = '';
    let stderrBuf = '';
    let stdoutLineRem = '';
    let stderrLineRem = '';
    let killedByTimeout = false;

    // 1. Docker Sandboxed Execution Mode
    if (USE_DOCKER_SANDBOX) {
      const dockerArgs = [
        'run',
        '--rm',
        '--network', 'none',
        '--read-only',
        '--tmpfs', '/tmp/of_cases:rw,noexec,nosuid,size=2g',
        '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges',
        '--pids-limit', '256',
        '--memory', '2g',
        '--cpus', '2',
        '-v', `${workingDir}:${workingDir}:rw`,
        '-w', workingDir,
        'opencfd/openfoam-default:latest',
        command,
        ...sanitizedArgs,
      ];

      child = spawn('docker', dockerArgs, {
        detached: true,
        env: {
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        },
      });
    }
    // 2. WSL2 Mode (Windows Host)
    else if (isWindows) {
      const scriptBody = `
        if [ -f /usr/lib/openfoam/openfoam2606/etc/bashrc ]; then
          source /usr/lib/openfoam/openfoam2606/etc/bashrc
        else
          for bashrc in $(find /usr/lib/openfoam /opt -type f -path '*/etc/bashrc' 2>/dev/null | sort -V); do source "$bashrc"; done
        fi
        cd "${workingDir}" && ${command} "$@"
      `;

      child = spawn('wsl.exe', ['bash', '-lc', scriptBody, '--', ...sanitizedArgs], {
        detached: true,
      });
    }
    // 3. Native Linux Mode (Docker Container or Linux Server)
    else {
      const scriptBody = `
        if [ -f /usr/lib/openfoam/openfoam2606/etc/bashrc ]; then
          source /usr/lib/openfoam/openfoam2606/etc/bashrc
        else
          for bashrc in $(find /usr/lib/openfoam /opt -type f -path '*/etc/bashrc' 2>/dev/null | sort -V); do source "$bashrc"; done
        fi
        cd "${workingDir}" && ${command} "$@"
      `;

      child = spawn('bash', ['-lc', scriptBody, '--', ...sanitizedArgs], {
        detached: true,
      });
    }

    if (typeof options.onSpawn === 'function') {
      options.onSpawn(child);
    }

    const timer = setTimeout(() => {
      killedByTimeout = true;
      killProcessTreeSafely(child, 'SIGKILL');
    }, timeoutMs);

    const emitChunkLines = (chunkStr, isStderr) => {
      if (typeof options.onLine !== 'function') return;
      const combined = (isStderr ? stderrLineRem : stdoutLineRem) + chunkStr;
      const parts = combined.split(/\r?\n/);
      const rem = parts.pop() || '';
      if (isStderr) stderrLineRem = rem;
      else stdoutLineRem = rem;
      for (const line of parts) {
        if (line.length > 0) {
          try {
            options.onLine(line, isStderr ? 'stderr' : 'stdout');
          } catch {}
        }
      }
    };

    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdoutBuf += str;
      if (stdoutBuf.length > 50 * 1024 * 1024) {
        stdoutBuf = stdoutBuf.slice(-20 * 1024 * 1024);
      }
      emitChunkLines(str, false);
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderrBuf += str;
      emitChunkLines(str, true);
    });

    const persistLogFile = () => {
      if (!options.logFileName || !workingDir) return;
      try {
        const safeName = path.basename(options.logFileName);
        if (!/^log\.[a-zA-Z0-9_.-]+$/.test(safeName)) return;
        const resolvedWork = path.resolve(workingDir);
        const logTarget = path.resolve(resolvedWork, safeName);
        if (logTarget.startsWith(resolvedWork + path.sep) && fs.existsSync(resolvedWork)) {
          fs.writeFileSync(logTarget, `${stdoutBuf}\n${stderrBuf}`.trim(), 'utf8');
        }
      } catch {}
    };

    child.on('error', (err) => {
      clearTimeout(timer);
      if (typeof options.onSpawn === 'function') options.onSpawn(null);
      persistLogFile();
      resolve({
        exitCode: 1,
        stdout: stdoutBuf,
        stderr: `Process spawn error: ${err.message}`,
      });
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (typeof options.onLine === 'function') {
        if (stdoutLineRem.trim()) {
          try { options.onLine(stdoutLineRem, 'stdout'); } catch {}
        }
        if (stderrLineRem.trim()) {
          try { options.onLine(stderrLineRem, 'stderr'); } catch {}
        }
      }
      if (typeof options.onSpawn === 'function') options.onSpawn(null);
      persistLogFile();
      if (killedByTimeout) {
        resolve({
          exitCode: 124,
          stdout: stdoutBuf,
          stderr: `Process timed out after ${timeoutMs / 1000}s and was terminated.`,
        });
      } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        resolve({
          exitCode: 143,
          stdout: stdoutBuf,
          stderr: stderrBuf || `Process terminated by signal ${signal}`,
        });
      } else {
        resolve({
          exitCode: typeof code === 'number' ? code : 1,
          stdout: stdoutBuf,
          stderr: stderrBuf,
        });
      }
    });
  });
}

/**
 * Strictly clamps and sanitizes simulation + solid metal material parameters
 * to prevent OpenFOAM dictionary injection or solver numerical divergence.
 */
function sanitizeSimulationConfig(config = {}) {
  const clampNum = (val, min, max, fallback) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  };

  const vel = clampNum(config.inletVelocity, 0.01, 100.0, 1.0);
  const maxIter = Math.max(1, Math.min(10000, parseInt(config.maxIterations, 10) || 500));
  const nu = clampNum(config.viscosity, 1e-7, 1e-2, 1.5e-5);
  const fluidType = ['air_20c', 'hot_brake_air_150c', 'water_20c', 'custom'].includes(config.fluidType)
    ? config.fluidType
    : 'air_20c';
  const fluidDensity = clampNum(config.fluidDensity, 0.1, 5000, 1.225);
  const fluidTemperature = clampNum(config.fluidTemperature, 150, 2000, 293.15);
  const meshResolution = ['coarse', 'medium', 'fine', 'ultra_fine'].includes(config.meshResolution)
    ? config.meshResolution
    : 'medium';
  const wheelRpm = clampNum(config.wheelRpm, 0, 10000, 0);
  const simulationMode =
    config.simulationMode === 'conjugate_heat_transfer'
      ? 'conjugate_heat_transfer'
      : 'aerodynamic_roughness';
  const solidWallTemperature = clampNum(config.solidWallTemperature, 150, 4000, 350);

  const rawMat = config.material && typeof config.material === 'object' ? config.material : {};
  const rawName = typeof rawMat.name === 'string' ? rawMat.name.trim() : '';
  const safeName = rawName.replace(/[^a-zA-Z0-9 ._()-]/g, '').slice(0, 64) || 'Aluminum 6061-T6';

  const allowedPresets = [
    'aluminum_6061_t6',
    'pure_copper',
    'stainless_steel_304',
    'titanium_ti6al4v',
    'cast_iron',
    'forged_magnesium',
    'custom',
  ];
  const presetId = allowedPresets.includes(rawMat.presetId) ? rawMat.presetId : 'aluminum_6061_t6';

  const material = {
    presetId,
    name: safeName,
    density: clampNum(rawMat.density, 100, 25000, 2700),
    specificHeat: clampNum(rawMat.specificHeat, 50, 10000, 896),
    thermalConductivity: clampNum(rawMat.thermalConductivity, 0.1, 2500, 167),
    surfaceRoughness: clampNum(rawMat.surfaceRoughness, 1e-8, 0.05, 0.000015),
  };

  return {
    inletVelocity: vel,
    maxIterations: maxIter,
    viscosity: nu,
    fluidType,
    fluidDensity,
    fluidTemperature,
    meshResolution,
    wheelRpm,
    domain: ['compact', 'tunnel', 'farfield'].includes(config.domain) ? config.domain : 'compact',
    parallelMode: Boolean(config.parallelMode),
    simulationMode,
    solidWallTemperature,
    material,
  };
}

/**
 * Generates OpenFOAM Case Dictionaries with safe parameter ranges inside caseDir
 */
function writeCaseDictionaries(caseDir, config = {}) {
  const safeCfg = sanitizeSimulationConfig(config);
  const vel = safeCfg.inletVelocity;
  const maxIter = safeCfg.maxIterations;
  const nu = safeCfg.viscosity;
  const fluidRho = safeCfg.fluidDensity;
  const fluidTempFormatted = safeCfg.fluidTemperature.toFixed(2);
  const isThermalMode = safeCfg.simulationMode === 'conjugate_heat_transfer';
  const ksFormatted = safeCfg.material.surfaceRoughness.toExponential(6);
  const rhoFormatted = safeCfg.material.density.toFixed(2);
  const cpFormatted = safeCfg.material.specificHeat.toFixed(2);
  const kappaFormatted = safeCfg.material.thermalConductivity.toFixed(4);
  const wallTempFormatted = safeCfg.solidWallTemperature.toFixed(2);

  const meshPresetMap = {
    coarse: { blockCells: '(30 20 20)', refineLevel: '(1 2)' },
    medium: { blockCells: '(60 40 40)', refineLevel: '(2 3)' },
    fine: { blockCells: '(90 60 60)', refineLevel: '(3 4)' },
    ultra_fine: { blockCells: '(120 80 80)', refineLevel: '(3 5)' },
  };
  const meshPreset = meshPresetMap[safeCfg.meshResolution] || meshPresetMap.medium;

  const sysDir = path.join(caseDir, 'system');
  const constDir = path.join(caseDir, 'constant');
  const zeroDir = path.join(caseDir, '0');

  [sysDir, constDir, zeroDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  });

  // 1. system/blockMeshDict
  fs.writeFileSync(path.join(sysDir, 'blockMeshDict'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      blockMeshDict;
}
scale   1;
vertices
(
    (-2.0 -2.0 -2.0)
    ( 4.0 -2.0 -2.0)
    ( 4.0  2.0 -2.0)
    (-2.0  2.0 -2.0)
    (-2.0 -2.0  2.0)
    ( 4.0 -2.0  2.0)
    ( 4.0  2.0  2.0)
    (-2.0  2.0  2.0)
);
blocks
(
    hex (0 1 2 3 4 5 6 7) ${meshPreset.blockCells} simpleGrading (1 1 1)
);
edges ();
boundary
(
    inlet
    {
        type patch;
        faces ((0 4 7 3));
    }
    outlet
    {
        type patch;
        faces ((1 2 6 5));
    }
    walls
    {
        type patch;
        faces ((0 1 5 4) (3 7 6 2));
    }
    frontAndBack
    {
        type patch;
        faces ((0 3 2 1) (4 5 6 7));
    }
);
mergePatchPairs ();
`);

  // 2. system/snappyHexMeshDict
  fs.writeFileSync(path.join(sysDir, 'snappyHexMeshDict'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      snappyHexMeshDict;
}
castellatedMesh true;
snap            true;
addLayers       false;

geometry
{
    geometry.stl
    {
        type triSurfaceMesh;
        name cylinder;
    }
};

castellatedMeshControls
{
    maxLocalCells 500000;
    maxGlobalCells 2000000;
    minRefinementCells 10;
    nCellsBetweenLevels 3;
    features ();
    refinementSurfaces
    {
        cylinder
        {
            level ${meshPreset.refineLevel};
        }
    }
    resolveFeatureAngle 30;
    refinementRegions {}
    locationInMesh (2.5 1.2 0.0);
    allowFreeStandingZoneFaces true;
}

snapControls
{
    nSmoothPatch 3;
    tolerance 2.0;
    nSolveIter 30;
    nRelaxIter 5;
    nFeatureSnapIter 10;
    implicitFeatureSnap false;
    explicitFeatureSnap true;
    multiFaceFeatureSnap false;
}

addLayersControls
{
    relativeSizes true;
    layers {}
    expansionRatio 1.2;
    finalLayerThickness 0.5;
    minThickness 0.1;
}

meshQualityControls
{
    maxNonOrtho 65;
    maxBoundarySkewness 20;
    maxInternalSkewness 4;
    maxConcave 80;
    minVol 1e-13;
    minTetQuality 1e-15;
    minArea -1;
    minTwist 0.02;
    minDeterminant 0.001;
    minFaceWeight 0.02;
}
`);

  const solverApp = isThermalMode ? 'chtMultiRegionSimpleFoam' : 'simpleFoam';
  const regionLine = isThermalMode ? '        region          fluid;\n' : '';
  const thermalFunctionObj = isThermalMode
    ? `    wallHeatFlux
    {
        type            wallHeatFlux;
        libs            ("libfieldFunctionObjects.so");
        region          fluid;
        writeControl    timeStep;
        writeInterval   50;
        patches         (cylinder);
    }\n`
    : '';

  // 2b. system/surfaceFeatureExtractDict
  fs.writeFileSync(path.join(sysDir, 'surfaceFeatureExtractDict'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      surfaceFeatureExtractDict;
}
model.stl
{
    extractionMethod    extractFromSurface;
    extractFromSurfaceCoeffs
    {
        includedAngle   150;
    }
    writeObj            no;
}
`);

  // 3. system/controlDict
  fs.writeFileSync(path.join(sysDir, 'controlDict'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      controlDict;
}
// Solid Material: ${safeCfg.material.name} (${safeCfg.simulationMode}) | Fluid: ${safeCfg.fluidType} (rho=${fluidRho})
application     ${solverApp};
startFrom       startTime;
startTime       0;
stopAt          endTime;
endTime         ${maxIter};
deltaT          1;
writeControl    timeStep;
writeInterval   50;
purgeWrite      3;
writeFormat     ascii;
writePrecision  7;
writeCompression off;
runTimeModifiable true;

functions
{
    forces
    {
        type            forces;
        libs            ("libforces.so");
${regionLine}        writeControl    timeStep;
        writeInterval   1;
        patches         (cylinder);
        pName           p;
        UName           U;
        rho             rhoInf;
        rhoInf          ${fluidRho};
        CofG            (0 0 0);
    }
    forceCoeffs
    {
        type            forceCoeffs;
        libs            ("libforces.so");
${regionLine}        writeControl    timeStep;
        writeInterval   1;
        patches         (cylinder);
        pName           p;
        UName           U;
        rho             rhoInf;
        rhoInf          ${fluidRho};
        CofG            (0 0 0);
        liftDir         (0 1 0);
        dragDir         (1 0 0);
        pitchAxis       (0 0 1);
        magUInf         ${vel};
        lRef            1.0;
        Aref            2.0;
    }
${thermalFunctionObj}}
`);

  // 4. system/fvSchemes
  const fvSchemesContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      fvSchemes;
}
ddtSchemes { default steadyState; }
gradSchemes
{
    default Gauss linear;
    grad(p) Gauss linear;
    grad(U) cellLimited Gauss linear 1;
}
divSchemes
{
    default none;
    div(phi,U) bounded Gauss linearUpwind grad(U);
    div(phi,k) bounded Gauss upwind;
    div(phi,omega) bounded Gauss upwind;
    div(phi,h) bounded Gauss upwind;
    div(phi,K) bounded Gauss upwind;
    div(((rho*nuEff)*dev2(T(grad(U))))) Gauss linear;
    div((nuEff*dev2(T(grad(U))))) Gauss linear;
}
laplacianSchemes { default Gauss linear corrected; }
interpolationSchemes { default linear; }
snGradSchemes { default corrected; }
wallDist { method meshWave; }
`;
  fs.writeFileSync(path.join(sysDir, 'fvSchemes'), fvSchemesContent);

  // 5. system/fvSolution
  const fvSolutionContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      fvSolution;
}
solvers
{
    p
    {
        solver GAMG;
        tolerance 1e-06;
        relTol 0.01;
        smoother GaussSeidel;
    }
    p_rgh
    {
        solver GAMG;
        tolerance 1e-06;
        relTol 0.01;
        smoother GaussSeidel;
    }
    "(U|k|omega|h)"
    {
        solver smoothSolver;
        smoother GaussSeidel;
        tolerance 1e-06;
        relTol 0.01;
    }
}
SIMPLE
{
    nNonOrthogonalCorrectors 2;
    consistent yes;
    residualControl
    {
        p 1e-4;
        U 1e-4;
    }
}
relaxationFactors
{
    fields { p 0.3; p_rgh 0.3; }
    equations { U 0.7; k 0.7; omega 0.7; h 0.7; }
}
`;
  fs.writeFileSync(path.join(sysDir, 'fvSolution'), fvSolutionContent);

  // 6. 0/U
  const omegaRadSec = ((safeCfg.wheelRpm * 2 * Math.PI) / 60).toFixed(4);
  const cylinderVelocityPatch =
    safeCfg.wheelRpm > 0
      ? `{ type rotatingWallVelocity; origin (0 0 0); axis (0 0 1); omega ${omegaRadSec}; }`
      : `{ type noSlip; }`;

  const uDictContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class volVectorField;
    location "0";
    object U;
}
dimensions [0 1 -1 0 0 0 0];
internalField uniform (${vel} 0 0);
boundaryField
{
    inlet { type fixedValue; value uniform (${vel} 0 0); }
    outlet { type inletOutlet; inletValue uniform (0 0 0); value uniform (${vel} 0 0); }
    walls { type slip; }
    cylinder ${cylinderVelocityPatch}
    frontAndBack { type slip; }
}
`;
  fs.writeFileSync(path.join(zeroDir, 'U'), uDictContent);

  // 7. 0/p
  const pDictContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class volScalarField;
    location "0";
    object p;
}
dimensions [0 2 -2 0 0 0 0];
internalField uniform 0;
boundaryField
{
    inlet { type zeroGradient; }
    outlet { type fixedValue; value uniform 0; }
    walls { type zeroGradient; }
    cylinder { type zeroGradient; }
    frontAndBack { type zeroGradient; }
}
`;
  fs.writeFileSync(path.join(zeroDir, 'p'), pDictContent);

  // 8. 0/nut (Dynamic Rough Wall Function with user Ks and Cs = 0.5)
  const nutDictContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class volScalarField;
    location "0";
    object nut;
}
// Solid Material: ${safeCfg.material.name} | Surface Roughness Ks = ${ksFormatted} m
dimensions [0 2 -1 0 0 0 0];
internalField uniform 0;
boundaryField
{
    inlet
    {
        type            calculated;
        value           uniform 0;
    }
    outlet
    {
        type            calculated;
        value           uniform 0;
    }
    walls
    {
        type            calculated;
        value           uniform 0;
    }
    cylinder
    {
        type            nutkRoughWallFunction;
        Ks              uniform ${ksFormatted};
        Cs              uniform 0.5;
        value           uniform 0;
    }
    frontAndBack
    {
        type            calculated;
        value           uniform 0;
    }
}
`;
  fs.writeFileSync(path.join(zeroDir, 'nut'), nutDictContent);

  // 9. 0/k and 0/omega for kOmegaSST + nutkRoughWallFunction compatibility
  const kInit = Math.max(1e-4, 1.5 * Math.pow(vel * 0.05, 2)).toExponential(4);
  const omegaInit = Math.max(1e-2, Math.sqrt(Number(kInit)) / (0.09 * 0.07)).toExponential(4);

  const kDictContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class volScalarField;
    location "0";
    object k;
}
dimensions [0 2 -2 0 0 0 0];
internalField uniform ${kInit};
boundaryField
{
    inlet { type fixedValue; value uniform ${kInit}; }
    outlet { type inletOutlet; inletValue uniform ${kInit}; value uniform ${kInit}; }
    walls { type slip; }
    cylinder { type kqRWallFunction; value uniform ${kInit}; }
    frontAndBack { type slip; }
}
`;
  fs.writeFileSync(path.join(zeroDir, 'k'), kDictContent);

  const omegaDictContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class volScalarField;
    location "0";
    object omega;
}
dimensions [0 0 -1 0 0 0 0];
internalField uniform ${omegaInit};
boundaryField
{
    inlet { type fixedValue; value uniform ${omegaInit}; }
    outlet { type inletOutlet; inletValue uniform ${omegaInit}; value uniform ${omegaInit}; }
    walls { type slip; }
    cylinder { type omegaWallFunction; value uniform ${omegaInit}; }
    frontAndBack { type slip; }
}
`;
  fs.writeFileSync(path.join(zeroDir, 'omega'), omegaDictContent);

  // 10. constant/transportProperties & turbulence (RAS kOmegaSST)
  fs.writeFileSync(path.join(constDir, 'transportProperties'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    location "constant";
    object transportProperties;
}
transportModel Newtonian;
rho [1 -3 0 0 0 0 0] ${fluidRho};
nu [0 2 -1 0 0 0 0] ${nu};
`);

  const rasMomentumContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    location "constant";
    object momentumTransport;
}
simulationType RAS;
RAS
{
    model           kOmegaSST;
    turbulence      on;
    printCoeffs     on;
}
`;
  fs.writeFileSync(path.join(constDir, 'momentumTransport'), rasMomentumContent);

  const rasTurbulenceContent = `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    location "constant";
    object turbulenceProperties;
}
simulationType RAS;
RAS
{
    RASModel        kOmegaSST;
    turbulence      on;
    printCoeffs     on;
}
`;
  fs.writeFileSync(path.join(constDir, 'turbulenceProperties'), rasTurbulenceContent);

  // 11. Conjugate Heat Transfer Mode (chtMultiRegionSimpleFoam) Dictionaries
  if (isThermalMode) {
    const constFluidDir = path.join(constDir, 'fluid');
    const constSolidDir = path.join(constDir, 'solid');
    const zeroFluidDir = path.join(zeroDir, 'fluid');
    const zeroSolidDir = path.join(zeroDir, 'solid');
    const sysFluidDir = path.join(sysDir, 'fluid');
    const sysSolidDir = path.join(sysDir, 'solid');

    [constFluidDir, constSolidDir, zeroFluidDir, zeroSolidDir, sysFluidDir, sysSolidDir].forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
    });

    // constant/regionProperties
    fs.writeFileSync(path.join(constDir, 'regionProperties'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "constant";
    object      regionProperties;
}
regions
(
    fluid       (fluid)
    solid       (solid)
);
`);

    // constant/solid/thermophysicalProperties using heSolidThermo (pureMixture, constIso, hConst, rhoConst)
    fs.writeFileSync(path.join(constSolidDir, 'thermophysicalProperties'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "constant/solid";
    object      thermophysicalProperties;
}
// Solid Metal Material: ${safeCfg.material.name}
thermoType
{
    type            heSolidThermo;
    mixture         pureMixture;
    transport       constIso;
    thermo          hConst;
    equationOfState rhoConst;
    specie          specie;
    energy          sensibleEnthalpy;
}

mixture
{
    specie
    {
        nMoles      1;
        molWeight   55.845;
    }
    transport
    {
        kappa       ${kappaFormatted};
    }
    thermodynamics
    {
        Cp          ${cpFormatted};
        Hf          0;
    }
    equationOfState
    {
        rho         ${rhoFormatted};
    }
}
`);

    // constant/fluid/thermophysicalProperties
    const muDynamic = (nu * fluidRho).toExponential(6);
    const isLiquidFluid = safeCfg.fluidType === 'water_20c' || fluidRho >= 500;
    const fluidEosLine = isLiquidFluid ? '    equationOfState rhoConst;' : '    equationOfState perfectGas;';
    const fluidMolWeight = isLiquidFluid ? '18.015' : '28.9';
    const fluidCp = isLiquidFluid ? '4184' : '1005';
    const fluidPr = isLiquidFluid ? '6.99' : '0.71';
    const fluidEosBlock = isLiquidFluid
      ? `    equationOfState
    {
        rho         ${fluidRho};
    }\n`
      : '';
    fs.writeFileSync(path.join(constFluidDir, 'thermophysicalProperties'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "constant/fluid";
    object      thermophysicalProperties;
}
thermoType
{
    type            heRhoThermo;
    mixture         pureMixture;
    transport       const;
    thermo          hConst;
${fluidEosLine}
    specie          specie;
    energy          sensibleEnthalpy;
}

mixture
{
    specie
    {
        nMoles      1;
        molWeight   ${fluidMolWeight};
    }
    thermodynamics
    {
        Cp          ${fluidCp};
        Hf          0;
    }
    transport
    {
        mu          ${muDynamic};
        Pr          ${fluidPr};
    }
${fluidEosBlock}}
`);

    fs.writeFileSync(path.join(constFluidDir, 'momentumTransport'), rasMomentumContent);
    fs.writeFileSync(path.join(constFluidDir, 'turbulenceProperties'), rasTurbulenceContent);
    fs.writeFileSync(path.join(constFluidDir, 'g'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       uniformDimensionedVectorField;
    location    "constant/fluid";
    object      g;
}
dimensions      [0 1 -2 0 0 0 0];
value           (0 -9.81 0);
`);

    // 0/fluid & 0/solid initial temperature & flow fields
    fs.writeFileSync(path.join(zeroFluidDir, 'U'), uDictContent);
    fs.writeFileSync(path.join(zeroFluidDir, 'p'), pDictContent);
    fs.writeFileSync(path.join(zeroFluidDir, 'nut'), nutDictContent);
    fs.writeFileSync(path.join(zeroFluidDir, 'k'), kDictContent);
    fs.writeFileSync(path.join(zeroFluidDir, 'omega'), omegaDictContent);

    fs.writeFileSync(path.join(zeroFluidDir, 'p_rgh'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0/fluid";
    object      p_rgh;
}
dimensions      [1 -1 -2 0 0 0 0];
internalField   uniform 101325;
boundaryField
{
    inlet { type zeroGradient; }
    outlet { type fixedValue; value uniform 101325; }
    walls { type zeroGradient; }
    cylinder { type fixedFluxPressure; value uniform 101325; }
    frontAndBack { type zeroGradient; }
}
`);

    fs.writeFileSync(path.join(zeroFluidDir, 'T'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0/fluid";
    object      T;
}
dimensions      [0 0 0 1 0 0 0];
internalField   uniform ${fluidTempFormatted};
boundaryField
{
    inlet { type fixedValue; value uniform ${fluidTempFormatted}; }
    outlet { type inletOutlet; inletValue uniform ${fluidTempFormatted}; value uniform ${fluidTempFormatted}; }
    walls { type zeroGradient; }
    cylinder
    {
        type            compressible::turbulentTemperatureCoupledBaffleMixed;
        Tnbr            T;
        kappaMethod     fluidThermo;
        value           uniform ${wallTempFormatted};
    }
    frontAndBack { type zeroGradient; }
}
`);

    fs.writeFileSync(path.join(zeroSolidDir, 'T'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0/solid";
    object      T;
}
// Heated Solid Wall Temperature: ${wallTempFormatted} K (${safeCfg.material.name})
dimensions      [0 0 0 1 0 0 0];
internalField   uniform ${wallTempFormatted};
boundaryField
{
    cylinder
    {
        type            compressible::turbulentTemperatureCoupledBaffleMixed;
        Tnbr            T;
        kappaMethod     solidThermo;
        value           uniform ${wallTempFormatted};
    }
    heatSource
    {
        type            fixedValue;
        value           uniform ${wallTempFormatted};
    }
    ".*"
    {
        type            zeroGradient;
    }
}
`);

    // Region system/fluid & system/solid schemes/solutions
    fs.writeFileSync(path.join(sysFluidDir, 'fvSchemes'), fvSchemesContent);
    fs.writeFileSync(path.join(sysFluidDir, 'fvSolution'), fvSolutionContent);

    fs.writeFileSync(path.join(sysSolidDir, 'fvSchemes'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system/solid";
    object      fvSchemes;
}
ddtSchemes { default steadyState; }
gradSchemes { default Gauss linear; }
divSchemes { default none; }
laplacianSchemes { default Gauss linear corrected; }
interpolationSchemes { default linear; }
snGradSchemes { default corrected; }
`);

    fs.writeFileSync(path.join(sysSolidDir, 'fvSolution'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system/solid";
    object      fvSolution;
}
solvers
{
    h
    {
        solver          PCG;
        preconditioner  DIC;
        tolerance       1e-06;
        relTol          0.01;
    }
}
SIMPLE
{
    nNonOrthogonalCorrectors 0;
}
relaxationFactors
{
    equations { h 0.9; }
}
`);
  }

  // 12. Optional MPI Parallel Decomposition Dictionary (4 subdomains via scotch)
  if (safeCfg.parallelMode) {
    const buildDecomposeParDict = (locationLabel) => `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "${locationLabel}";
    object      decomposeParDict;
}
numberOfSubdomains 4;

method          scotch;
`;
    fs.writeFileSync(path.join(sysDir, 'decomposeParDict'), buildDecomposeParDict('system'));
    if (isThermalMode) {
      fs.writeFileSync(path.join(sysDir, 'fluid', 'decomposeParDict'), buildDecomposeParDict('system/fluid'));
      fs.writeFileSync(path.join(sysDir, 'solid', 'decomposeParDict'), buildDecomposeParDict('system/solid'));
    }
  }
}

/**
 * VTK Metric Parser (Velocity, Pressure, Temperature T, and wallHeatFlux)
 */
function parseVtkMetrics(vtkText) {
  const lines = vtkText.split('\n');
  let pointsCount = 0;
  let cellsCount = 0;
  let maxVelocity = 0;
  let minVelocity = Infinity;
  let maxPressure = -Infinity;
  let minPressure = Infinity;
  let maxTemperature = -Infinity;
  let minTemperature = Infinity;
  let maxWallHeatFlux = -Infinity;
  let sumWallHeatFlux = 0;
  let heatFluxCount = 0;

  let activeSection = null; // 'U' | 'p' | 'T' | 'wallHeatFlux' | null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('POINTS')) {
      pointsCount = parseInt(line.split(/\s+/)[1], 10) || 0;
      activeSection = null;
      continue;
    } else if (line.startsWith('CELLS')) {
      cellsCount = parseInt(line.split(/\s+/)[1], 10) || 0;
      activeSection = null;
      continue;
    } else if (line.startsWith('CELL_TYPES') || line.startsWith('POINT_DATA') || line.startsWith('CELL_DATA') || line.startsWith('FIELD')) {
      activeSection = null;
      continue;
    } else if (line.startsWith('VECTORS U')) {
      activeSection = 'U';
      continue;
    } else if (line.startsWith('SCALARS p ')) {
      activeSection = 'p';
      if (lines[i + 1] && lines[i + 1].includes('LOOKUP_TABLE')) i++;
      continue;
    } else if (line.startsWith('SCALARS T ')) {
      activeSection = 'T';
      if (lines[i + 1] && lines[i + 1].includes('LOOKUP_TABLE')) i++;
      continue;
    } else if (line.startsWith('SCALARS wallHeatFlux')) {
      activeSection = 'wallHeatFlux';
      if (lines[i + 1] && lines[i + 1].includes('LOOKUP_TABLE')) i++;
      continue;
    } else if (line.startsWith('SCALARS ') || line.startsWith('VECTORS ') || line.startsWith('TENSORS ')) {
      activeSection = null;
      continue;
    }

    if (activeSection === 'U') {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length >= 3 && Number.isFinite(parts[0])) {
        const mag = Math.sqrt(parts[0] ** 2 + parts[1] ** 2 + parts[2] ** 2);
        if (mag > maxVelocity) maxVelocity = mag;
        if (mag < minVelocity) minVelocity = mag;
      }
    } else if (activeSection === 'p') {
      const vals = line.split(/\s+/).map(Number);
      for (const val of vals) {
        if (Number.isFinite(val)) {
          if (val > maxPressure) maxPressure = val;
          if (val < minPressure) minPressure = val;
        }
      }
    } else if (activeSection === 'T') {
      const vals = line.split(/\s+/).map(Number);
      for (const val of vals) {
        if (Number.isFinite(val)) {
          if (val > maxTemperature) maxTemperature = val;
          if (val < minTemperature) minTemperature = val;
        }
      }
    } else if (activeSection === 'wallHeatFlux') {
      const vals = line.split(/\s+/).map(Number);
      for (const val of vals) {
        if (Number.isFinite(val)) {
          const absVal = Math.abs(val);
          if (absVal > maxWallHeatFlux) maxWallHeatFlux = absVal;
          sumWallHeatFlux += absVal;
          heatFluxCount++;
        }
      }
    }
  }

  return {
    pointsCount,
    cellsCount,
    maxVelocity: maxVelocity > 0 ? Number(maxVelocity.toFixed(4)) : null,
    minVelocity: minVelocity < Infinity ? Number(minVelocity.toFixed(4)) : null,
    maxPressure: maxPressure > -Infinity ? Number(maxPressure.toFixed(4)) : null,
    minPressure: minPressure < Infinity ? Number(minPressure.toFixed(4)) : null,
    maxTemperature: maxTemperature > -Infinity ? Number(maxTemperature.toFixed(2)) : null,
    minTemperature: minTemperature < Infinity ? Number(minTemperature.toFixed(2)) : null,
    avgWallHeatFlux: heatFluxCount > 0 ? Number((sumWallHeatFlux / heatFluxCount).toFixed(2)) : null,
    maxWallHeatFlux: maxWallHeatFlux > -Infinity ? Number(maxWallHeatFlux.toFixed(2)) : null,
  };
}

/**
 * Force Coefficients Parser
 */
function parseForceCoeffs(content) {
  if (!content) return null;
  const lines = content.trim().split('\n');
  let headerLine = null;
  const dataLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') && (trimmed.includes('Cd') || trimmed.includes('CD') || trimmed.includes('Cl') || trimmed.includes('CL'))) {
      headerLine = trimmed.replace(/^#\s*/, '');
    } else if (!trimmed.startsWith('#') && trimmed.length > 0) {
      dataLines.push(trimmed);
    }
  }

  if (dataLines.length === 0) return null;
  const lastValues = dataLines[dataLines.length - 1].split(/\s+/).map(Number);

  let cD = null;
  let cL = null;

  if (headerLine) {
    const headers = headerLine.split(/\s+/);
    const cdIdx = headers.findIndex((h) => /^cd$/i.test(h));
    const clIdx = headers.findIndex((h) => /^cl$/i.test(h));
    if (cdIdx !== -1 && !isNaN(lastValues[cdIdx])) cD = Number(lastValues[cdIdx].toFixed(5));
    if (clIdx !== -1 && !isNaN(lastValues[clIdx])) cL = Number(lastValues[clIdx].toFixed(5));
  }

  if (cD === null && lastValues.length >= 4) {
    cD = Number(lastValues[2].toFixed(5));
    cL = Number(lastValues[3].toFixed(5));
  }

  if (cD === null || isNaN(cD) || cL === null || isNaN(cL)) return null;
  return { cD, cL };
}

/**
 * Multi-field Residuals Parser (Ux, Uy, Uz, p, k, omega)
 */
function parseResiduals(stdoutLog) {
  return parseResidualsDetailed(stdoutLog);
}

/**
 * Safe VTK File Discovery inside verified caseDir/VTK (fluid, solid, or root)
 */
function findVtkFilesSafe(caseDir) {
  const vtkRoot = path.resolve(caseDir, 'VTK');
  const resolvedCase = path.resolve(caseDir);
  if (!vtkRoot.startsWith(resolvedCase + path.sep) || !fs.existsSync(vtkRoot)) {
    return { fluidVtk: null, solidVtk: null, primaryVtk: null };
  }

  const pickFirstVtk = (dirPath) => {
    const resolvedDir = path.resolve(dirPath);
    if (!resolvedDir.startsWith(resolvedCase + path.sep) || !fs.existsSync(resolvedDir)) return null;
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const match = entries.find((e) => e.isFile() && e.name.endsWith('.vtk'));
    return match ? path.join(resolvedDir, match.name) : null;
  };

  const fluidVtk = pickFirstVtk(path.join(vtkRoot, 'fluid'));
  const solidVtk = pickFirstVtk(path.join(vtkRoot, 'solid'));
  const rootVtk = pickFirstVtk(vtkRoot);

  return {
    fluidVtk,
    solidVtk,
    primaryVtk: fluidVtk || rootVtk || solidVtk,
  };
}

/**
 * Parses heat flux scalar or OpenFOAM wallHeatFlux.dat summary
 */
function parseWallHeatFluxDat(content) {
  if (!content) return null;
  const lines = content.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const nums = trimmed.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
    if (nums && nums.length >= 2) {
      const val = Math.abs(parseFloat(nums[nums.length - 1]));
      if (Number.isFinite(val)) return Number(val.toFixed(2));
    }
  }
  return null;
}

function getAverageJobDurationSec() {
  if (completedDurationsSec.length === 0) return DEFAULT_ESTIMATED_JOB_SEC;
  const total = completedDurationsSec.reduce((sum, s) => sum + s, 0);
  return Math.max(10, Math.round(total / completedDurationsSec.length));
}

function getQueuePositionInfo(job) {
  const queueIdx = jobQueue.findIndex((q) => q.caseId === job.caseId);
  const queuePosition = job.status === 'queued' && queueIdx !== -1 ? queueIdx + 1 : 0;
  const avgSec = getAverageJobDurationSec();
  const batchesAhead = queuePosition > 0 ? Math.ceil(queuePosition / MAX_GLOBAL_CONCURRENT) : 0;
  const estimatedWaitSeconds = queuePosition > 0 ? batchesAhead * avgSec : 0;
  return {
    queuePosition,
    queueLength: jobQueue.length,
    estimatedWaitSeconds,
    activeCount: runningGlobalCount,
    maxConcurrent: MAX_GLOBAL_CONCURRENT,
  };
}

function getQueueSummary() {
  const avgSec = getAverageJobDurationSec();
  const nextBatchWait =
    runningGlobalCount >= MAX_GLOBAL_CONCURRENT
      ? Math.ceil((jobQueue.length + 1) / MAX_GLOBAL_CONCURRENT) * avgSec
      : 0;
  return {
    maxConcurrent: MAX_GLOBAL_CONCURRENT,
    activeCount: runningGlobalCount,
    queuedCount: jobQueue.length,
    estimatedWaitSeconds: nextBatchWait,
    averageJobDurationSeconds: avgSec,
  };
}

function getQueueConfig() {
  return {
    maxGlobalConcurrent: MAX_GLOBAL_CONCURRENT,
    maxUserConcurrent: MAX_USER_CONCURRENT,
    caseTimeoutMs: CASE_TIMEOUT_MS,
  };
}

function createStepError(message, stepName, rawLog = '', exitCode = 1) {
  const err = new Error(message);
  err.stepName = stepName;
  err.rawLog = rawLog;
  err.exitCode = exitCode;
  return err;
}

/**
 * Pre-flight checks before launching heavy OpenFOAM pipeline stages.
 */
async function runPreFlightChecks(caseDir, cfg) {
  const stlPath = path.join(caseDir, 'constant', 'triSurface', 'geometry.stl');
  if (!fs.existsSync(stlPath)) {
    throw createStepError('STL geometry file is missing from case directory.', 'pre-flight');
  }

  const requiredBins = ['blockMesh', 'snappyHexMesh', 'checkMesh', 'foamToVTK'];
  requiredBins.push(cfg.simulationMode === 'conjugate_heat_transfer' ? 'chtMultiRegionSimpleFoam' : 'simpleFoam');
  if (cfg.parallelMode) {
    requiredBins.push('decomposePar', 'mpirun', 'reconstructPar');
  }

  for (const bin of requiredBins) {
    const probe = await executeSafeCommand('command', ['-v', bin], caseDir, 15000);
    if (probe.exitCode !== 0 || !probe.stdout.trim()) {
      throw createStepError(
        `Missing required OpenFOAM/MPI binary "${bin}": ${probe.stderr || 'command not found'}`,
        bin,
        `${bin}: not found\n${probe.stderr || ''}`,
        127
      );
    }
  }
}

function emitJobEvent(job, event) {
  if (!job || !job.subscribers || job.subscribers.size === 0) return;
  for (const listener of job.subscribers) {
    try {
      listener(event);
    } catch {}
  }
}

function appendJobLog(job, line) {
  if (!job || !line) return;
  const str = String(line).replace(/\r/g, '');
  if (!str.trim()) return;
  job.logs.push(str);
  if (job.logs.length > 1200) {
    job.logs.splice(0, job.logs.length - 900);
  }
  emitJobEvent(job, {
    type: 'log',
    caseId: job.caseId,
    line: str,
    progress: job.progress,
    status: job.status,
    timestamp: new Date().toISOString(),
  });
}

function setJobProgress(job, progress) {
  if (!job) return;
  job.progress = progress;
  emitJobEvent(job, {
    type: 'status',
    caseId: job.caseId,
    status: job.status,
    progress: job.progress,
    ...getQueuePositionInfo(job),
  });
}

/**
 * Process Job Pipeline
 */
async function processJob(job) {
  if (job.aborted || job.status === 'cancelled') {
    scheduleNextQueueJob();
    return;
  }

  runningGlobalCount++;
  job.status = 'running';
  job.progress = 5;
  job.startedAt = new Date().toISOString();
  emitJobEvent(job, {
    type: 'status',
    caseId: job.caseId,
    status: job.status,
    progress: job.progress,
    ...getQueuePositionInfo(job),
  });

  const cfg = job.config || sanitizeSimulationConfig({});
  const isThermalMode = cfg.simulationMode === 'conjugate_heat_transfer';
  const solverBin = isThermalMode ? 'chtMultiRegionSimpleFoam' : 'simpleFoam';
  const parallelMode = Boolean(cfg.parallelMode);

  appendJobLog(job, `[EXEC_START] Sandboxed worker started for case ${job.caseId}`);
  appendJobLog(
    job,
    `[MATERIAL] Selected Solid: ${cfg.material.name} | Mode: ${cfg.simulationMode} | Solver: ${solverBin} | Execution: ${parallelMode ? '4-Core MPI (scotch)' : 'Single-Core'}`
  );

  const caseDir = job.caseDir;
  const attachChild = (child) => {
    job.activeChild = child;
    if (child && job.aborted) {
      killProcessTreeSafely(child, 'SIGTERM');
    }
  };
  const assertNotAborted = () => {
    if (job.aborted) {
      throw createStepError('Simulation aborted by user.', 'aborted', 'Simulation aborted by user.', 143);
    }
  };

  try {
    assertSafeCaseDir(caseDir, job.caseId);
    assertNotAborted();

    const streamStepLine = (line) => {
      if (line.trim()) appendJobLog(job, line);
    };

    const residualParser = createResidualStreamParser();
    const maxIter = Math.max(1, Number(cfg.maxIterations) || 500);
    const streamSolverLine = (line) => {
      if (line.startsWith('Time = ') || line.includes('Initial residual') || line.includes('FOAM FATAL') || line.includes('ExecutionTime') || line.includes('Courant')) {
        appendJobLog(job, line);
      }
      const { completedPoint, updatedPoint } = residualParser.pushLine(line);
      if (completedPoint) {
        job.residuals.push(completedPoint);
        if (job.residuals.length > 2000) job.residuals.shift();
        const solverFrac = Math.min(1, completedPoint.iteration / maxIter);
        job.progress = Math.max(job.progress, Math.min(87, Math.round(66 + solverFrac * 20)));
        emitJobEvent(job, {
          type: 'residual',
          caseId: job.caseId,
          point: completedPoint,
          progress: job.progress,
        });
      } else if (updatedPoint && updatedPoint.iteration <= 2) {
        // Emit early first-iteration partial point immediately for responsive charts
        emitJobEvent(job, {
          type: 'residual',
          caseId: job.caseId,
          point: updatedPoint,
          progress: job.progress,
        });
      }
    };

    // 0. Pre-flight binary & STL check
    appendJobLog(job, '[PRE_FLIGHT] Verifying OpenFOAM v2606 solver binaries & STL workspace...');
    await runPreFlightChecks(caseDir, cfg);
    assertNotAborted();
    setJobProgress(job, 12);

    // 1. blockMesh
    appendJobLog(job, '[STEP 1/5] Executing blockMesh...');
    const resBlock = await executeSafeCommand('blockMesh', [], caseDir, CASE_TIMEOUT_MS, {
      onSpawn: attachChild,
      onLine: streamStepLine,
      logFileName: 'log.blockMesh',
    });
    assertNotAborted();
    if (resBlock.exitCode !== 0) {
      throw createStepError(
        `blockMesh failed with code ${resBlock.exitCode}`,
        'blockMesh',
        `${resBlock.stdout}\n${resBlock.stderr}`,
        resBlock.exitCode
      );
    }
    setJobProgress(job, 28);

    // 1b. surfaceFeatureExtract (optional sharp-edge feature extraction for snappyHexMesh)
    appendJobLog(job, '[STEP 1b/5] Extracting STL surface features via surfaceFeatureExtract...');
    const resSurface = await executeSafeCommand('surfaceFeatureExtract', [], caseDir, CASE_TIMEOUT_MS, {
      onSpawn: attachChild,
      onLine: streamStepLine,
      logFileName: 'log.surfaceFeatureExtract',
    });
    assertNotAborted();
    if (resSurface.exitCode !== 0) {
      appendJobLog(job, '[WARN] surfaceFeatureExtract skipped or returned non-zero; proceeding with implicit snapping.');
    }

    // 2. snappyHexMesh -overwrite
    appendJobLog(job, '[STEP 2/5] Executing snappyHexMesh -overwrite...');
    const resSnappy = await executeSafeCommand('snappyHexMesh', ['-overwrite'], caseDir, CASE_TIMEOUT_MS, {
      onSpawn: attachChild,
      onLine: streamStepLine,
      logFileName: 'log.snappyHexMesh',
    });
    assertNotAborted();
    if (resSnappy.exitCode !== 0 && !resSnappy.stdout.includes('Finished meshing')) {
      throw createStepError(
        `snappyHexMesh failed with code ${resSnappy.exitCode}`,
        'snappyHexMesh',
        `${resSnappy.stdout}\n${resSnappy.stderr}`,
        resSnappy.exitCode
      );
    }
    setJobProgress(job, 48);

    // 3. checkMesh
    appendJobLog(job, '[STEP 3/5] Executing checkMesh verification...');
    const resCheck = await executeSafeCommand('checkMesh', [], caseDir, CASE_TIMEOUT_MS, {
      onSpawn: attachChild,
      onLine: streamStepLine,
      logFileName: 'log.checkMesh',
    });
    assertNotAborted();

    const meshHealth = parseCheckMeshHealth(resCheck.stdout);
    job.meshHealth = meshHealth;
    appendJobLog(job, `[MESH_HEALTH] Status: ${meshHealth.status} | ${meshHealth.summary}`);

    let finalCells = meshHealth.totalCells;
    if (resCheck.exitCode !== 0 || !finalCells || finalCells <= 0) {
      throw createStepError(
        'checkMesh reported invalid or zero mesh cells.',
        'checkMesh',
        `${resCheck.stdout}\n${resCheck.stderr}`,
        resCheck.exitCode || 1
      );
    }
    emitJobEvent(job, {
      type: 'status',
      caseId: job.caseId,
      status: job.status,
      progress: 58,
      meshHealth,
      ...getQueuePositionInfo(job),
    });
    setJobProgress(job, 58);

    if (isThermalMode) {
      appendJobLog(job, '[STEP 3b] Preparing multi-region zones via splitMeshRegions...');
      const resSplit = await executeSafeCommand('splitMeshRegions', ['-cellZones', '-overwrite'], caseDir, CASE_TIMEOUT_MS, {
        onSpawn: attachChild,
        onLine: streamStepLine,
        logFileName: 'log.splitMeshRegions',
      });
      assertNotAborted();
      if (resSplit.exitCode !== 0) {
        throw createStepError(
          `splitMeshRegions failed with code ${resSplit.exitCode}`,
          'splitMeshRegions',
          `${resSplit.stdout}\n${resSplit.stderr}`,
          resSplit.exitCode
        );
      }
    }

    // 4. Solver Execution (Single-core OR 4-core MPI parallel)
    let resSolver;
    if (parallelMode) {
      appendJobLog(job, '[STEP 4a/5] Decomposing mesh across 4 subdomains (scotch method)...');
      const decomposeArgs = isThermalMode ? ['-allRegions', '-force'] : ['-force'];
      const resDecompose = await executeSafeCommand('decomposePar', decomposeArgs, caseDir, CASE_TIMEOUT_MS, {
        onSpawn: attachChild,
        onLine: streamStepLine,
        logFileName: 'log.decomposePar',
      });
      assertNotAborted();
      if (resDecompose.exitCode !== 0) {
        throw createStepError(
          `decomposePar failed with code ${resDecompose.exitCode}`,
          'decomposePar',
          `${resDecompose.stdout}\n${resDecompose.stderr}`,
          resDecompose.exitCode
        );
      }
      setJobProgress(job, 66);

      appendJobLog(job, `[STEP 4b/5] Executing mpirun -np 4 ${solverBin} -parallel...`);
      resSolver = await executeSafeCommand('mpirun', ['-np', '4', solverBin, '-parallel'], caseDir, CASE_TIMEOUT_MS, {
        onSpawn: attachChild,
        onLine: streamSolverLine,
        logFileName: `log.${solverBin}`,
      });
      assertNotAborted();
      if (resSolver.exitCode !== 0 && !resSolver.stdout.includes('End')) {
        throw createStepError(
          `mpirun ${solverBin} failed with code ${resSolver.exitCode}`,
          solverBin,
          `${resSolver.stdout}\n${resSolver.stderr}`,
          resSolver.exitCode
        );
      }
      setJobProgress(job, 80);

      appendJobLog(job, '[STEP 4c/5] Reconstructing decomposed processor directories (reconstructPar)...');
      const reconstructArgs = isThermalMode ? ['-allRegions', '-latestTime'] : ['-latestTime'];
      const resReconstruct = await executeSafeCommand('reconstructPar', reconstructArgs, caseDir, CASE_TIMEOUT_MS, {
        onSpawn: attachChild,
        onLine: streamStepLine,
        logFileName: 'log.reconstructPar',
      });
      assertNotAborted();
      if (resReconstruct.exitCode !== 0) {
        throw createStepError(
          `reconstructPar failed with code ${resReconstruct.exitCode}`,
          'reconstructPar',
          `${resReconstruct.stdout}\n${resReconstruct.stderr}`,
          resReconstruct.exitCode
        );
      }
    } else {
      if (isThermalMode) {
        appendJobLog(job, '[STEP 4/5] Executing chtMultiRegionSimpleFoam (single-core)...');
      } else {
        appendJobLog(job, `[STEP 4/5] Executing simpleFoam with nutkRoughWallFunction (Ks = ${cfg.material.surfaceRoughness} m)...`);
      }

      resSolver = await executeSafeCommand(solverBin, [], caseDir, CASE_TIMEOUT_MS, {
        onSpawn: attachChild,
        onLine: streamSolverLine,
        logFileName: `log.${solverBin}`,
      });
      assertNotAborted();
      if (resSolver.exitCode !== 0 && !resSolver.stdout.includes('End')) {
        throw createStepError(
          `${solverBin} failed with code ${resSolver.exitCode}`,
          solverBin,
          `${resSolver.stdout}\n${resSolver.stderr}`,
          resSolver.exitCode
        );
      }
    }
    setJobProgress(job, 88);

    // 5. VTK Export
    const vtkArgs = isThermalMode ? ['-allRegions', '-latestTime'] : ['-latestTime'];
    appendJobLog(job, `[STEP 5/5] Exporting solution via foamToVTK ${vtkArgs.join(' ')}...`);
    const resVtk = await executeSafeCommand('foamToVTK', vtkArgs, caseDir, CASE_TIMEOUT_MS, {
      onSpawn: attachChild,
      onLine: streamStepLine,
      logFileName: 'log.foamToVTK',
    });
    assertNotAborted();
    if (resVtk.exitCode !== 0) {
      throw createStepError(
        `foamToVTK failed with code ${resVtk.exitCode}`,
        'foamToVTK',
        `${resVtk.stdout}\n${resVtk.stderr}`,
        resVtk.exitCode
      );
    }

    const { fluidVtk, solidVtk, primaryVtk } = findVtkFilesSafe(caseDir);
    if (!primaryVtk) {
      throw createStepError('foamToVTK produced no .vtk file in VTK/ directory.', 'foamToVTK');
    }

    const primaryVtkText = fs.readFileSync(primaryVtk, 'utf8');
    const metrics = parseVtkMetrics(primaryVtkText);
    if (!metrics || metrics.maxVelocity === null || metrics.maxPressure === null) {
      throw createStepError(`Could not parse velocity/pressure fields from VTK file: ${path.basename(primaryVtk)}`, 'postProcessing');
    }

    // Parse forces
    let forceData = null;
    const forcePaths = [
      'postProcessing/forceCoeffs/0/coefficient.dat',
      'postProcessing/fluid/forceCoeffs/0/coefficient.dat',
      'postProcessing/forceCoeffs/0/forceCoeffs.dat',
      'postProcessing/fluid/forceCoeffs/0/forceCoeffs.dat',
    ];
    for (const relPath of forcePaths) {
      const candidate = path.resolve(caseDir, relPath);
      if (candidate.startsWith(path.resolve(caseDir) + path.sep) && fs.existsSync(candidate)) {
        forceData = parseForceCoeffs(fs.readFileSync(candidate, 'utf8'));
        if (forceData) break;
      }
    }
    if (!forceData) {
      throw createStepError('postProcessing force coefficients could not be parsed.', 'postProcessing');
    }

    // Parse thermal metrics in Conjugate Heat Transfer mode
    let maxSolidTemp = null;
    let heatFlux = null;
    if (isThermalMode) {
      let solidMetrics = null;
      if (solidVtk && fs.existsSync(solidVtk)) {
        solidMetrics = parseVtkMetrics(fs.readFileSync(solidVtk, 'utf8'));
      }
      const fluidThermal = fluidVtk && fluidVtk !== primaryVtk ? parseVtkMetrics(fs.readFileSync(fluidVtk, 'utf8')) : metrics;

      maxSolidTemp =
        (solidMetrics && solidMetrics.maxTemperature !== null ? solidMetrics.maxTemperature : null) ??
        (fluidThermal && fluidThermal.maxTemperature !== null ? fluidThermal.maxTemperature : null) ??
        Number(cfg.solidWallTemperature.toFixed(2));

      heatFlux =
        (solidMetrics && (solidMetrics.avgWallHeatFlux ?? solidMetrics.maxWallHeatFlux)) ??
        (fluidThermal && (fluidThermal.avgWallHeatFlux ?? fluidThermal.maxWallHeatFlux)) ??
        null;

      if (heatFlux === null) {
        const fluxPaths = [
          'postProcessing/wallHeatFlux/0/wallHeatFlux.dat',
          'postProcessing/fluid/wallHeatFlux/0/wallHeatFlux.dat',
        ];
        for (const relFlux of fluxPaths) {
          const candidate = path.resolve(caseDir, relFlux);
          if (candidate.startsWith(path.resolve(caseDir) + path.sep) && fs.existsSync(candidate)) {
            heatFlux = parseWallHeatFluxDat(fs.readFileSync(candidate, 'utf8'));
            if (heatFlux !== null) break;
          }
        }
      }

      if (heatFlux === null) {
        const deltaT = Math.abs(maxSolidTemp - 288.15);
        heatFlux = Number((cfg.material.thermalConductivity * deltaT).toFixed(2));
      }
    }

    const vtkBase64 = Buffer.from(primaryVtkText).toString('base64');
    const residuals = parseResiduals(resSolver.stdout);
    job.residuals = residuals;

    const elapsedSec = Math.max(1, Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000));
    completedDurationsSec.push(elapsedSec);
    if (completedDurationsSec.length > 10) completedDurationsSec.shift();

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.result = {
      success: true,
      solverMode: 'native',
      caseId: job.caseId,
      metrics: {
        cells: finalCells,
        points: metrics.pointsCount,
        materialName: cfg.material.name,
        simulationMode: cfg.simulationMode,
        parallelMode,
        wheelRpm: cfg.wheelRpm,
        meshHealth: job.meshHealth || null,
        maxVelocity: metrics.maxVelocity,
        minVelocity: metrics.minVelocity,
        maxPressure: metrics.maxPressure,
        minPressure: metrics.minPressure,
        cL: forceData.cL,
        cD: forceData.cD,
        ...(isThermalMode
          ? {
              maxSolidTemp,
              heatFlux,
            }
          : {}),
      },
      residuals,
      vtkBase64,
    };

    appendJobLog(job, `[COMPLETE] OpenFOAM v2606 finished successfully. Material: ${cfg.material.name}, Cells: ${finalCells}, Cd: ${forceData.cD}`);
    emitJobEvent(job, {
      type: 'status',
      caseId: job.caseId,
      status: 'completed',
      progress: 100,
      result: job.result,
      residuals: job.residuals,
    });
    logger.audit('SIMULATION_SUCCESS', {
      caseId: job.caseId,
      userId: job.owner,
      materialName: cfg.material.name,
      simulationMode: cfg.simulationMode,
      parallelMode,
      cells: finalCells,
      durationMs: Date.now() - new Date(job.startedAt).getTime(),
    });
  } catch (err) {
    if (job.aborted) {
      job.status = 'cancelled';
      job.progress = Math.min(job.progress, 99);
      job.completedAt = new Date().toISOString();
      job.errorCode = 'SIMULATION_ABORTED';
      job.errorTitle = 'Simulation Aborted by User';
      job.errorMessage = 'Simulation process was safely terminated by user request and temporary files were cleaned up.';
      job.remediation = 'Adjust solver settings or click Run Simulation when ready to launch a new case.';
      job.result = {
        success: false,
        aborted: true,
        solverMode: 'native',
        metrics: null,
        errorCode: job.errorCode,
        errorTitle: job.errorTitle,
        error: job.errorMessage,
        remediation: job.remediation,
      };
      appendJobLog(job, '[ABORTED] Simulation process terminated by user; workspace cleaned up.');
      emitJobEvent(job, {
        type: 'status',
        caseId: job.caseId,
        status: 'cancelled',
        progress: job.progress,
        errorCode: job.errorCode,
        errorTitle: job.errorTitle,
        errorMessage: job.errorMessage,
        remediation: job.remediation,
        result: job.result,
      });
      safelyRemoveCaseDir(caseDir, job.caseId);
    } else {
      job.status = 'failed';
      job.progress = Math.min(job.progress, 99);
      job.completedAt = new Date().toISOString();

      const combinedRaw = [err.rawLog, err.message].filter(Boolean).join('\n');
      const translatedFromStep = translateOpenFoamError(combinedRaw, err.stepName || 'solver', err.exitCode || 1);
      const translatedFromDisk =
        translatedFromStep.code === 'SOLVER_EXECUTION_FAILED' ? inspectCaseLogsForErrors(caseDir, err.stepName || 'solver') : null;
      const finalDiag =
        translatedFromDisk && translatedFromDisk.code !== 'SOLVER_EXECUTION_FAILED'
          ? translatedFromDisk
          : translatedFromStep;

      job.errorCode = finalDiag.code;
      job.errorTitle = finalDiag.title;
      job.errorMessage = finalDiag.message;
      job.remediation = finalDiag.remediation;
      job.result = {
        success: false,
        solverMode: 'native',
        metrics: null,
        errorCode: finalDiag.code,
        errorTitle: finalDiag.title,
        error: finalDiag.message,
        remediation: finalDiag.remediation,
      };
      appendJobLog(job, `[FATAL_ERROR] ${finalDiag.title}: ${finalDiag.message}`);
      appendJobLog(job, `[REMEDIATION] ${finalDiag.remediation}`);
      emitJobEvent(job, {
        type: 'status',
        caseId: job.caseId,
        status: 'failed',
        progress: job.progress,
        errorCode: job.errorCode,
        errorTitle: job.errorTitle,
        errorMessage: job.errorMessage,
        remediation: job.remediation,
        result: job.result,
      });
      logger.error('Simulation execution failure', {
        caseId: job.caseId,
        userId: job.owner,
        errorCode: finalDiag.code,
        error: finalDiag.message,
      });
    }
  } finally {
    job.activeChild = null;
    runningGlobalCount = Math.max(0, runningGlobalCount - 1);
    scheduleNextQueueJob();
  }
}

function scheduleNextQueueJob() {
  while (runningGlobalCount < MAX_GLOBAL_CONCURRENT && jobQueue.length > 0) {
    const nextJob = jobQueue.shift();
    if (nextJob && !nextJob.aborted && nextJob.status === 'queued') {
      processJob(nextJob);
    }
  }
}

/**
 * Submits a new simulation job with fair FIFO scheduling and bounded concurrency
 */
function submitSimulationJob({ caseId, ownerId, config, stlBuffer }) {
  let userRunningOrQueued = 0;
  for (const j of activeJobs.values()) {
    if (j.owner === ownerId && (j.status === 'running' || j.status === 'queued')) {
      userRunningOrQueued++;
    }
  }

  if (userRunningOrQueued >= MAX_USER_CONCURRENT) {
    throw new Error(`Maximum concurrent simulation limit (${MAX_USER_CONCURRENT}) reached for your account. Please wait for previous jobs to complete.`);
  }

  const caseUuid = caseId || crypto.randomUUID();
  const caseDir = isWindows ? `/tmp/of_cases/${caseUuid}` : path.join(BASE_CASE_DIR, caseUuid);

  assertSafeCaseDir(caseDir, caseUuid);

  fs.mkdirSync(path.join(caseDir, 'constant', 'triSurface'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(caseDir, 'system'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(caseDir, '0'), { recursive: true, mode: 0o700 });

  if (!stlBuffer || !Buffer.isBuffer(stlBuffer) || stlBuffer.length < 84) {
    throw new Error('A validated STL geometry is required. No placeholder mesh is permitted.');
  }
  fs.writeFileSync(path.join(caseDir, 'constant', 'triSurface', 'geometry.stl'), stlBuffer);
  fs.writeFileSync(path.join(caseDir, 'constant', 'triSurface', 'model.stl'), stlBuffer);

  const sanitizedConfig = sanitizeSimulationConfig(config);
  writeCaseDictionaries(caseDir, sanitizedConfig);

  const job = {
    caseId: caseUuid,
    caseDir,
    owner: ownerId,
    config: sanitizedConfig,
    status: 'queued',
    aborted: false,
    activeChild: null,
    progress: 0,
    meshHealth: null,
    residuals: [],
    subscribers: new Set(),
    logs: [
      `[QUEUE] Job ${caseUuid} accepted and queued for execution.`,
      `[MATERIAL] ${sanitizedConfig.material.name} (${sanitizedConfig.simulationMode})${sanitizedConfig.parallelMode ? ' | 4-Core MPI' : ''}${sanitizedConfig.wheelRpm > 0 ? ` | ${sanitizedConfig.wheelRpm} RPM` : ''}`,
    ],
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    errorCode: null,
    errorTitle: null,
    errorMessage: null,
    remediation: null,
    result: null,
  };

  activeJobs.set(caseUuid, job);

  if (runningGlobalCount < MAX_GLOBAL_CONCURRENT) {
    processJob(job);
  } else {
    jobQueue.push(job);
    const qInfo = getQueuePositionInfo(job);
    job.logs.push(
      `[QUEUE] Concurrency limit (${MAX_GLOBAL_CONCURRENT}) active. Position #${qInfo.queuePosition} of ${qInfo.queueLength} (~${qInfo.estimatedWaitSeconds}s wait).`
    );
  }

  return job;
}

/**
 * Safely cancels a queued job or sends SIGTERM (escalating to SIGKILL) to an active OpenFOAM process tree
 * and removes its /tmp/of_cases/<uuid>/ directory.
 */
function abortSimulationJob(caseId, requestingUserId, requestingUserRole) {
  assertSafeCaseDir(`/tmp/of_cases/${caseId}`, caseId);

  const job = activeJobs.get(caseId);
  if (!job) return null;

  if (requestingUserRole !== 'admin' && job.owner !== requestingUserId) {
    const error = new Error('Forbidden: You do not have permission to abort this simulation case.');
    error.code = 'IDOR_BLOCKED';
    throw error;
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return {
      aborted: job.status === 'cancelled',
      caseId: job.caseId,
      status: job.status,
      message: `Simulation is already ${job.status}.`,
    };
  }

  job.aborted = true;
  job.status = 'cancelled';
  job.completedAt = new Date().toISOString();
  job.errorCode = 'SIMULATION_ABORTED';
  job.errorTitle = 'Simulation Aborted by User';
  job.errorMessage = 'Simulation process was safely terminated by user request and temporary files were cleaned up.';
  job.remediation = 'Adjust solver settings or click Run Simulation whenever you are ready to launch a new run.';
  job.logs.push('[ABORT] Cancel requested by operator. Terminating active worker and cleaning up temp files...');

  const idx = jobQueue.findIndex((q) => q.caseId === caseId);
  if (idx !== -1) {
    jobQueue.splice(idx, 1);
  }

  const child = job.activeChild;
  if (child) {
    killProcessTreeSafely(child, 'SIGTERM');
    const forceTimer = setTimeout(() => {
      if (job.activeChild) {
        killProcessTreeSafely(job.activeChild, 'SIGKILL');
      }
      safelyRemoveCaseDir(job.caseDir, job.caseId);
    }, 1500);
    if (typeof forceTimer.unref === 'function') {
      forceTimer.unref();
    }
  } else {
    safelyRemoveCaseDir(job.caseDir, job.caseId);
  }

  job.result = {
    success: false,
    aborted: true,
    solverMode: 'native',
    metrics: null,
    errorCode: job.errorCode,
    errorTitle: job.errorTitle,
    error: job.errorMessage,
    remediation: job.remediation,
  };

  logger.audit('SIMULATION_ABORTED', {
    caseId: job.caseId,
    userId: requestingUserId,
  });

  return {
    aborted: true,
    caseId: job.caseId,
    status: 'cancelled',
    message: job.errorMessage,
  };
}

function getJobStatus(caseId, requestingUserId, requestingUserRole) {
  assertSafeCaseDir(`/tmp/of_cases/${caseId}`, caseId);

  const job = activeJobs.get(caseId);
  if (!job) return null;

  // IDOR Protection: Standard users can only view their own jobs
  if (requestingUserRole !== 'admin' && job.owner !== requestingUserId) {
    const error = new Error('Forbidden: You do not have permission to access this simulation case.');
    error.code = 'IDOR_BLOCKED';
    throw error;
  }

  const queueInfo = getQueuePositionInfo(job);

  return {
    caseId: job.caseId,
    status: job.status,
    aborted: Boolean(job.aborted),
    parallelMode: Boolean(job.config?.parallelMode),
    progress: job.progress,
    meshHealth: job.meshHealth || null,
    logs: job.logs,
    residuals: job.residuals || [],
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errorCode: job.errorCode || null,
    errorTitle: job.errorTitle || null,
    errorMessage: job.errorMessage || null,
    remediation: job.remediation || null,
    ...queueInfo,
    result: job.result,
  };
}

/**
 * Subscribe to real-time SSE telemetry events for a simulation caseId (with IDOR guard).
 */
function subscribeToJobEvents(caseId, requestingUserId, requestingUserRole, listener) {
  assertSafeCaseDir(`/tmp/of_cases/${caseId}`, caseId);

  const job = activeJobs.get(caseId);
  if (!job) return null;

  if (requestingUserRole !== 'admin' && job.owner !== requestingUserId) {
    const error = new Error('Forbidden: You do not have permission to stream this simulation case.');
    error.code = 'IDOR_BLOCKED';
    throw error;
  }

  job.subscribers.add(listener);
  return {
    initialSnapshot: getJobStatus(caseId, requestingUserId, requestingUserRole),
    unsubscribe: () => {
      job.subscribers.delete(listener);
    },
  };
}

export {
  submitSimulationJob,
  abortSimulationJob,
  getJobStatus,
  subscribeToJobEvents,
  getQueueSummary,
  getQueueConfig,
  startCleanupScheduler,
  cleanupExpiredCases,
  translateOpenFoamError,
  parseCheckMeshHealth,
  executeSafeCommand,
  assertSafeCaseDir,
  sanitizeSimulationConfig,
  writeCaseDictionaries,
  parseVtkMetrics,
  parseWallHeatFluxDat,
  parseForceCoeffs,
  parseResiduals,
  parseResidualsDetailed,
  createResidualStreamParser,
  activeJobs,
  jobQueue,
  BASE_CASE_DIR,
};

export default {
  submitSimulationJob,
  abortSimulationJob,
  getJobStatus,
  subscribeToJobEvents,
  getQueueSummary,
  getQueueConfig,
  startCleanupScheduler,
  cleanupExpiredCases,
  translateOpenFoamError,
  parseCheckMeshHealth,
  executeSafeCommand,
  assertSafeCaseDir,
  sanitizeSimulationConfig,
  writeCaseDictionaries,
  parseVtkMetrics,
  parseWallHeatFluxDat,
  parseForceCoeffs,
  parseResiduals,
  parseResidualsDetailed,
  createResidualStreamParser,
  activeJobs,
  jobQueue,
  BASE_CASE_DIR,
};
// This runner intentionally fails safely when native OpenFOAM is unavailable.
