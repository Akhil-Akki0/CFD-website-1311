import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { simulationConfigSchema } from '../backend/validation.js';
import {
  BASE_CASE_DIR,
  assertSafeCaseDir,
  sanitizeSimulationConfig,
  writeCaseDictionaries,
  getQueueConfig,
  getQueueSummary,
  abortSimulationJob,
  activeJobs,
  jobQueue,
} from '../backend/openfoamRunner.js';
import {
  translateOpenFoamError,
  cleanupExpiredCases,
  parseCheckMeshHealth,
  DEFAULT_CASE_MAX_AGE_MS,
} from '../backend/openfoamDiagnostics.js';

const createdTestDirs = [];

after(() => {
  for (const dir of createdTestDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
});

describe('Phase 1 Validation & MPI Decomposition Dictionaries', () => {
  it('validates parallelMode boolean in simulationConfigSchema and defaults to false', () => {
    const defaultCfg = simulationConfigSchema.safeParse({ inletVelocity: 25 });
    assert.equal(defaultCfg.success, true);
    assert.equal(defaultCfg.data.parallelMode, false);

    const mpiCfg = simulationConfigSchema.safeParse({
      inletVelocity: 35,
      parallelMode: true,
    });
    assert.equal(mpiCfg.success, true);
    assert.equal(mpiCfg.data.parallelMode, true);

    const badParallel = simulationConfigSchema.safeParse({
      inletVelocity: 25,
      parallelMode: 'mpirun -np 4; rm -rf /',
    });
    assert.equal(badParallel.success, false);
  });

  it('writes system/decomposeParDict (scotch, 4 subdomains) when parallelMode is true', () => {
    const uuid = crypto.randomUUID();
    const caseDir = path.join(BASE_CASE_DIR, uuid);
    assertSafeCaseDir(caseDir, uuid);
    createdTestDirs.push(caseDir);

    writeCaseDictionaries(caseDir, {
      inletVelocity: 28,
      simulationMode: 'conjugate_heat_transfer',
      parallelMode: true,
      material: {
        presetId: 'aluminum_6061_t6',
        name: 'Aluminum 6061-T6',
        density: 2700,
        specificHeat: 896,
        thermalConductivity: 167,
        surfaceRoughness: 0.000015,
      },
    });

    const rootDecompose = fs.readFileSync(path.join(caseDir, 'system', 'decomposeParDict'), 'utf8');
    const fluidDecompose = fs.readFileSync(path.join(caseDir, 'system', 'fluid', 'decomposeParDict'), 'utf8');
    const solidDecompose = fs.readFileSync(path.join(caseDir, 'system', 'solid', 'decomposeParDict'), 'utf8');

    for (const content of [rootDecompose, fluidDecompose, solidDecompose]) {
      assert.match(content, /numberOfSubdomains\s+4;/);
      assert.match(content, /method\s+scotch;/);
    }
  });

  it('omits system/decomposeParDict when parallelMode is false', () => {
    const uuid = crypto.randomUUID();
    const caseDir = path.join(BASE_CASE_DIR, uuid);
    assertSafeCaseDir(caseDir, uuid);
    createdTestDirs.push(caseDir);

    const sanitized = sanitizeSimulationConfig({ inletVelocity: 15, parallelMode: false });
    assert.equal(sanitized.parallelMode, false);

    writeCaseDictionaries(caseDir, sanitized);
    assert.equal(fs.existsSync(path.join(caseDir, 'system', 'decomposeParDict')), false);

    const featureDict = fs.readFileSync(path.join(caseDir, 'system', 'surfaceFeatureExtractDict'), 'utf8');
    assert.match(featureDict, /model\.stl/);
    assert.match(featureDict, /includedAngle\s+150;/);
  });

  it('parses checkMesh stdout into PASS, WARNING, and FAIL health summaries', () => {
    const passLog = `
Mesh stats
    cells:            184500
Checking geometry...
    Mesh non-orthogonality Max: 48.2 average: 8.1
    Max skewness = 1.42 OK.
Mesh OK.
`;
    const pass = parseCheckMeshHealth(passLog);
    assert.equal(pass.status, 'PASS');
    assert.equal(pass.totalCells, 184500);
    assert.equal(pass.maxNonOrthogonality, 48.2);
    assert.equal(pass.maxSkewness, 1.42);

    const warnLog = `
    cells:            52000
    Mesh non-orthogonality Max: 68.5 average: 12.4
    Max skewness = 3.1 OK.
Mesh OK.
`;
    const warn = parseCheckMeshHealth(warnLog);
    assert.equal(warn.status, 'WARNING');

    const failLog = `
    cells:            24000
    Mesh non-orthogonality Max: 84.1 average: 19.0
    ***High skewness*** Max skewness = 6.2
    Failed 2 mesh checks.
`;
    const fail = parseCheckMeshHealth(failLog);
    assert.equal(fail.status, 'FAIL');
  });
});

describe('Phase 1 Queue Concurrency, Abort Control & Process Cleanup', () => {
  it('enforces bounded worker concurrency between 1 and 2', () => {
    const cfg = getQueueConfig();
    assert.ok(cfg.maxGlobalConcurrent >= 1 && cfg.maxGlobalConcurrent <= 2);
    const summary = getQueueSummary();
    assert.equal(summary.maxConcurrent, cfg.maxGlobalConcurrent);
    assert.equal(typeof summary.queuedCount, 'number');
  });

  it('cancels a queued job cleanly, removes case folder, and blocks IDOR abort attempts', () => {
    const uuid = crypto.randomUUID();
    const caseDir = path.join(BASE_CASE_DIR, uuid);
    assertSafeCaseDir(caseDir, uuid);
    fs.mkdirSync(caseDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(caseDir, 'dummy.txt'), 'temp case file', 'utf8');
    createdTestDirs.push(caseDir);

    const fakeQueuedJob = {
      caseId: uuid,
      caseDir,
      owner: 'owner-user-1',
      config: sanitizeSimulationConfig({ inletVelocity: 20 }),
      status: 'queued',
      aborted: false,
      activeChild: null,
      progress: 0,
      logs: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      result: null,
    };

    activeJobs.set(uuid, fakeQueuedJob);
    jobQueue.push(fakeQueuedJob);

    assert.throws(
      () => abortSimulationJob(uuid, 'attacker-user-2', 'user'),
      (err) => err.code === 'IDOR_BLOCKED'
    );

    const abortResult = abortSimulationJob(uuid, 'owner-user-1', 'user');
    assert.equal(abortResult.aborted, true);
    assert.equal(abortResult.status, 'cancelled');
    assert.equal(fakeQueuedJob.status, 'cancelled');
    assert.equal(jobQueue.some((j) => j.caseId === uuid), false);
    assert.equal(fs.existsSync(caseDir), false);

    activeJobs.delete(uuid);
  });
});

describe('Phase 1 OpenFOAM Log Error Translation & 24h Disk Cleanup', () => {
  it('translates Floating Point Exception, Courant Number overflow, FOAM FATAL ERROR, and missing binary errors', () => {
    const fpe = translateOpenFoamError(
      'time step continuity errors\n[0] #0 Foam::error::printStack Floating point exception (SIGFPE)',
      'simpleFoam',
      136
    );
    assert.equal(fpe.code, 'FLOATING_POINT_EXCEPTION');
    assert.match(fpe.message, /Floating Point Exception/i);

    const courant = translateOpenFoamError(
      'Courant Number mean: 4.52 max: 184.2\nFOAM FATAL ERROR: Maximum Courant number exceeded',
      'simpleFoam',
      1
    );
    assert.equal(courant.code, 'COURANT_LIMIT_EXCEEDED');
    assert.match(courant.title, /Courant Number/i);

    const fatal = translateOpenFoamError(
      '--> FOAM FATAL IO ERROR:\nCannot find patchField entry for cylinder in file /tmp/of_cases/12345678-1234-1234-1234-1234567890ab/0/U',
      'simpleFoam',
      1
    );
    assert.equal(fatal.code, 'FOAM_FATAL_ERROR');
    assert.equal(fatal.message.includes('/tmp/of_cases/12345678'), false);
    assert.match(fatal.message, /Cannot find patchField entry/i);

    const missing = translateOpenFoamError('bash: simpleFoam: not found', 'simpleFoam', 127);
    assert.equal(missing.code, 'OPENFOAM_UNAVAILABLE');
  });

  it('deletes only UUID directories older than 24 hours while protecting fresh and active cases', () => {
    const tempBase = fs.mkdtempSync('/tmp/rimz-cleanup-test-');
    createdTestDirs.push(tempBase);

    const expiredUuid = crypto.randomUUID();
    const freshUuid = crypto.randomUUID();
    const activeUuid = crypto.randomUUID();
    const nonUuidDir = 'keep-non-uuid-folder';

    for (const name of [expiredUuid, freshUuid, activeUuid, nonUuidDir]) {
      fs.mkdirSync(path.join(tempBase, name), { recursive: true });
    }

    const nowMs = Date.now();
    const oldTimeSec = (nowMs - DEFAULT_CASE_MAX_AGE_MS - 60_000) / 1000;
    fs.utimesSync(path.join(tempBase, expiredUuid), oldTimeSec, oldTimeSec);
    fs.utimesSync(path.join(tempBase, activeUuid), oldTimeSec, oldTimeSec);

    const summary = cleanupExpiredCases({
      baseDir: tempBase,
      maxAgeMs: DEFAULT_CASE_MAX_AGE_MS,
      nowMs,
      protectedCaseIds: new Set([activeUuid]),
    });

    assert.deepEqual(summary.deleted, [expiredUuid]);
    assert.equal(fs.existsSync(path.join(tempBase, expiredUuid)), false);
    assert.equal(fs.existsSync(path.join(tempBase, freshUuid)), true);
    assert.equal(fs.existsSync(path.join(tempBase, activeUuid)), true);
    assert.equal(fs.existsSync(path.join(tempBase, nonUuidDir)), true);
  });
});
