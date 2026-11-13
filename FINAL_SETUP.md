# CFD Platform — Accuracy-Safe Build

## Requirements

- Node.js 18 or newer
- npm
- Native OpenFOAM installed and available on `PATH` for solver runs

The backend does **not** use a surrogate solver or placeholder mesh. Without OpenFOAM, the UI remains available for setup, but `/readyz` returns `503` and simulations fail safely without CFD metrics.

## Install and run

```bash
npm install
npm run lint
npm run dev
```

Open http://localhost:3000

## OpenFOAM prerequisites

The backend must be able to execute these commands:

```text
blockMesh
snappyHexMesh
checkMesh
simpleFoam
chtMultiRegionSimpleFoam
decomposePar
mpirun
reconstructPar
foamToVTK
```

Install and source the OpenFOAM environment before starting the backend. The exact install path depends on the OpenFOAM distribution and host OS.

A **real, validated STL upload is required** for every simulation. Preset geometry metadata or generated preview geometry is not passed to the solver as a substitute for an STL file.

Check backend readiness:

```bash
curl -i http://localhost:3000/readyz
curl http://localhost:3000/api/health
```

Only a successful native OpenFOAM run can produce mesh cells, residuals, velocity, pressure, lift, or drag values. Failed and incomplete runs return no CFD metrics.

## Production build

```bash
npm run build
npm start
```

## Important

After replacing an older local copy, stop any old server process with `Ctrl+C`, run `npm run dev` again, and refresh Chrome with `Ctrl+Shift+R`. This is important because an older server process may still contain the removed fallback behavior.
