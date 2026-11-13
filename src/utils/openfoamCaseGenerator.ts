import JSZip from 'jszip';
import { GeometryRecord, SimulationConfig } from '../types';

export interface OpenFoamFileEntry {
  path: string;
  content: string;
}

/**
 * Generates an OpenFOAM v11 / v2312 compliant case directory tree
 */
export function generateOpenFoamCaseFiles(
  geometry: GeometryRecord,
  simConfig: SimulationConfig,
  projectName: string = 'CFD_Simulation'
): OpenFoamFileEntry[] {
  const geomFilename = geometry.filename || 'geometry.stl';
  const cleanGeomName = geomFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
  const vel = simConfig.inletVelocity || 25.0;
  const angleDeg = simConfig.inletAngle || 0.0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const ux = (vel * Math.cos(angleRad)).toFixed(4);
  const uy = (vel * Math.sin(angleRad)).toFixed(4);
  const uz = '0.0000';

  const kinematicViscosity = (simConfig.fluid.viscosity / (simConfig.fluid.density || 1.225)).toExponential(4);
  const turbulenceIntensity = 0.05; // 5%
  const chord = geometry.maxSize || 1.0;
  const kVal = (1.5 * Math.pow(vel * turbulenceIntensity, 2)).toFixed(4);
  const omegaVal = (Math.sqrt(Number(kVal)) / (0.09 * chord * 0.07)).toFixed(2);
  const maxIter = simConfig.solverSettings.maxIterations || 1000;
  const mat = simConfig.material;
  const ksVal = (mat?.surfaceRoughness ?? 0.000015).toExponential(6);
  const isThermalMode = simConfig.simulationMode === 'conjugate_heat_transfer';
  const solidWallTemp = (simConfig.solidWallTemperature ?? 350).toFixed(2);

  // 1. 0/U
  const fileU = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       volVectorField;
    location    "0";
    object      U;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

dimensions      [0 1 -1 0 0 0 0];

internalField   uniform (${ux} ${uy} ${uz});

boundaryField
{
    inlet
    {
        type            fixedValue;
        value           uniform (${ux} ${uy} ${uz});
    }

    outlet
    {
        type            inletOutlet;
        inletValue      uniform (0 0 0);
        value           uniform (${ux} ${uy} ${uz});
    }

    walls
    {
        type            slip;
    }

    obstacle
    {
        type            noSlip;
    }

    frontAndBack
    {
        type            empty;
    }
}

// ************************************************************************* //
`;

  // 2. 0/p
  const fileP = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0";
    object      p;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

dimensions      [0 2 -2 0 0 0 0];

internalField   uniform 0;

boundaryField
{
    inlet
    {
        type            zeroGradient;
    }

    outlet
    {
        type            fixedValue;
        value           uniform 0;
    }

    walls
    {
        type            zeroGradient;
    }

    obstacle
    {
        type            zeroGradient;
    }

    frontAndBack
    {
        type            empty;
    }
}

// ************************************************************************* //
`;

  // 3. 0/k
  const fileK = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0";
    object      k;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

dimensions      [0 2 -2 0 0 0 0];

internalField   uniform ${kVal};

boundaryField
{
    inlet
    {
        type            fixedValue;
        value           uniform ${kVal};
    }

    outlet
    {
        type            inletOutlet;
        inletValue      uniform ${kVal};
        value           uniform ${kVal};
    }

    walls
    {
        type            zeroGradient;
    }

    obstacle
    {
        type            kqRWallFunction;
        value           uniform ${kVal};
    }

    frontAndBack
    {
        type            empty;
    }
}

// ************************************************************************* //
`;

  // 4. 0/omega
  const fileOmega = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0";
    object      omega;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

dimensions      [0 0 -1 0 0 0 0];

internalField   uniform ${omegaVal};

boundaryField
{
    inlet
    {
        type            fixedValue;
        value           uniform ${omegaVal};
    }

    outlet
    {
        type            inletOutlet;
        inletValue      uniform ${omegaVal};
        value           uniform ${omegaVal};
    }

    walls
    {
        type            zeroGradient;
    }

    obstacle
    {
        type            omegaWallFunction;
        value           uniform ${omegaVal};
    }

    frontAndBack
    {
        type            empty;
    }
}

// ************************************************************************* //
`;

  // 5. 0/nut
  const fileNut = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0";
    object      nut;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

dimensions      [0 2 -1 0 0 0 0];

internalField   uniform 0;

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

    obstacle
    {
        type            nutkRoughWallFunction;
        Ks              uniform ${ksVal};
        Cs              uniform 0.5;
        value           uniform 0;
    }

    frontAndBack
    {
        type            empty;
    }
}

// ************************************************************************* //
`;

  // 6. constant/transportProperties
  const fileTransport = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "constant";
    object      transportProperties;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

transportModel  Newtonian;

nu              [0 2 -1 0 0 0 0] ${kinematicViscosity};

// ************************************************************************* //
`;

  // 7. constant/turbulenceProperties
  const fileTurbulence = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "constant";
    object      turbulenceProperties;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

simulationType  RAS;

RAS
{
    RASModel        kOmegaSST;
    turbulence      on;
    printCoeffs     on;
}

// ************************************************************************* //
`;

  // 8. system/controlDict
  const fileControl = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      controlDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

application     ${isThermalMode ? 'chtMultiRegionSimpleFoam' : 'simpleFoam'};

startFrom       startTime;

startTime       0;

stopAt          endTime;

endTime         ${maxIter};

deltaT          1;

writeControl    timeStep;

writeInterval   50;

purgeWrite      5;

writeFormat     ascii;

writePrecision  7;

writeCompression off;

timeFormat      general;

timePrecision   6;

runTimeModifiable true;

functions
{
    forces
    {
        type            forces;
        libs            ("libforces.so");
        writeControl    timeStep;
        writeInterval   1;
        patches         (obstacle);
        pName           p;
        UName           U;
        rho             rhoInf;
        rhoInf          ${simConfig.fluid.density || 1.225};
        CofG            (0 0 0);
    }

    forceCoeffs
    {
        type            forceCoeffs;
        libs            ("libforces.so");
        writeControl    timeStep;
        writeInterval   1;
        patches         (obstacle);
        pName           p;
        UName           U;
        rho             rhoInf;
        rhoInf          ${simConfig.fluid.density || 1.225};
        CofG            (0 0 0);
        liftDir         (${-Math.sin(angleRad).toFixed(4)} ${Math.cos(angleRad).toFixed(4)} 0);
        dragDir         (${Math.cos(angleRad).toFixed(4)} ${Math.sin(angleRad).toFixed(4)} 0);
        pitchAxis       (0 0 1);
        magUInf         ${vel};
        lRef            ${chord.toFixed(3)};
        Aref            ${chord.toFixed(3)};
    }

    probes
    {
        type            probes;
        libs            ("libsampling.so");
        writeControl    timeStep;
        writeInterval   5;
        fields          (p U);
        probeLocations
        (
            (0.10 0.05 0)
            (0.25 0.08 0)
            (0.50 0.10 0)
            (0.75 0.06 0)
            (1.05 0.02 0)
        );
    }
}

// ************************************************************************* //
`;

  // 9. system/blockMeshDict
  const b = geometry.meshData?.bounds || {
    minX: -0.5,
    maxX: 0.5,
    minY: -0.2,
    maxY: 0.2,
    minZ: -0.1,
    maxZ: 0.1,
  };
  const domMinX = (b.minX - 5.0 * chord).toFixed(2);
  const domMaxX = (b.maxX + 10.0 * chord).toFixed(2);
  const domMinY = (b.minY - 4.0 * chord).toFixed(2);
  const domMaxY = (b.maxY + 4.0 * chord).toFixed(2);
  const domMinZ = '-0.05';
  const domMaxZ = '0.05';

  const fileBlockMesh = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      blockMeshDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

scale   1;

vertices
(
    (${domMinX} ${domMinY} ${domMinZ}) // 0
    (${domMaxX} ${domMinY} ${domMinZ}) // 1
    (${domMaxX} ${domMaxY} ${domMinZ}) // 2
    (${domMinX} ${domMaxY} ${domMinZ}) // 3
    (${domMinX} ${domMinY} ${domMaxZ}) // 4
    (${domMaxX} ${domMinY} ${domMaxZ}) // 5
    (${domMaxX} ${domMaxY} ${domMaxZ}) // 6
    (${domMinX} ${domMaxY} ${domMaxZ}) // 7
);

blocks
(
    hex (0 1 2 3 4 5 6 7) (120 60 1) simpleGrading (1 1 1)
);

edges
(
);

boundary
(
    inlet
    {
        type patch;
        faces
        (
            (0 4 7 3)
        );
    }
    outlet
    {
        type patch;
        faces
        (
            (1 2 6 5)
        );
    }
    walls
    {
        type patch;
        faces
        (
            (0 1 5 4)
            (3 7 6 2)
        );
    }
    frontAndBack
    {
        type empty;
        faces
        (
            (0 3 2 1)
            (4 5 6 7)
        );
    }
);

mergePatchPairs
(
);

// ************************************************************************* //
`;

  // 10. system/snappyHexMeshDict
  const fileSnappy = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      snappyHexMeshDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

castellatedMesh true;
snap            true;
addLayers       true;

geometry
{
    ${cleanGeomName}.stl
    {
        type triSurfaceMesh;
        name obstacle;
    }
};

castellatedMeshControls
{
    maxLocalCells 1000000;
    maxGlobalCells 2000000;
    minRefinementCells 10;
    nCellsBetweenLevels 3;

    features
    (
    );

    refinementSurfaces
    {
        obstacle
        {
            level (3 4);
        }
    }

    resolveFeatureAngle 30;

    refinementRegions
    {
    }

    locationInMesh (${(b.minX - 1.0).toFixed(2)} ${(b.minY - 1.0).toFixed(2)} 0.0);
    allowFreeStandingZoneFaces true;
}

snapControls
{
    nSmoothPatch 3;
    tolerance 2.0;
    nSolveIter 30;
    nRelaxIter 5;
    nFeatureSnapIter 10;
}

addLayersControls
{
    relativeSizes true;
    layers
    {
        "obstacle.*"
        {
            nSurfaceLayers 4;
        }
    }
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

// ************************************************************************* //
`;

  // 11. system/fvSchemes
  const fileFvSchemes = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      fvSchemes;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

ddtSchemes
{
    default         steadyState;
}

gradSchemes
{
    default         Gauss linear;
    grad(p)         Gauss linear;
    grad(U)         cellLimited Gauss linear 1;
}

divSchemes
{
    default         none;
    div(phi,U)      bounded Gauss linearUpwind grad(U);
    div(phi,k)      bounded Gauss upwind;
    div(phi,omega)  bounded Gauss upwind;
    div((nuEff*dev2(T(grad(U))))) Gauss linear;
}

laplacianSchemes
{
    default         Gauss linear corrected;
}

interpolationSchemes
{
    default         linear;
}

snGradSchemes
{
    default         corrected;
}

wallDist
{
    method meshWave;
}

// ************************************************************************* //
`;

  // 12. system/fvSolution
  const fileFvSolution = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      fvSolution;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

solvers
{
    p
    {
        solver          GAMG;
        tolerance       1e-06;
        relTol          0.05;
        smoother        GaussSeidel;
    }

    "(U|k|omega)"
    {
        solver          smoothSolver;
        smoother        GaussSeidel;
        tolerance       1e-06;
        relTol          0.05;
    }
}

SIMPLE
{
    nNonOrthogonalCorrectors 1;
    consistent      yes;
    residualControl
    {
        p               1e-5;
        U               1e-5;
        "(k|omega)"     1e-5;
    }
}

relaxationFactors
{
    equations
    {
        U               0.7;
        k               0.7;
        omega           0.7;
    }
    fields
    {
        p               0.3;
    }
}

// ************************************************************************* //
`;

  // 13. constant/triSurface/geometry.stl
  let stlContent = `solid ${cleanGeomName}\n`;
  if (geometry.meshData && geometry.meshData.faces.length > 0) {
    const { vertices, faces } = geometry.meshData;
    for (const [i0, i1, i2] of faces) {
      const v0 = vertices[i0];
      const v1 = vertices[i1];
      const v2 = vertices[i2];
      if (!v0 || !v1 || !v2) continue;
      stlContent += `  facet normal 0 0 0\n    outer loop\n`;
      stlContent += `      vertex ${v0[0].toFixed(6)} ${v0[1].toFixed(6)} ${v0[2].toFixed(6)}\n`;
      stlContent += `      vertex ${v1[0].toFixed(6)} ${v1[1].toFixed(6)} ${v1[2].toFixed(6)}\n`;
      stlContent += `      vertex ${v2[0].toFixed(6)} ${v2[1].toFixed(6)} ${v2[2].toFixed(6)}\n`;
      stlContent += `    endloop\n  endfacet\n`;
    }
  } else {
    // Fallback minimal triangle
    stlContent += `  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 0.5 0.5 0\n    endloop\n  endfacet\n`;
  }
  stlContent += `endsolid ${cleanGeomName}\n`;

  // 14. Allrun bash script
  const fileAllrun = `#!/bin/sh
cd "\${0%/*}" || exit 1
. \${WM_PROJECT_DIR:?}/bin/tools/RunFunctions

echo "=== [1/5] Building Background Hex Mesh (blockMesh) ==="
runApplication blockMesh

echo "=== [2/5] Extracting Surface Topology Features (surfaceFeatures) ==="
if which surfaceFeatures > /dev/null 2>&1; then
    runApplication surfaceFeatures
fi

echo "=== [3/5] Boundary Snapping & Inflation Layers (snappyHexMesh) ==="
runApplication snappyHexMesh -overwrite

echo "=== [4/5] Verifying Mesh Topology Quality (checkMesh) ==="
runApplication checkMesh

echo "=== [5/5] Executing SIMPLE Navier-Stokes Solver (simpleFoam) ==="
runApplication simpleFoam

echo "CFD Execution Complete. Inspect logs via 'foamLog log.simpleFoam' or ParaView via 'touch case.foam && paraFoam'."
`;

  // 15. Allclean bash script
  const fileAllclean = `#!/bin/sh
cd "\${0%/*}" || exit 1
. \${WM_PROJECT_DIR:?}/bin/tools/RunFunctions

echo "Cleaning OpenFOAM case directory..."
cleanCase
rm -rf 0/polyMesh constant/polyMesh processor* log.* postProcessing
rm -f case.foam
echo "Case cleaned successfully."
`;

  // 16. README.md
  const fileReadme = `# ${projectName} - OpenFOAM CFD Case
Generated automatically by the AI CFD Studio & Aerodynamic Platform.

## Case Specifications
- **Geometry**: \`${geometry.name}\` (${geometry.format})
- **Solver**: \`simpleFoam\` (Steady-State Incompressible Navier-Stokes with SIMPLE pressure-velocity coupling)
- **Turbulence Model**: \`kOmegaSST\` (Menter Shear Stress Transport)
- **Inlet Velocity**: \`${vel} m/s\` at Angle of Attack \`${angleDeg}°\`
- **Working Fluid**: \`${simConfig.fluid.name || simConfig.fluid.type || 'Air'}\` (Density: \`${simConfig.fluid.density || 1.225} kg/m³\`, Kinematic Viscosity: \`${kinematicViscosity} m²/s\`)

## How to Run
### 1. Local OpenFOAM (v10, v11, or v2312)
\`\`\`bash
chmod +x Allrun Allclean
./Allrun
\`\`\`

### 2. Using Docker Container
\`\`\`bash
docker run --rm -v "\$PWD":/case -w /case openfoam/openfoam11-paraview ./Allrun
\`\`\`

### 3. HPC Cluster Execution (SLURM)
\`\`\`bash
sbatch submit_slurm.sh
\`\`\`

### 4. Post-Processing
Open the case in ParaView:
\`\`\`bash
paraFoam
# or on systems without paraFoam:
touch case.foam && paraview case.foam
\`\`\`
`;

  // 15. constant/polyMesh/boundary
  const filePolyMeshBoundary = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       polyBoundaryMesh;
    location    "constant/polyMesh";
    object      boundary;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

5
(
    inlet
    {
        type            patch;
        nFaces          0;
        startFace       0;
    }
    outlet
    {
        type            patch;
        nFaces          0;
        startFace       0;
    }
    walls
    {
        type            patch;
        nFaces          0;
        startFace       0;
    }
    obstacle
    {
        type            wall;
        inGroups        1(wall);
        nFaces          0;
        startFace       0;
    }
    frontAndBack
    {
        type            empty;
        inGroups        1(empty);
        nFaces          0;
        startFace       0;
    }
)

// ************************************************************************* //
`;

  // 16. system/meshQualityDict
  const fileMeshQuality = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      meshQualityDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

#includeEtc "caseDicts/mesh/generation/meshQualityDict"

// Strict Quality Criteria for Aerodynamic CFD
maxNonOrtho         70;
maxBoundarySkewness 20;
maxInternalSkewness 4;
maxConcave          80;
minVol              1e-15;
minTetQuality       1e-15;
minArea             -1;
minTwist            0.02;
minDeterminant      0.001;
minFaceWeight       0.02;
minVolRatio         0.01;
minTriangleTwist    -1;

// ************************************************************************* //
`;

  // 17. system/decomposeParDict
  const fileDecomposePar = `/*--------------------------------*- C++ -*----------------------------------*\\
| =========                 |                                                 |
| \\\\      /  F ield         | OpenFOAM: The Open Source CFD Toolbox           |
|  \\\\    /   O peration     | Version:  11 / v2312                            |
|   \\\\  /    A nd           | Web:      www.OpenFOAM.org                      |
|    \\\\/     M anipulation  | Case:     ${projectName}                        |
\\*---------------------------------------------------------------------------*/
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      decomposeParDict;
}
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * //

numberOfSubdomains 8;

method          scotch;

// ************************************************************************* //
`;

  // 18. submit_slurm.sh
  const fileSlurm = `#!/bin/bash
#SBATCH --job-name=${projectName}
#SBATCH --nodes=1
#SBATCH --ntasks=8
#SBATCH --time=04:00:00
#SBATCH --partition=compute
#SBATCH --output=slurm_%j.log

echo "Loading OpenFOAM environment..."
source /usr/lib/openfoam/openfoam2312/etc/bashrc

echo "Running blockMesh and snappyHexMesh..."
blockMesh > log.blockMesh 2>&1
surfaceFeatureExtract > log.surfaceFeatureExtract 2>&1
snappyHexMesh -overwrite > log.snappyHexMesh 2>&1
checkMesh > log.checkMesh 2>&1

echo "Decomposing domain for 8 cores..."
decomposePar -force > log.decomposePar 2>&1

echo "Running simpleFoam in parallel on $(nproc) cores..."
mpirun -np 8 simpleFoam -parallel > log.simpleFoam 2>&1

echo "Reconstructing parallel fields..."
reconstructPar -latestTime > log.reconstructPar 2>&1

echo "Simulation completed successfully at $(date)."
`;

  // 19. docker-compose.yml
  const fileDockerCompose = `version: '3.8'
services:
  openfoam:
    image: openfoam/openfoam11-paraview510
    container_name: openfoam_${cleanGeomName}
    volumes:
      - .:/case
    working_dir: /case
    command: bash -c "chmod +x Allrun && ./Allrun"
    environment:
      - WM_PROJECT_VERSION=11
`;

  const baseEntries: OpenFoamFileEntry[] = [
    { path: '0/U', content: fileU },
    { path: '0/p', content: fileP },
    { path: '0/k', content: fileK },
    { path: '0/omega', content: fileOmega },
    { path: '0/nut', content: fileNut },
    { path: 'constant/transportProperties', content: fileTransport },
    { path: 'constant/turbulenceProperties', content: fileTurbulence },
    { path: 'constant/polyMesh/boundary', content: filePolyMeshBoundary },
    { path: 'constant/triSurface/' + cleanGeomName + '.stl', content: stlContent },
    { path: 'system/controlDict', content: fileControl },
    { path: 'system/blockMeshDict', content: fileBlockMesh },
    { path: 'system/snappyHexMeshDict', content: fileSnappy },
    { path: 'system/meshQualityDict', content: fileMeshQuality },
    { path: 'system/decomposeParDict', content: fileDecomposePar },
    { path: 'system/fvSchemes', content: fileFvSchemes },
    { path: 'system/fvSolution', content: fileFvSolution },
    { path: 'Allrun', content: fileAllrun },
    { path: 'Allclean', content: fileAllclean },
    { path: 'submit_slurm.sh', content: fileSlurm },
    { path: 'docker-compose.yml', content: fileDockerCompose },
    { path: 'README.md', content: fileReadme },
  ];

  if (isThermalMode && mat) {
    baseEntries.push(
      {
        path: 'constant/regionProperties',
        content: `FoamFile
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
`,
      },
      {
        path: 'constant/solid/thermophysicalProperties',
        content: `FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "constant/solid";
    object      thermophysicalProperties;
}
// Solid Material: ${mat.name}
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
        kappa       ${mat.thermalConductivity.toFixed(4)};
    }
    thermodynamics
    {
        Cp          ${mat.specificHeat.toFixed(2)};
        Hf          0;
    }
    equationOfState
    {
        rho         ${mat.density.toFixed(2)};
    }
}
`,
      },
      {
        path: '0/solid/T',
        content: `FoamFile
{
    version     2.0;
    format      ascii;
    class       volScalarField;
    location    "0/solid";
    object      T;
}
dimensions      [0 0 0 1 0 0 0];
internalField   uniform ${solidWallTemp};
boundaryField
{
    obstacle
    {
        type            compressible::turbulentTemperatureCoupledBaffleMixed;
        Tnbr            T;
        kappaMethod     solidThermo;
        value           uniform ${solidWallTemp};
    }
    ".*"
    {
        type            zeroGradient;
    }
}
`,
      }
    );
  }

  return baseEntries;
}

/**
 * Builds a ZIP file containing the OpenFOAM case and initiates browser download
 */
export async function downloadOpenFoamCaseZip(
  geometry: GeometryRecord,
  simConfig: SimulationConfig,
  projectName: string = 'OpenFOAM_Case'
): Promise<void> {
  const zip = new JSZip();
  const files = generateOpenFoamCaseFiles(geometry, simConfig, projectName);

  const folderName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const root = zip.folder(folderName) || zip;

  for (const file of files) {
    root.file(file.path, file.content);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}_OpenFOAM.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
