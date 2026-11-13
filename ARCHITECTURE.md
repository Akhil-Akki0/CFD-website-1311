# System Architecture & Data Flow

**DEVELOPED by Akhil.A (`akkedu01@gmail.com`)**

## End-to-End Computational Pipeline

```text
[ React 18 + Vite Frontend ]
        │
        │ POST /api/run-simulation (JSON + STL Base64)
        ▼
[ Node.js Express Secure Backend (Port 3001) ]
  ├── OWASP Middleware: Helmet, RateLimiter, JWT Auth
  ├── UUID Generator: /tmp/of_cases/<uuid>/
  ├── STL Writer: constant/triSurface/geometry.stl
  └── Dictionary Generator: blockMeshDict, snappyHexMeshDict, controlDict, etc.
        │
        │ WSL2 Bridge / Native Linux Process Execution
        ▼
[ OpenFOAM v2606 Engine (WSL2 / Docker) ]
  1. blockMesh (Generates 6x4x4m background hexahedral grid)
  2. snappyHexMesh -overwrite (Snaps to cylinder STL, cuts obstacle)
  3. checkMesh (Validates topology, checks cells > 16,000)
  4. simpleFoam (Solves steady-state incompressible Navier-Stokes)
  5. foamToVTK -latestTime (Converts field data to VTK)
        │
        │ File Parsing & Telemetry Extraction
        ▼
[ Backend Parser Module ]
  ├── parseVtkMetrics: Points, Cells, Max Velocity, Stagnation Pressure
  ├── parseResiduals: Ux, Uy, Continuity, k, omega convergence history
  └── postProcessing: Forces, Lift (CL), Drag (CD)
        │
        │ GET /api/simulation-status/<uuid> (Polling)
        ▼
[ React Dynamic Viewports & Telemetry Drawers ]
  ├── SolverConsole.tsx (Live stdout logs)
  ├── ResidualsChart.tsx (True residual curves)
  ├── ConvergenceProgressBar.tsx (Navier-Stokes convergence status)
  └── Telemetry Badges (Max Vel = 1.38 m/s, Max Pressure = 0.6125 Pa, CD = 1.18)
```
