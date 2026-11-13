# CFD Client Website — RIMZ OpenFOAM CFD Platform

A React/TypeScript and Node.js/Express workbench for preparing, queuing, and executing native OpenFOAM v2606 Computational Fluid Dynamics (CFD) cases.

## Accuracy contract

- The backend executes native `blockMesh`, `snappyHexMesh`, `checkMesh`, `simpleFoam`, `chtMultiRegionSimpleFoam`, `decomposePar`, `mpirun`, `reconstructPar`, and `foamToVTK` only.
- A validated STL payload is required. No placeholder geometry or synthetic mesh is created.
- If OpenFOAM is unavailable, `/readyz` returns `503` and simulations fail safely with actionable diagnostic translation.
- CFD metrics are returned only after native meshing, solver execution, VTK extraction, and force-coefficient parsing succeed.
- Failed, aborted, or incomplete runs return `metrics: null`; the UI shows unavailable values instead of estimates.
- All temporary cases execute inside isolated `/tmp/of_cases/<uuid>/` directories with automatic 24-hour disk cleanup.

## Prerequisites

- Node.js 18+
- npm
- Native OpenFOAM v2606 installed and sourced on `PATH` (including `blockMesh`, `snappyHexMesh`, `checkMesh`, `simpleFoam`, `chtMultiRegionSimpleFoam`, `foamToVTK`, plus `decomposePar`, `reconstructPar`, and OpenMPI `mpirun` for 4-core parallel mode)

## Backend Architecture

- **Single Backend Entry Point**: `server.ts` (Express + Vite dev middleware / compiled production `dist/server.cjs`)
- **Backend Modules (`/backend`)**:
  - `backend/openfoamRunner.js` — Sandboxed execution, FIFO concurrency queue, MPI parallel runner, process abort control, VTK/telemetry parser
  - `backend/openfoamDiagnostics.js` — Pre-flight validation, OpenFOAM fatal error translation, `checkMesh` health parser, and 24-hour `/tmp/of_cases/` cleanup scheduler
  - `backend/validation.js` — Strict Zod schemas, STL binary/ASCII integrity verification (`validateStlBuffer`), AI anti-injection filtering
  - `backend/auth.js` — JWT + HttpOnly refresh token rotation, CSRF protection, TOTP 2FA, and RBAC
  - `backend/logger.js` — Structured JSON audit logging with automatic secret/payload redaction

## Quickstart

```bash
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000`.

Check backend readiness:

```bash
curl -i http://localhost:3000/readyz
curl http://localhost:3000/api/health
curl http://localhost:3000/api/queue-status
```

A `503` readiness response means the host does not have OpenFOAM sourced yet. Install/source OpenFOAM and restart the backend; do not interpret the setup preview or unavailable fields as solver output.

## Production deployment

The frontend may be hosted separately, while the persistent OpenFOAM backend runs on a Linux, WSL2, or Docker host via `dist/server.cjs` (built by `npm run build` from `server.ts`). See `VERCEL_DEPLOYMENT.md` for architecture details.