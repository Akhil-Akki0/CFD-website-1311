/**
 * Pure ASCII VTK Mesh & Field Parser + Colormap LUT Mapper
 * Supports OpenFOAM foamToVTK POLYDATA & UNSTRUCTURED_GRID ASCII outputs
 * with VECTORS U, SCALARS p, SCALARS T, and SCALARS wallHeatFlux.
 */

export type VtkContourField = 'velocity' | 'pressure' | 'temperature';
export type VtkColormap = 'turbo' | 'coolwarm' | 'viridis';

export interface VtkFieldBounds {
  min: number;
  max: number;
  unit: string;
  label: string;
}

export interface ParsedVtkMesh {
  pointCount: number;
  cellCount: number;
  triangleCount: number;
  positions: Float32Array;
  indices: Uint32Array;
  fields: {
    velocity?: Float32Array;
    pressure?: Float32Array;
    temperature?: Float32Array;
  };
  bounds: {
    velocity?: VtkFieldBounds;
    pressure?: VtkFieldBounds;
    temperature?: VtkFieldBounds;
  };
  spatialBounds: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    radius: number;
  };
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0.5;
  return Math.max(0, Math.min(1, t));
}

function interpolateStops(t: number, stops: [number, number, number][]): [number, number, number] {
  const clamped = clamp01(t);
  const maxIdx = stops.length - 1;
  const scaled = clamped * maxIdx;
  const i0 = Math.floor(scaled);
  const i1 = Math.min(maxIdx, i0 + 1);
  const frac = scaled - i0;
  const c0 = stops[i0];
  const c1 = stops[i1];
  return [
    c0[0] + (c1[0] - c0[0]) * frac,
    c0[1] + (c1[1] - c0[1]) * frac,
    c0[2] + (c1[2] - c0[2]) * frac,
  ];
}

const COLORMAP_STOPS: Record<VtkColormap, [number, number, number][]> = {
  turbo: [
    [0.18995, 0.07176, 0.23217],
    [0.25107, 0.44522, 0.91638],
    [0.09778, 0.77933, 0.72899],
    [0.54534, 0.92891, 0.28162],
    [0.98301, 0.71346, 0.14568],
    [0.85597, 0.20714, 0.02943],
    [0.4796, 0.01583, 0.01055],
  ],
  coolwarm: [
    [0.2298, 0.2987, 0.7537],
    [0.436, 0.573, 0.941],
    [0.8654, 0.8654, 0.8654],
    [0.941, 0.562, 0.443],
    [0.7057, 0.0156, 0.1502],
  ],
  viridis: [
    [0.267, 0.0049, 0.3294],
    [0.2539, 0.2652, 0.5299],
    [0.1636, 0.4711, 0.5581],
    [0.1347, 0.6586, 0.5176],
    [0.4775, 0.8214, 0.3182],
    [0.9932, 0.9062, 0.1439],
  ],
};

export function sampleColormapRgb(t: number, palette: VtkColormap = 'turbo'): [number, number, number] {
  return interpolateStops(t, COLORMAP_STOPS[palette] || COLORMAP_STOPS.turbo);
}

export function getColormapCssGradient(palette: VtkColormap = 'turbo'): string {
  const stops = COLORMAP_STOPS[palette] || COLORMAP_STOPS.turbo;
  const cssStops = stops.map((c, idx) => {
    const pct = Math.round((idx / (stops.length - 1)) * 100);
    return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}) ${pct}%`;
  });
  return `linear-gradient(90deg, ${cssStops.join(', ')})`;
}

export function mapScalarToColorArray(
  values: Float32Array,
  min: number,
  max: number,
  palette: VtkColormap = 'turbo'
): Float32Array {
  const out = new Float32Array(values.length * 3);
  const span = max - min;
  const invSpan = Math.abs(span) > 1e-12 ? 1 / span : 0;

  for (let i = 0; i < values.length; i++) {
    const norm = invSpan > 0 ? clamp01((values[i] - min) * invSpan) : 0.5;
    const [r, g, b] = sampleColormapRgb(norm, palette);
    const j = i * 3;
    out[j] = r;
    out[j + 1] = g;
    out[j + 2] = b;
  }
  return out;
}

function computeArrayBounds(arr: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  return { min, max };
}

/**
 * Parses an ASCII legacy VTK file (POLYDATA or UNSTRUCTURED_GRID) into
 * GPU-ready Float32Array/Uint32Array geometry & contour field buffers.
 */
export function parseAsciiVtk(vtkText: string): ParsedVtkMesh {
  if (!vtkText || typeof vtkText !== 'string') {
    throw new Error('Empty or invalid VTK payload.');
  }

  const lines = vtkText.split(/\r?\n/);
  let pointCount = 0;
  let cellCount = 0;
  const positionsList: number[] = [];
  const triangleIndices: number[] = [];

  let velocityArr: Float32Array | undefined;
  let pressureArr: Float32Array | undefined;
  let temperatureArr: Float32Array | undefined;

  let dataScope: 'POINT_DATA' | 'CELL_DATA' = 'POINT_DATA';
  let cellScalarTemp: number[] = [];
  const cellToVertices: number[][] = [];

  let i = 0;
  const readNumbers = (targetCount: number, startIdx: number): { values: number[]; nextIdx: number } => {
    const values: number[] = [];
    let idx = startIdx;
    while (idx < lines.length && values.length < targetCount) {
      const trimmed = lines[idx].trim();
      idx++;
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Stop if we hit another VTK section keyword unexpectedly
      if (/^(POINTS|POLYGONS|CELLS|CELL_TYPES|POINT_DATA|CELL_DATA|SCALARS|VECTORS|TENSORS|FIELD|LOOKUP_TABLE)\b/i.test(trimmed)) {
        idx--;
        break;
      }
      const tokens = trimmed.split(/\s+/);
      for (const tok of tokens) {
        const num = Number(tok);
        if (Number.isFinite(num)) {
          values.push(num);
        }
      }
    }
    return { values, nextIdx: idx };
  };

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) {
      i++;
      continue;
    }

    if (line.startsWith('POINTS ')) {
      const parts = line.split(/\s+/);
      pointCount = parseInt(parts[1], 10) || 0;
      const { values, nextIdx } = readNumbers(pointCount * 3, i + 1);
      for (let k = 0; k < Math.min(values.length, pointCount * 3); k++) {
        positionsList.push(values[k]);
      }
      i = nextIdx;
      continue;
    }

    if (line.startsWith('POLYGONS ') || line.startsWith('CELLS ')) {
      const parts = line.split(/\s+/);
      cellCount = parseInt(parts[1], 10) || 0;
      const totalInts = parseInt(parts[2], 10) || cellCount * 4;
      const { values, nextIdx } = readNumbers(totalInts, i + 1);
      let cursor = 0;
      while (cursor < values.length) {
        const nVerts = Math.trunc(values[cursor]);
        cursor++;
        if (nVerts <= 0 || cursor + nVerts > values.length) break;
        const poly = values.slice(cursor, cursor + nVerts).map((v) => Math.trunc(v));
        cellToVertices.push(poly);
        if (nVerts >= 3) {
          for (let t = 1; t < nVerts - 1; t++) {
            triangleIndices.push(poly[0], poly[t], poly[t + 1]);
          }
        }
        cursor += nVerts;
      }
      i = nextIdx;
      continue;
    }

    if (line.startsWith('POINT_DATA ')) {
      dataScope = 'POINT_DATA';
      i++;
      continue;
    }

    if (line.startsWith('CELL_DATA ')) {
      dataScope = 'CELL_DATA';
      i++;
      continue;
    }

    if (line.startsWith('VECTORS ')) {
      const parts = line.split(/\s+/);
      const fieldName = parts[1];
      const expectedCount = dataScope === 'POINT_DATA' ? pointCount : cellCount;
      const { values, nextIdx } = readNumbers(expectedCount * 3, i + 1);
      if ((fieldName === 'U' || fieldName === 'velocity') && pointCount > 0) {
        const mags = new Float32Array(pointCount);
        if (dataScope === 'POINT_DATA') {
          for (let p = 0; p < pointCount && p * 3 + 2 < values.length; p++) {
            const ux = values[p * 3];
            const uy = values[p * 3 + 1];
            const uz = values[p * 3 + 2];
            mags[p] = Math.hypot(ux, uy, uz);
          }
        } else {
          // Project cell magnitudes onto incident vertices
          const accum = new Float64Array(pointCount);
          const counts = new Uint32Array(pointCount);
          for (let c = 0; c < cellToVertices.length && c * 3 + 2 < values.length; c++) {
            const mag = Math.hypot(values[c * 3], values[c * 3 + 1], values[c * 3 + 2]);
            for (const vIdx of cellToVertices[c]) {
              if (vIdx >= 0 && vIdx < pointCount) {
                accum[vIdx] += mag;
                counts[vIdx]++;
              }
            }
          }
          for (let p = 0; p < pointCount; p++) {
            mags[p] = counts[p] > 0 ? accum[p] / counts[p] : 0;
          }
        }
        velocityArr = mags;
      }
      i = nextIdx;
      continue;
    }

    if (line.startsWith('SCALARS ')) {
      const parts = line.split(/\s+/);
      const fieldName = parts[1];
      let nextStart = i + 1;
      if (lines[nextStart] && lines[nextStart].trim().startsWith('LOOKUP_TABLE')) {
        nextStart++;
      }
      const expectedCount = dataScope === 'POINT_DATA' ? pointCount : cellCount;
      const { values, nextIdx } = readNumbers(expectedCount, nextStart);

      if (pointCount > 0 && values.length > 0) {
        const mapped = new Float32Array(pointCount);
        if (dataScope === 'POINT_DATA') {
          for (let p = 0; p < pointCount && p < values.length; p++) {
            mapped[p] = values[p];
          }
        } else {
          cellScalarTemp = values;
          const accum = new Float64Array(pointCount);
          const counts = new Uint32Array(pointCount);
          for (let c = 0; c < cellToVertices.length && c < cellScalarTemp.length; c++) {
            const val = cellScalarTemp[c];
            for (const vIdx of cellToVertices[c]) {
              if (vIdx >= 0 && vIdx < pointCount) {
                accum[vIdx] += val;
                counts[vIdx]++;
              }
            }
          }
          for (let p = 0; p < pointCount; p++) {
            mapped[p] = counts[p] > 0 ? accum[p] / counts[p] : 0;
          }
        }

        if (fieldName === 'p' || fieldName === 'p_rgh' || fieldName === 'pressure') {
          pressureArr = mapped;
        } else if (fieldName === 'T' || fieldName === 'temperature') {
          temperatureArr = mapped;
        } else if (fieldName === 'U_mag' || fieldName === 'velocityMagnitude') {
          velocityArr = mapped;
        }
      }
      i = nextIdx;
      continue;
    }

    i++;
  }

  if (pointCount === 0 || positionsList.length < 9) {
    throw new Error('VTK mesh contains no valid 3D POINTS data.');
  }

  const positions = new Float32Array(positionsList);
  const indices = new Uint32Array(triangleIndices);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let p = 0; p < pointCount; p++) {
    const x = positions[p * 3];
    const y = positions[p * 3 + 1];
    const z = positions[p * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const radius = Math.max(0.1, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) * 0.5);

  const bounds: ParsedVtkMesh['bounds'] = {};
  if (velocityArr) {
    const b = computeArrayBounds(velocityArr);
    bounds.velocity = { ...b, unit: 'm/s', label: 'Velocity Magnitude |U|' };
  }
  if (pressureArr) {
    const b = computeArrayBounds(pressureArr);
    bounds.pressure = { ...b, unit: 'Pa', label: 'Static Pressure p' };
  }
  if (temperatureArr) {
    const b = computeArrayBounds(temperatureArr);
    bounds.temperature = { ...b, unit: 'K', label: 'Surface Temperature T' };
  }

  return {
    pointCount,
    cellCount: cellCount || Math.floor(indices.length / 3),
    triangleCount: Math.floor(indices.length / 3),
    positions,
    indices,
    fields: {
      velocity: velocityArr,
      pressure: pressureArr,
      temperature: temperatureArr,
    },
    bounds,
    spatialBounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [cx, cy, cz],
      radius,
    },
  };
}

/**
 * Decodes base64 VTK text safely in browser or Node.
 */
export function decodeVtkBase64(vtkBase64: string): string {
  const cleaned = vtkBase64.replace(/^data:[^;]+;base64,/, '').trim();
  if (typeof atob === 'function') {
    const bin = atob(cleaned);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(cleaned, 'base64').toString('utf8');
}

/**
 * Generates a clean ASCII VTK POLYDATA 3D wheel-rim / cylinder body with
 * realistic potential-flow Velocity (U), Pressure (p), and Temperature (T) contours
 * for immediate browser inspection when inspecting sample or benchmark results.
 */
export function generateSampleCfdVtk(options?: {
  inletVelocity?: number;
  solidWallTemperature?: number;
  includeThermal?: boolean;
}): string {
  const uInf = Math.max(1, options?.inletVelocity ?? 25);
  const tWall = options?.solidWallTemperature ?? 350;
  const includeThermal = options?.includeThermal ?? true;

  const nTheta = 32;
  const nSpan = 12;
  const outerR = 0.55;
  const width = 0.72;

  const points: [number, number, number][] = [];
  const velocities: [number, number, number][] = [];
  const pressures: number[] = [];
  const temps: number[] = [];

  for (let iz = 0; iz <= nSpan; iz++) {
    const zFrac = iz / nSpan;
    const z = (zFrac - 0.5) * width;
    // Slight ergonomic rim-barrel taper
    const radiusProfile = outerR * (1 - 0.08 * Math.cos(zFrac * Math.PI * 2));

    for (let it = 0; it < nTheta; it++) {
      const theta = (it / nTheta) * Math.PI * 2;
      const x = radiusProfile * Math.cos(theta);
      const y = radiusProfile * Math.sin(theta);
      points.push([x, y, z]);

      // Flow enters from -X -> +X
      // Stagnation near cos(theta) = -1 (windward), peak acceleration at cos(theta) ~ 0 (top/bottom)
      const windward = -Math.cos(theta);
      const speedFactor = 0.25 + 1.65 * Math.pow(Math.sin(theta), 2) + 0.12 * Math.sin(zFrac * Math.PI);
      const wakeAtten = Math.cos(theta) > 0.2 ? 0.55 : 1.0;
      const uMag = uInf * speedFactor * wakeAtten;

      const ux = uMag * (0.85 + 0.15 * Math.abs(Math.sin(theta)));
      const uy = uMag * 0.28 * Math.sin(2 * theta);
      const uz = uMag * 0.06 * Math.sin(zFrac * Math.PI * 2);
      velocities.push([ux, uy, uz]);

      const cp = 1 - Math.pow(speedFactor * wakeAtten, 2);
      const pVal = 101325 + 0.5 * 1.225 * uInf * uInf * cp + windward * 120;
      pressures.push(pVal);

      // Convective cooling on high-velocity crown, hotter near leeward wake
      const tempVal = tWall - 24 * speedFactor + (Math.cos(theta) > 0 ? 12 : -6);
      temps.push(tempVal);
    }
  }

  const quads: [number, number, number, number][] = [];
  for (let iz = 0; iz < nSpan; iz++) {
    for (let it = 0; it < nTheta; it++) {
      const nextIt = (it + 1) % nTheta;
      const p0 = iz * nTheta + it;
      const p1 = iz * nTheta + nextIt;
      const p2 = (iz + 1) * nTheta + nextIt;
      const p3 = (iz + 1) * nTheta + it;
      quads.push([p0, p1, p2, p3]);
    }
  }

  const lines: string[] = [
    '# vtk DataFile Version 3.0',
    'RIMZ OpenFOAM Sample Post-Processing Surface',
    'ASCII',
    'DATASET POLYDATA',
    `POINTS ${points.length} float`,
  ];

  for (const [x, y, z] of points) {
    lines.push(`${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)}`);
  }

  lines.push(`POLYGONS ${quads.length} ${quads.length * 5}`);
  for (const [a, b, c, d] of quads) {
    lines.push(`4 ${a} ${b} ${c} ${d}`);
  }

  lines.push(`POINT_DATA ${points.length}`);
  lines.push('VECTORS U float');
  for (const [ux, uy, uz] of velocities) {
    lines.push(`${ux.toFixed(4)} ${uy.toFixed(4)} ${uz.toFixed(4)}`);
  }

  lines.push('SCALARS p float 1');
  lines.push('LOOKUP_TABLE default');
  for (const p of pressures) {
    lines.push(p.toFixed(2));
  }

  if (includeThermal) {
    lines.push('SCALARS T float 1');
    lines.push('LOOKUP_TABLE default');
    for (const t of temps) {
      lines.push(t.toFixed(2));
    }
  }

  return lines.join('\n');
}
