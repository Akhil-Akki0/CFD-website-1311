import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  solidMaterialSchema,
  simulationConfigSchema,
  simulationRequestSchema,
  validateStlBuffer,
} from '../backend/validation.js';
import {
  BASE_CASE_DIR,
  assertSafeCaseDir,
  sanitizeSimulationConfig,
  writeCaseDictionaries,
  parseVtkMetrics,
  parseWallHeatFluxDat,
  parseForceCoeffs,
} from '../backend/openfoamRunner.js';

const createdTestDirs = [];

after(() => {
  for (const dir of createdTestDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
});

describe('Solid Material Zod Validation & OWASP Sanitization', () => {
  it('accepts all valid preset and custom metal material configurations', () => {
    const valid = simulationConfigSchema.safeParse({
      inletVelocity: 30,
      viscosity: 1.5e-5,
      maxIterations: 500,
      domain: 'compact',
      simulationMode: 'conjugate_heat_transfer',
      solidWallTemperature: 425,
      material: {
        presetId: 'pure_copper',
        name: 'Pure Copper',
        density: 8960,
        specificHeat: 385,
        thermalConductivity: 401,
        surfaceRoughness: 0.0000015,
      },
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.material.name, 'Pure Copper');
    assert.equal(valid.data.simulationMode, 'conjugate_heat_transfer');
    assert.equal(valid.data.solidWallTemperature, 425);
  });

  it('rejects negative, zero, non-finite, or out-of-bounds physical values', () => {
    const badDensity = solidMaterialSchema.safeParse({
      presetId: 'custom',
      name: 'Invalid Metal',
      density: -500,
      specificHeat: 500,
      thermalConductivity: 50,
      surfaceRoughness: 0.00001,
    });
    assert.equal(badDensity.success, false);

    const tooDense = solidMaterialSchema.safeParse({
      presetId: 'custom',
      name: 'Neutron Star',
      density: 50000,
      specificHeat: 500,
      thermalConductivity: 50,
      surfaceRoughness: 0.00001,
    });
    assert.equal(tooDense.success, false);

    const nonFinite = solidMaterialSchema.safeParse({
      presetId: 'custom',
      name: 'NaN Alloy',
      density: Infinity,
      specificHeat: 500,
      thermalConductivity: 50,
      surfaceRoughness: 0.00001,
    });
    assert.equal(nonFinite.success, false);
  });

  it('rejects shell/dictionary injection characters in material name and unexpected strict fields', () => {
    const injectedName = solidMaterialSchema.safeParse({
      presetId: 'custom',
      name: 'Steel; rm -rf /',
      density: 8000,
      specificHeat: 500,
      thermalConductivity: 16.2,
      surfaceRoughness: 0.000015,
    });
    assert.equal(injectedName.success, false);

    const extraField = simulationRequestSchema.safeParse({
      geometry: {
        name: 'cylinder',
        filename: 'cylinder.stl',
        stlBase64: 'c29saWQgY3ls',
      },
      config: {
        inletVelocity: 10,
        unexpectedInjectionKey: 'oops',
      },
    });
    assert.equal(extraField.success, false);
  });
});

describe('OpenFOAM Case Generator (/tmp/of_cases/<uuid>/)', () => {
  it('writes 0/nut with nutkRoughWallFunction, Ks, and Cs uniform 0.5 in Aerodynamic Roughness Mode', () => {
    const uuid = crypto.randomUUID();
    const caseDir = path.join(BASE_CASE_DIR, uuid);
    assertSafeCaseDir(caseDir, uuid);
    createdTestDirs.push(caseDir);

    writeCaseDictionaries(caseDir, {
      inletVelocity: 25,
      viscosity: 1.5e-5,
      maxIterations: 400,
      simulationMode: 'aerodynamic_roughness',
      material: {
        presetId: 'cast_iron',
        name: 'Cast Iron',
        density: 7200,
        specificHeat: 460,
        thermalConductivity: 55,
        surfaceRoughness: 0.00026,
      },
    });

    const nutContent = fs.readFileSync(path.join(caseDir, '0', 'nut'), 'utf8');
    const controlDict = fs.readFileSync(path.join(caseDir, 'system', 'controlDict'), 'utf8');
    const turbProps = fs.readFileSync(path.join(caseDir, 'constant', 'turbulenceProperties'), 'utf8');

    assert.match(nutContent, /type\s+nutkRoughWallFunction;/);
    assert.match(nutContent, /Ks\s+uniform\s+2\.600000e-4;/);
    assert.match(nutContent, /Cs\s+uniform\s+0\.5;/);
    assert.match(controlDict, /application\s+simpleFoam;/);
    assert.match(turbProps, /simulationType\s+RAS;/);
    assert.equal(fs.existsSync(path.join(caseDir, 'constant', 'solid', 'thermophysicalProperties')), false);
  });

  it('writes constant/solid/thermophysicalProperties (heSolidThermo) and 0/solid/T in Conjugate Heat Transfer Mode', () => {
    const uuid = crypto.randomUUID();
    const caseDir = path.join(BASE_CASE_DIR, uuid);
    assertSafeCaseDir(caseDir, uuid);
    createdTestDirs.push(caseDir);

    writeCaseDictionaries(caseDir, {
      inletVelocity: 18,
      viscosity: 1.5e-5,
      maxIterations: 600,
      simulationMode: 'conjugate_heat_transfer',
      solidWallTemperature: 475,
      material: {
        presetId: 'titanium_ti6al4v',
        name: 'Titanium Ti-6Al-4V',
        density: 4430,
        specificHeat: 526,
        thermalConductivity: 6.7,
        surfaceRoughness: 0.000008,
      },
    });

    const solidThermo = fs.readFileSync(path.join(caseDir, 'constant', 'solid', 'thermophysicalProperties'), 'utf8');
    const regionProps = fs.readFileSync(path.join(caseDir, 'constant', 'regionProperties'), 'utf8');
    const solidT = fs.readFileSync(path.join(caseDir, '0', 'solid', 'T'), 'utf8');
    const controlDict = fs.readFileSync(path.join(caseDir, 'system', 'controlDict'), 'utf8');

    assert.match(solidThermo, /type\s+heSolidThermo;/);
    assert.match(solidThermo, /mixture\s+pureMixture;/);
    assert.match(solidThermo, /transport\s+constIso;/);
    assert.match(solidThermo, /thermo\s+hConst;/);
    assert.match(solidThermo, /equationOfState\s+rhoConst;/);
    assert.match(solidThermo, /kappa\s+6\.7000;/);
    assert.match(solidThermo, /Cp\s+526\.00;/);
    assert.match(solidThermo, /rho\s+4430\.00;/);
    assert.match(regionProps, /fluid\s+\(fluid\)/);
    assert.match(regionProps, /solid\s+\(solid\)/);
    assert.match(solidT, /uniform 475\.00;/);
    assert.match(controlDict, /application\s+chtMultiRegionSimpleFoam;/);
  });

  it('sanitizes malformed or out-of-range inputs cleanly in sanitizeSimulationConfig', () => {
    const sanitized = sanitizeSimulationConfig({
      inletVelocity: 9999,
      solidWallTemperature: -50,
      material: {
        presetId: 'unknown_id',
        name: 'Bad;Name\n{}',
        density: -10,
        specificHeat: 999999,
        thermalConductivity: NaN,
        surfaceRoughness: 2,
      },
    });

    assert.equal(sanitized.inletVelocity, 100);
    assert.equal(sanitized.solidWallTemperature, 150);
    assert.equal(sanitized.material.name, 'BadName');
    assert.equal(sanitized.material.density, 100);
    assert.equal(sanitized.material.specificHeat, 10000);
    assert.equal(sanitized.material.thermalConductivity, 167);
    assert.equal(sanitized.material.surfaceRoughness, 0.05);
  });

  it('writes rotatingWallVelocity when wheelRpm > 0, fluid density/temp, and meshResolution blockMesh grid', () => {
    const uuid = crypto.randomUUID();
    const caseDir = path.join(BASE_CASE_DIR, uuid);
    assertSafeCaseDir(caseDir, uuid);
    createdTestDirs.push(caseDir);

    writeCaseDictionaries(caseDir, {
      inletVelocity: 83.33,
      viscosity: 1.004e-6,
      fluidType: 'water_20c',
      fluidDensity: 998.2,
      fluidTemperature: 293.15,
      meshResolution: 'fine',
      wheelRpm: 2400,
      simulationMode: 'conjugate_heat_transfer',
      solidWallTemperature: 400,
      material: {
        presetId: 'forged_magnesium',
        name: 'Forged Magnesium',
        density: 1800,
        specificHeat: 1020,
        thermalConductivity: 156,
        surfaceRoughness: 0.000012,
      },
    });

    const uContent = fs.readFileSync(path.join(caseDir, '0', 'U'), 'utf8');
    const blockMesh = fs.readFileSync(path.join(caseDir, 'system', 'blockMeshDict'), 'utf8');
    const snappy = fs.readFileSync(path.join(caseDir, 'system', 'snappyHexMeshDict'), 'utf8');
    const controlDict = fs.readFileSync(path.join(caseDir, 'system', 'controlDict'), 'utf8');
    const transportProps = fs.readFileSync(path.join(caseDir, 'constant', 'transportProperties'), 'utf8');
    const fluidThermo = fs.readFileSync(path.join(caseDir, 'constant', 'fluid', 'thermophysicalProperties'), 'utf8');

    assert.match(uContent, /type\s+rotatingWallVelocity;/);
    assert.match(uContent, /omega\s+251\.3274;/);
    assert.match(blockMesh, /\(90 60 60\)/);
    assert.match(snappy, /level\s+\(3 4\);/);
    assert.match(controlDict, /rhoInf\s+998\.2;/);
    assert.match(transportProps, /rho\s+\[1 -3 0 0 0 0 0\]\s+998\.2;/);
    assert.match(fluidThermo, /thermo\s+hConst;/);
  });

  it('validates ASCII and Binary STL buffers strictly', () => {
    const asciiStl = Buffer.from(
      'solid test_rim\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test_rim\n',
      'utf8'
    );
    const asciiRes = validateStlBuffer(asciiStl);
    assert.equal(asciiRes.valid, true);
    assert.equal(asciiRes.format, 'ascii');
    assert.equal(asciiRes.triangleCount, 1);

    const binBuf = Buffer.alloc(84 + 50);
    binBuf.write('BINARY STL HEADER', 0, 'ascii');
    binBuf.writeUInt32LE(1, 80);
    const binRes = validateStlBuffer(binBuf);
    assert.equal(binRes.valid, true);
    assert.equal(binRes.format, 'binary');
    assert.equal(binRes.triangleCount, 1);

    const badBuf = Buffer.from('not an stl file', 'utf8');
    const badRes = validateStlBuffer(badBuf);
    assert.equal(badRes.valid, false);
  });
});

describe('VTK & Thermal Telemetry Parser', () => {
  it('parses velocity, pressure, solid temperature (K), and wallHeatFlux (W/m2) from ASCII VTK', () => {
    const sampleVtk = `# vtk DataFile Version 2.0
OpenFOAM Multi-Region Export
ASCII
DATASET UNSTRUCTURED_GRID
POINTS 3 float
0 0 0
1 0 0
0 1 0
CELLS 1 4
3 0 1 2
POINT_DATA 3
VECTORS U float
12.0 0.0 0.0
18.0 6.0 0.0
5.0 0.0 0.0
SCALARS p float 1
LOOKUP_TABLE default
100.5
245.2
-30.0
SCALARS T float 1
LOOKUP_TABLE default
295.4
412.8
340.1
SCALARS wallHeatFlux float 1
LOOKUP_TABLE default
1240.5
1890.0
1420.5
`;

    const parsed = parseVtkMetrics(sampleVtk);
    assert.equal(parsed.pointsCount, 3);
    assert.equal(parsed.cellsCount, 1);
    assert.equal(parsed.maxVelocity, Number(Math.sqrt(18 ** 2 + 6 ** 2).toFixed(4)));
    assert.equal(parsed.maxPressure, 245.2);
    assert.equal(parsed.minPressure, -30);
    assert.equal(parsed.maxTemperature, 412.8);
    assert.equal(parsed.maxWallHeatFlux, 1890);
    assert.equal(parsed.avgWallHeatFlux, Number(((1240.5 + 1890 + 1420.5) / 3).toFixed(2)));
  });

  it('parses wallHeatFlux.dat and forceCoeffs cleanly', () => {
    const fluxDat = `# Wall heat flux
# Time min max integral
500 -4210.5 3850.25 1420.75
`;
    assert.equal(parseWallHeatFluxDat(fluxDat), 1420.75);

    const forceDat = `# Time Cd Cl
500 0.4125 0.1284 0.01
`;
    const forces = parseForceCoeffs(forceDat);
    assert.deepEqual(forces, { cD: 0.4125, cL: 0.1284 });
  });
});
