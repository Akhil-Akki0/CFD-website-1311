# API Reference Specification

**DEVELOPED by Akhil.A (`akkedu01@gmail.com`)**

## Endpoints

### 1. Health Probe
- **Method:** `GET`
- **Route:** `/api/health`
- **Description:** Probes host platform, OpenFOAM binaries (`simpleFoam`), and safe case directory.
- **Response 200 OK:**
```json
{
  "status": "ok",
  "timestamp": "2026-09-19T02:50:00.000Z",
  "openfoamVersion": "v2606",
  "openfoamDetected": true,
  "platform": "win32",
  "safeDirectory": "/tmp/of_cases",
  "developer": "Akhil.A (akkedu01@gmail.com)"
}
```

---

### 2. User Authentication
- **Method:** `POST`
- **Route:** `/api/auth/login`
- **Request Body:**
```json
{
  "email": "akkedu01@gmail.com",
  "password": "YOUR_SECURE_PASSWORD"
}
```
- **Response 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "user_admin_001",
    "email": "akkedu01@gmail.com",
    "role": "admin"
  }
}
```

---

### 3. Run Simulation
- **Method:** `POST`
- **Route:** `/api/run-simulation` (or `/api/simulate`)
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "geometry": {
    "name": "Cylinder STL",
    "filename": "geometry.stl",
    "stlBase64": "data:model/stl;base64,c29saWQgY3lsaW5kZXI..."
  },
  "config": {
    "inletVelocity": 1.0,
    "maxIterations": 500,
    "domain": "compact"
  }
}
```
- **Response 200 OK:**
```json
{
  "status": "started",
  "caseId": "550e8400-e29b-41d4-a716-446655440000",
  "caseDir": "/tmp/of_cases/550e8400-e29b-41d4-a716-446655440000",
  "message": "Simulation triggered in WSL2 OpenFOAM environment."
}
```

---

### 4. Poll Simulation Status
- **Method:** `GET`
- **Route:** `/api/simulation-status/:caseId`
- **Response 200 OK:**
```json
{
  "caseId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "logs": [
    "[INIT] Case queued...",
    "[EXEC] Running blockMesh...",
    "[EXEC] Running snappyHexMesh -overwrite...",
    "[SUCCESS] OpenFOAM v2606 finished successfully."
  ],
  "result": {
    "success": true,
    "metrics": {
      "cells": 42800,
      "points": 49220,
      "maxVelocity": 1.38,
      "minVelocity": 0.05,
      "maxPressure": 0.6125,
      "minPressure": -0.75,
      "cL": 0.002,
      "cD": 1.18
    },
    "residuals": [
      {
        "iteration": 500,
        "continuity": 0.000012,
        "xMomentum": 0.000024
      }
    ],
    "vtkBase64": "..."
  }
}
```
