# Vercel deployment

## Important architecture note

Vercel is suitable for the Vite frontend, but it is **not a replacement for the OpenFOAM backend** in this repository. The backend runs Express, keeps in-memory sessions and simulation jobs, writes temporary case files, and launches OpenFOAM commands. Those workloads need a persistent Linux host, Docker host, VM, or another backend service where OpenFOAM is installed.

The reliable setup is:

- **Vercel:** frontend build and static assets
- **Persistent Linux backend:** `server.ts` (built to `dist/server.cjs`), OpenFOAM, authentication, simulation jobs, reports

## Vercel project settings

The repository includes `vercel.json` with these settings:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- SPA fallback: all frontend routes resolve to `index.html`

## Vercel environment variables

Set this variable in Vercel for **Production**, **Preview**, and **Development** as needed:

```env
VITE_API_BASE_URL=https://your-cfd-backend.example.com
VITE_APP_ENV=production
```

`VITE_API_BASE_URL` must be the public HTTPS URL of the deployed backend, without a trailing slash. The frontend automatically uses relative `/api` calls locally when this variable is empty, and the separate backend URL after a Vercel build.

## Backend environment variables

Set these on the persistent backend, not in Vercel:

```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGIN=https://your-vercel-project.vercel.app
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
OPENFOAM_EXEC_MODE=native
ALLOW_GUEST_SIMULATIONS=true
CASE_TIMEOUT_MS=600000
MAX_CONCURRENT_JOBS=2
LOG_LEVEL=info
GEMINI_API_KEY=<only-if-AI-advisor-is-enabled>
```

Use the final custom Vercel domain in `ALLOWED_ORIGIN` if you have one. Do not commit real secrets or place backend secrets in `VITE_*` variables; Vite exposes `VITE_*` values to the browser.

## Local laptop behavior

For the existing local setup, leave `VITE_API_BASE_URL` empty. The Vite dev proxy continues to send `/api` requests to the local backend, and the backend continues to use local OpenFOAM.

```bash
npm install
npm run dev
```

## Before publishing

1. Deploy the persistent backend and verify `https://your-cfd-backend.example.com/api/health`.
2. Set `VITE_API_BASE_URL` in Vercel and redeploy; it is a build-time variable.
3. Set the backend `ALLOWED_ORIGIN` to the Vercel domain.
4. Confirm the backend has OpenFOAM installed and `simpleFoam` is available.
5. Test login, project loading, a simulation submission, status polling, and report export from the Vercel URL.

## Simulation accuracy and access

The Run page no longer opens the login popup before dispatching a case. In local development, simulation access is available as the `guest-local` operator. In production, set `ALLOW_GUEST_SIMULATIONS=true` on the backend only if you intentionally want public simulation access; otherwise configure a real login flow.

The backend now refuses to manufacture synthetic CFD results when OpenFOAM is unavailable. It reports the solver error instead. Accurate values require OpenFOAM to be installed on the persistent backend, with the selected solver and utilities (`blockMesh`, `snappyHexMesh`, `checkMesh`, `simpleFoam`, and `foamToVTK`) available on `PATH`. The UI sends the selected inlet velocity, viscosity, iteration limit, and mesh-domain choice to the case generator. Arbitrary combinations cannot all be physically valid: unsupported solvers, invalid mesh/geometry, unstable boundary conditions, or impossible material values must be rejected or reported by OpenFOAM rather than presented as accurate results.
