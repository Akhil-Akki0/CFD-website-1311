/**
 * OpenFOAM Pre-Flight Validation, Fatal Log Translation & 24h Disk Cleanup
 *
 * DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
 */

import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_CASE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function sanitizeLogExcerpt(raw = '') {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/\/tmp\/of_cases\/[0-9a-f-]+/gi, '/of_case')
    .replace(/\/home\/[^\s/:]+/gi, '/home/[user]')
    .replace(/[\r\0]+/g, '')
    .trim();
}

function extractFoamFatalDetail(rawLog = '') {
  const match = rawLog.match(/FOAM FATAL (?:IO )?ERROR:?\s*([\s\S]{1,500})/i);
  if (!match) return '';
  const lines = match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('From function') && !l.startsWith('in file'))
    .slice(0, 3);
  return sanitizeLogExcerpt(lines.join(' | ')).slice(0, 260);
}

/**
 * Translates raw OpenFOAM / MPI / meshing stdout & stderr logs into clear,
 * actionable engineering error messages without exposing host paths.
 */
function translateOpenFoamError(rawLog = '', stepName = 'solver', exitCode = null) {
  const text = typeof rawLog === 'string' ? rawLog : String(rawLog || '');
  const fatalDetail = extractFoamFatalDetail(text);

  // 1. User-initiated abort / termination
  if (
    exitCode === 130 ||
    exitCode === 143 ||
    /aborted by user|cancelled by user|simulation cancelled/i.test(text)
  ) {
    return {
      code: 'SIMULATION_ABORTED',
      title: 'Simulation Aborted',
      message: 'Simulation process was safely terminated by user request and temporary files were cleaned up.',
      remediation: 'Adjust solver parameters or click Run Simulation whenever you are ready to launch a new run.',
      detailExcerpt: '',
    };
  }

  // 2. Execution timeout
  if (exitCode === 124 || /timed out after/i.test(text)) {
    return {
      code: 'EXECUTION_TIMEOUT',
      title: 'Solver Execution Timed Out',
      message: `OpenFOAM step "${stepName}" exceeded the maximum execution wall-time limit.`,
      remediation: 'Enable 4-Core MPI Parallel Execution, choose a coarser mesh resolution, or reduce maxIterations.',
      detailExcerpt: fatalDetail,
    };
  }

  // 3. Missing OpenFOAM / MPI binary or unsourced bashrc
  if (
    /command not found|not available|no such file or directory.*openfoam|missing required openfoam/i.test(text) ||
    /(blockMesh|snappyHexMesh|checkMesh|simpleFoam|chtMultiRegionSimpleFoam|decomposePar|mpirun|reconstructPar|foamToVTK):\s*not found/i.test(text)
  ) {
    return {
      code: 'OPENFOAM_UNAVAILABLE',
      title: 'OpenFOAM v2606 Environment Unavailable',
      message: `Required OpenFOAM binary is missing or not sourced on PATH during "${stepName}".`,
      remediation: 'Verify OpenFOAM v2606 (etc/bashrc) and OpenMPI are installed on the backend host and GET /readyz returns HTTP 200.',
      detailExcerpt: sanitizeLogExcerpt(text).slice(0, 220),
    };
  }

  // 4. Floating Point Exception / Divergence
  if (/floating point exception|sigfpe|fpe trap|nan detected|div\([^)]+\)\s*=\s*nan/i.test(text)) {
    return {
      code: 'FLOATING_POINT_EXCEPTION',
      title: 'Numerical Divergence (Floating Point Exception)',
      message: `The ${stepName} solver encountered a Floating Point Exception (NaN/Inf divergence) during field iteration.`,
      remediation: 'Lower inlet velocity, reduce target Courant CFL number, check STL watertightness, or verify solid thermal/viscosity inputs.',
      detailExcerpt: fatalDetail || 'Solver matrix residuals diverged to non-finite values.',
    };
  }

  // 5. Courant Number blowup / Continuity error
  const courantMatch = text.match(/Courant Number\s*(?:mean:\s*[0-9.eE+-]+\s*)?max:\s*([0-9.eE+-]+)/i);
  const maxCourant = courantMatch ? parseFloat(courantMatch[1]) : 0;
  if (
    /Courant Number.*?(exceeded|limit|inf|nan)|time step continuity errors.*\b(nan|inf|1e\+[0-9]+)/i.test(text) ||
    (Number.isFinite(maxCourant) && maxCourant > 10)
  ) {
    return {
      code: 'COURANT_LIMIT_EXCEEDED',
      title: 'Courant Number (CFL) Limit Exceeded',
      message:
        Number.isFinite(maxCourant) && maxCourant > 10
          ? `Max Courant Number reached ${maxCourant.toExponential(2)}, causing pressure-velocity coupling instability.`
          : 'Courant Number or continuity residual exceeded stability bounds during solver coupling.',
      remediation: 'Reduce inlet velocity, set a lower CFL target (< 1.0), or refine prism boundary layer spacing.',
      detailExcerpt: fatalDetail,
    };
  }

  // 6. MPI / Parallel Decomposition Failures
  if (
    stepName === 'decomposePar' ||
    stepName === 'reconstructPar' ||
    stepName === 'mpirun' ||
    /MPI_ABORT|not enough slots available|OpenRTE|PMIx|error in decomposePar|scotch/i.test(text)
  ) {
    return {
      code: 'MPI_EXECUTION_FAILED',
      title: 'MPI Parallel Execution Failed',
      message: `Parallel domain decomposition or 4-core MPI execution failed at step "${stepName}".`,
      remediation:
        'Verify OpenMPI and Scotch decomposition libraries are installed with 4 available CPU slots, or toggle off Multi-Core MPI mode for single-core execution.',
      detailExcerpt: fatalDetail || sanitizeLogExcerpt(text).slice(-240),
    };
  }

  // 7. snappyHexMesh / STL bounds / locationInMesh failures
  if (
    stepName === 'snappyHexMesh' ||
    /locationInMesh|Cannot find location in mesh|triSurfaceMesh|No surface intersections|Zero-sized cell/i.test(text)
  ) {
    return {
      code: 'MESH_GENERATION_FAILED',
      title: 'Surface Meshing Error (snappyHexMesh)',
      message: 'snappyHexMesh could not generate a valid volume mesh around the uploaded STL geometry.',
      remediation:
        'Ensure the STL mesh is watertight with consistent outward normals and fits comfortably inside the [-2, 4] x [-2, 2] x [-2, 2] meter domain.',
      detailExcerpt: fatalDetail || sanitizeLogExcerpt(text).slice(-240),
    };
  }

  // 8. checkMesh failures
  if (
    stepName === 'checkMesh' ||
    /Failed\s+[0-9]+\s+mesh checks|cells:\s*0\b|invalid or non-positive cell count/i.test(text)
  ) {
    return {
      code: 'CHECK_MESH_FAILED',
      title: 'Mesh Quality Verification Failed (checkMesh)',
      message: 'checkMesh detected zero valid cells or excessive non-orthogonality / skewness in the generated mesh.',
      remediation: 'Re-export the STL with clean manifold triangles and avoid ultra-thin sharp slivers smaller than the base cell size.',
      detailExcerpt: fatalDetail || sanitizeLogExcerpt(text).slice(-240),
    };
  }

  // 9. Explicit FOAM FATAL ERROR / FOAM FATAL IO ERROR
  if (/FOAM FATAL (?:IO )?ERROR/i.test(text)) {
    return {
      code: 'FOAM_FATAL_ERROR',
      title: `FOAM FATAL ERROR (${stepName})`,
      message: fatalDetail
        ? `OpenFOAM reported a fatal error in "${stepName}": ${fatalDetail}`
        : `OpenFOAM reported a fatal error while executing "${stepName}".`,
      remediation: 'Check patch boundaries, STL geometry alignment, and solver dictionary settings before re-running.',
      detailExcerpt: fatalDetail,
    };
  }

  // 10. Generic failure
  const cleanSummary = sanitizeLogExcerpt(text).split('\n').slice(-4).join(' ').slice(0, 260);
  return {
    code: 'SOLVER_EXECUTION_FAILED',
    title: `OpenFOAM Step Failed (${stepName})`,
    message: cleanSummary || `OpenFOAM step "${stepName}" exited unexpectedly (code ${exitCode ?? 'unknown'}).`,
    remediation: 'Inspect Developer Diagnostic Details below for the exact solver stdout/stderr trace.',
    detailExcerpt: cleanSummary,
  };
}

/**
 * Inspects persisted log.* files inside a case directory to surface the most specific OpenFOAM fatal diagnostic.
 */
function inspectCaseLogsForErrors(caseDir, preferredStep = 'solver') {
  const orderedLogs = [
    { file: 'log.chtMultiRegionSimpleFoam', step: 'chtMultiRegionSimpleFoam' },
    { file: 'log.simpleFoam', step: 'simpleFoam' },
    { file: 'log.reconstructPar', step: 'reconstructPar' },
    { file: 'log.decomposePar', step: 'decomposePar' },
    { file: 'log.checkMesh', step: 'checkMesh' },
    { file: 'log.snappyHexMesh', step: 'snappyHexMesh' },
    { file: 'log.blockMesh', step: 'blockMesh' },
    { file: 'log.foamToVTK', step: 'foamToVTK' },
  ];

  const resolvedCase = path.resolve(caseDir);
  for (const item of orderedLogs) {
    const candidate = path.resolve(resolvedCase, item.file);
    if (!candidate.startsWith(resolvedCase + path.sep) || !fs.existsSync(candidate)) continue;
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      if (
        /FOAM FATAL|floating point exception|SIGFPE|Courant Number.*exceeded|Failed\s+[0-9]+\s+mesh checks|MPI_ABORT/i.test(
          content
        )
      ) {
        return translateOpenFoamError(content, item.step, 1);
      }
    } catch {
      // Ignore transient log read errors
    }
  }

  return translateOpenFoamError('', preferredStep, 1);
}

/**
 * Safely deletes expired /tmp/of_cases/<uuid>/ directories older than maxAgeMs (default 24 hours).
 * Never removes symlinks, non-UUID directories, or currently running/queued cases.
 */
function cleanupExpiredCases({
  baseDir = '/tmp/of_cases',
  maxAgeMs = DEFAULT_CASE_MAX_AGE_MS,
  nowMs = Date.now(),
  protectedCaseIds = new Set(),
} = {}) {
  const result = { scanned: 0, deleted: [], skipped: 0 };
  const resolvedBase = path.resolve(baseDir);

  if (!fs.existsSync(resolvedBase)) {
    return result;
  }

  let entries;
  try {
    entries = fs.readdirSync(resolvedBase, { withFileTypes: true });
  } catch (err) {
    logger.warn('Failed to scan temporary OpenFOAM case directory for cleanup', {
      error: err.message,
    });
    return result;
  }

  for (const entry of entries) {
    result.scanned++;
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      result.skipped++;
      continue;
    }
    if (!UUID_REGEX.test(entry.name) || protectedCaseIds.has(entry.name)) {
      result.skipped++;
      continue;
    }

    const candidate = path.resolve(resolvedBase, entry.name);
    if (!candidate.startsWith(resolvedBase + path.sep)) {
      result.skipped++;
      continue;
    }

    try {
      const stat = fs.statSync(candidate);
      const ageMs = nowMs - stat.mtimeMs;
      if (ageMs >= maxAgeMs) {
        fs.rmSync(candidate, { recursive: true, force: true });
        result.deleted.push(entry.name);
      } else {
        result.skipped++;
      }
    } catch (err) {
      logger.warn('Failed to remove expired simulation case directory', {
        caseId: entry.name,
        error: err.message,
      });
      result.skipped++;
    }
  }

  if (result.deleted.length > 0) {
    logger.info('Completed scheduled /tmp/of_cases cleanup', {
      deletedCount: result.deleted.length,
      maxAgeHours: Number((maxAgeMs / (60 * 60 * 1000)).toFixed(1)),
    });
  }

  return result;
}

/**
 * Stateful incremental parser for OpenFOAM solver residual stdout lines.
 * Tracks Time = <iter> blocks and extracts Ux, Uy, Uz, p, p_rgh, k, omega, h.
 */
function createResidualStreamParser() {
  let currentIter = 0;
  let activePoint = null;
  const points = [];

  const finalizePoint = (pt) => {
    if (!pt) return null;
    const hasAnyField =
      pt.Ux !== undefined ||
      pt.Uy !== undefined ||
      pt.Uz !== undefined ||
      pt.p !== undefined ||
      pt.k !== undefined ||
      pt.omega !== undefined;
    if (!hasAnyField) return null;
    return {
      iteration: pt.iteration,
      ...(pt.Ux !== undefined ? { Ux: pt.Ux, xMomentum: pt.Ux } : {}),
      ...(pt.Uy !== undefined ? { Uy: pt.Uy, yMomentum: pt.Uy } : {}),
      ...(pt.Uz !== undefined ? { Uz: pt.Uz } : {}),
      ...(pt.p !== undefined ? { p: pt.p, continuity: pt.p } : {}),
      ...(pt.k !== undefined ? { k: pt.k, kTurbulence: pt.k } : {}),
      ...(pt.omega !== undefined ? { omega: pt.omega, omegaDissipation: pt.omega } : {}),
      ...(pt.h !== undefined ? { h: pt.h } : {}),
    };
  };

  const pushLine = (rawLine) => {
    if (typeof rawLine !== 'string') return { completedPoint: null, updatedPoint: null };
    const line = rawLine.trim();
    if (!line) return { completedPoint: null, updatedPoint: null };

    if (line.startsWith('Time = ')) {
      const completedPoint = finalizePoint(activePoint);
      if (completedPoint) {
        points.push(completedPoint);
      }
      const parsedIter = parseInt(line.replace('Time = ', '').trim(), 10);
      currentIter = Number.isFinite(parsedIter) && parsedIter > 0 ? parsedIter : currentIter + 1;
      activePoint = { iteration: currentIter };
      return { completedPoint, updatedPoint: null };
    }

    const solveMatch = line.match(
      /Solving for (Ux|Uy|Uz|p_rgh|p|k|omega|h),\s*Initial residual = ([0-9.eE+-]+)/
    );
    if (solveMatch) {
      const rawField = solveMatch[1];
      const field = rawField === 'p_rgh' ? 'p' : rawField;
      const val = parseFloat(solveMatch[2]);
      if (!Number.isFinite(val) || val <= 0) {
        return { completedPoint: null, updatedPoint: null };
      }

      if (!activePoint) {
        currentIter = currentIter || 1;
        activePoint = { iteration: currentIter };
      }
      activePoint[field] = val;
      return { completedPoint: null, updatedPoint: finalizePoint(activePoint) };
    }

    return { completedPoint: null, updatedPoint: null };
  };

  const flush = () => {
    const completedPoint = finalizePoint(activePoint);
    if (completedPoint) {
      points.push(completedPoint);
      activePoint = null;
    }
    return [...points];
  };

  const getPoints = () => {
    const list = [...points];
    const current = finalizePoint(activePoint);
    if (current) list.push(current);
    return list;
  };

  return { pushLine, flush, getPoints };
}

function parseResidualsDetailed(stdoutLog = '') {
  if (!stdoutLog || typeof stdoutLog !== 'string') return [];
  const parser = createResidualStreamParser();
  const lines = stdoutLog.split('\n');
  for (const line of lines) {
    parser.pushLine(line);
  }
  return parser.flush();
}

/**
 * Parses OpenFOAM checkMesh stdout into a structured Mesh Health summary.
 */
function parseCheckMeshHealth(rawStdout = '') {
  const text = typeof rawStdout === 'string' ? rawStdout : String(rawStdout || '');
  const cellMatch = text.match(/cells:\s+([0-9]+)/i);
  const totalCells = cellMatch ? parseInt(cellMatch[1], 10) : 0;

  const nonOrthoMatch = text.match(
    /Mesh non-orthogonality\s+Max:\s*([0-9.eE+-]+)|Max non-orthogonality\s*=\s*([0-9.eE+-]+)/i
  );
  const rawNonOrtho = nonOrthoMatch ? parseFloat(nonOrthoMatch[1] || nonOrthoMatch[2]) : null;
  const maxNonOrthogonality = rawNonOrtho !== null && Number.isFinite(rawNonOrtho) ? Number(rawNonOrtho.toFixed(2)) : null;

  const skewMatch = text.match(/Max skewness\s*=\s*([0-9.eE+-]+)/i);
  const rawSkew = skewMatch ? parseFloat(skewMatch[1]) : null;
  const maxSkewness = rawSkew !== null && Number.isFinite(rawSkew) ? Number(rawSkew.toFixed(2)) : null;

  const failedChecksMatch = text.match(/Failed\s+([1-9]\d*)\s+mesh checks/i);
  let status = 'PASS';
  if (totalCells <= 0 || failedChecksMatch) {
    status = 'FAIL';
  } else if (
    (maxNonOrthogonality !== null && maxNonOrthogonality > 65) ||
    (maxSkewness !== null && maxSkewness > 4) ||
    /WARNING/i.test(text)
  ) {
    status = 'WARNING';
  }

  const summaryParts = [`${totalCells.toLocaleString()} cells`];
  if (maxNonOrthogonality !== null) summaryParts.push(`Max non-ortho ${maxNonOrthogonality}°`);
  if (maxSkewness !== null) summaryParts.push(`Max skewness ${maxSkewness}`);

  return {
    status,
    totalCells,
    maxNonOrthogonality,
    maxSkewness,
    summary: summaryParts.join(' · '),
  };
}

export {
  DEFAULT_CASE_MAX_AGE_MS,
  sanitizeLogExcerpt,
  extractFoamFatalDetail,
  translateOpenFoamError,
  inspectCaseLogsForErrors,
  cleanupExpiredCases,
  createResidualStreamParser,
  parseResidualsDetailed,
  parseCheckMeshHealth,
};

export default {
  DEFAULT_CASE_MAX_AGE_MS,
  sanitizeLogExcerpt,
  extractFoamFatalDetail,
  translateOpenFoamError,
  inspectCaseLogsForErrors,
  cleanupExpiredCases,
  createResidualStreamParser,
  parseResidualsDetailed,
  parseCheckMeshHealth,
};
