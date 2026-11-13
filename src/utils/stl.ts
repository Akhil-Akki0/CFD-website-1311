import { ParsedMeshData } from '../types';

type TriangleMesh = Pick<ParsedMeshData, 'vertices' | 'faces'>;

/** Serialize a triangle mesh as an ASCII STL data URL accepted by the API. */
export function meshToStlDataUrl(mesh: TriangleMesh, name = 'geometry'): string {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const lines = [`solid ${safeName}`];

  for (const [i0, i1, i2] of mesh.faces) {
    const v0 = mesh.vertices[i0];
    const v1 = mesh.vertices[i1];
    const v2 = mesh.vertices[i2];
    if (!v0 || !v1 || !v2) continue;

    const ax = v1[0] - v0[0];
    const ay = v1[1] - v0[1];
    const az = v1[2] - v0[2];
    const bx = v2[0] - v0[0];
    const by = v2[1] - v0[1];
    const bz = v2[2] - v0[2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const length = Math.hypot(nx, ny, nz) || 1;

    lines.push(
      `  facet normal ${(nx / length).toExponential(8)} ${(ny / length).toExponential(8)} ${(nz / length).toExponential(8)}`,
      '    outer loop',
      `      vertex ${v0[0].toPrecision(10)} ${v0[1].toPrecision(10)} ${v0[2].toPrecision(10)}`,
      `      vertex ${v1[0].toPrecision(10)} ${v1[1].toPrecision(10)} ${v1[2].toPrecision(10)}`,
      `      vertex ${v2[0].toPrecision(10)} ${v2[1].toPrecision(10)} ${v2[2].toPrecision(10)}`,
      '    endloop',
      '  endfacet',
    );
  }

  lines.push(`endsolid ${safeName}`);
  return `data:application/sla;base64,${btoa(lines.join('\n'))}`;
}
