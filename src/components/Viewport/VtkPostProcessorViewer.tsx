import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  decodeVtkBase64,
  generateSampleCfdVtk,
  getColormapCssGradient,
  mapScalarToColorArray,
  parseAsciiVtk,
  ParsedVtkMesh,
  VtkColormap,
  VtkContourField,
} from '../../utils/vtkParser';
import { Box, Eye, Layers, RotateCcw, Upload } from 'lucide-react';

export interface VtkPostProcessorViewerHandle {
  captureSnapshot: () => string;
}

interface VtkPostProcessorViewerProps {
  vtkBase64?: string | null;
  vtkText?: string | null;
  geometryLabel?: string;
  inletVelocity?: number;
  solidWallTemperature?: number;
  includeThermalSample?: boolean;
  height?: number;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const rendererStr = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return /SwiftShader|llvmpipe|Software/i.test(rendererStr);
  } catch {
    return true;
  }
}

export const VtkPostProcessorViewer = forwardRef<VtkPostProcessorViewerHandle, VtkPostProcessorViewerProps>(
  (
    {
      vtkBase64,
      vtkText,
      geometryLabel = 'RIMZ Aero Body',
      inletVelocity = 25,
      solidWallTemperature = 350,
      includeThermalSample = true,
      height = 380,
    },
    ref
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [uploadedVtkText, setUploadedVtkText] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [contourField, setContourField] = useState<VtkContourField>('velocity');
    const [colormap, setColormap] = useState<VtkColormap>('turbo');
    const [showWireframe, setShowWireframe] = useState<boolean>(false);
    const [parseError, setParseError] = useState<string | null>(null);

    // Resolve active VTK source priority: uploaded file -> prop vtkText -> prop vtkBase64 -> sample CFD VTK
    const resolvedVtkSource = useMemo(() => {
      if (uploadedVtkText) {
        return { text: uploadedVtkText, sourceLabel: `Uploaded: ${uploadedFileName || 'custom.vtk'}` };
      }
      if (vtkText && vtkText.trim().length > 0) {
        return { text: vtkText, sourceLabel: 'OpenFOAM LatestTime VTK' };
      }
      if (vtkBase64 && vtkBase64.trim().length > 0) {
        try {
          return { text: decodeVtkBase64(vtkBase64), sourceLabel: 'OpenFOAM Solver VTK Output' };
        } catch {
          // Fall through to sample mesh if base64 decode fails
        }
      }
      return {
        text: generateSampleCfdVtk({
          inletVelocity,
          solidWallTemperature,
          includeThermal: includeThermalSample,
        }),
        sourceLabel: 'Sample 3D RIMZ VTK Contour Mesh (Upload .vtk or run native OpenFOAM)',
      };
    }, [uploadedVtkText, uploadedFileName, vtkText, vtkBase64, inletVelocity, solidWallTemperature, includeThermalSample]);

    const parsedMesh: ParsedVtkMesh | null = useMemo(() => {
      try {
        setParseError(null);
        return parseAsciiVtk(resolvedVtkSource.text);
      } catch (err: any) {
        setParseError(err?.message || 'Failed to parse ASCII VTK mesh.');
        return null;
      }
    }, [resolvedVtkSource.text]);

    // Ensure selected contourField exists in parsedMesh; gracefully select available field
    const activeField: VtkContourField = useMemo(() => {
      if (!parsedMesh) return contourField;
      if (contourField === 'temperature' && !parsedMesh.fields.temperature) {
        return parsedMesh.fields.velocity ? 'velocity' : 'pressure';
      }
      if (contourField === 'pressure' && !parsedMesh.fields.pressure) {
        return parsedMesh.fields.velocity ? 'velocity' : 'temperature';
      }
      if (contourField === 'velocity' && !parsedMesh.fields.velocity) {
        return parsedMesh.fields.pressure ? 'pressure' : 'temperature';
      }
      return contourField;
    }, [parsedMesh, contourField]);

    const activeBounds = parsedMesh?.bounds[activeField];

    // Three.js imperative scene refs (mount once, zero re-mount jitter)
    const threeRef = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      mesh: THREE.Mesh | null;
      wireframeMesh: THREE.Mesh | null;
      requestRender: () => void;
      resetCamera: () => void;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      captureSnapshot: () => {
        const ctx = threeRef.current;
        if (!ctx) return '';
        try {
          ctx.renderer.render(ctx.scene, ctx.camera);
          return ctx.renderer.domElement.toDataURL('image/png');
        } catch {
          return '';
        }
      },
    }));

    // 1. Initialize WebGLRenderer, Scene, RoomEnvironment, Camera, OrbitControls once
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareWebGL();
      const width = Math.max(320, container.clientWidth || 640);
      const viewHeight = Math.max(240, height);

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, viewHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0B1120');

      let pmremGenerator: THREE.PMREMGenerator | null = null;
      let envTexture: THREE.Texture | null = null;
      try {
        pmremGenerator = new THREE.PMREMGenerator(renderer);
        envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = envTexture;
      } catch {}

      const camera = new THREE.PerspectiveCamera(42, width / viewHeight, 0.05, 100);
      camera.position.set(1.6, 1.05, 1.9);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xf8fafc, 0.85);
      keyLight.position.set(4, 6, 4);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
      fillLight.position.set(-4, -2, -3);
      scene.add(fillLight);

      const gridHelper = new THREE.GridHelper(3.2, 16, 0x334155, 0x1e293b);
      gridHelper.position.y = -0.85;
      scene.add(gridHelper);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false; // Zero idle animation overhead
      controls.autoRotate = false;
      controls.minDistance = 0.4;
      controls.maxDistance = 12;

      let renderPending = false;
      const requestRender = () => {
        if (renderPending) return;
        renderPending = true;
        requestAnimationFrame(() => {
          renderPending = false;
          renderer.render(scene, camera);
        });
      };

      const resetCamera = () => {
        camera.position.set(1.6, 1.05, 1.9);
        controls.target.set(0, 0, 0);
        controls.update();
        requestRender();
      };

      controls.addEventListener('change', requestRender);

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(280, Math.floor(entry.contentRect.width));
          const h = Math.max(240, height);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          requestRender();
        }
      });
      resizeObserver.observe(container);

      threeRef.current = {
        renderer,
        scene,
        camera,
        controls,
        mesh: null,
        wireframeMesh: null,
        requestRender,
        resetCamera,
      };

      requestRender();

      return () => {
        resizeObserver.disconnect();
        controls.removeEventListener('change', requestRender);
        controls.dispose();
        if (threeRef.current?.mesh) {
          threeRef.current.mesh.geometry.dispose();
          (threeRef.current.mesh.material as THREE.Material).dispose();
        }
        if (threeRef.current?.wireframeMesh) {
          threeRef.current.wireframeMesh.geometry.dispose();
          (threeRef.current.wireframeMesh.material as THREE.Material).dispose();
        }
        if (envTexture) envTexture.dispose();
        if (pmremGenerator) pmremGenerator.dispose();
        renderer.dispose();
        container.innerHTML = '';
        threeRef.current = null;
      };
    }, [height]);

    // 2. Rebuild / recolor BufferGeometry when parsedMesh, activeField, colormap, or wireframe changes
    useEffect(() => {
      const ctx = threeRef.current;
      if (!ctx || !parsedMesh) return;

      if (ctx.mesh) {
        ctx.scene.remove(ctx.mesh);
        ctx.mesh.geometry.dispose();
        (ctx.mesh.material as THREE.Material).dispose();
        ctx.mesh = null;
      }
      if (ctx.wireframeMesh) {
        ctx.scene.remove(ctx.wireframeMesh);
        ctx.wireframeMesh.geometry.dispose();
        (ctx.wireframeMesh.material as THREE.Material).dispose();
        ctx.wireframeMesh = null;
      }

      const geometry = new THREE.BufferGeometry();

      // Normalize & center coordinates so any uploaded CAD/VTK fits smoothly in view
      const [cx, cy, cz] = parsedMesh.spatialBounds.center;
      const scale = 0.85 / Math.max(0.05, parsedMesh.spatialBounds.radius);
      const normalizedPos = new Float32Array(parsedMesh.positions.length);
      for (let i = 0; i < parsedMesh.pointCount; i++) {
        normalizedPos[i * 3] = (parsedMesh.positions[i * 3] - cx) * scale;
        normalizedPos[i * 3 + 1] = (parsedMesh.positions[i * 3 + 1] - cy) * scale;
        normalizedPos[i * 3 + 2] = (parsedMesh.positions[i * 3 + 2] - cz) * scale;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(normalizedPos, 3));
      if (parsedMesh.indices.length > 0) {
        geometry.setIndex(new THREE.BufferAttribute(parsedMesh.indices, 1));
      }
      geometry.computeVertexNormals();

      const scalarValues =
        parsedMesh.fields[activeField] ||
        parsedMesh.fields.velocity ||
        parsedMesh.fields.pressure ||
        parsedMesh.fields.temperature;

      if (scalarValues && activeBounds) {
        const colors = mapScalarToColorArray(scalarValues, activeBounds.min, activeBounds.max, colormap);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      } else {
        const fallbackColors = new Float32Array(parsedMesh.pointCount * 3);
        fallbackColors.fill(0.55);
        geometry.setAttribute('color', new THREE.BufferAttribute(fallbackColors, 3));
      }

      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.1,
        roughness: 0.58,
        side: THREE.DoubleSide,
      });

      const surfaceMesh = new THREE.Mesh(geometry, material);
      ctx.scene.add(surfaceMesh);
      ctx.mesh = surfaceMesh;

      if (showWireframe) {
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0xe2e8f0,
          wireframe: true,
          transparent: true,
          opacity: 0.25,
        });
        const wireMesh = new THREE.Mesh(geometry, wireMat);
        ctx.scene.add(wireMesh);
        ctx.wireframeMesh = wireMesh;
      }

      ctx.requestRender();
    }, [parsedMesh, activeField, activeBounds, colormap, showWireframe]);

    const handleUploadVtk = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setUploadedVtkText(reader.result);
          setUploadedFileName(file.name);
        }
      };
      reader.readAsText(file);
    };

    return (
      <div
        data-testid="vtk-post-processor-viewer"
        className="h-full bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs flex flex-col justify-between gap-3"
      >
        {/* Top Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shrink-0">
              <Box className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#0F172A]">
                3D VTK Post-Processing Contour Viewer — {geometryLabel}
              </h3>
              <p className="text-[11px] text-[#64748B] font-mono">
                {resolvedVtkSource.sourceLabel}
                {parsedMesh
                  ? ` | ${parsedMesh.pointCount.toLocaleString()} pts, ${parsedMesh.triangleCount.toLocaleString()} tris`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Contour Field Switcher */}
            <div className="flex items-center rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5 text-[11px]">
              <button
                type="button"
                data-testid="vtk-contour-velocity"
                disabled={!parsedMesh?.fields.velocity}
                onClick={() => setContourField('velocity')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                  activeField === 'velocity'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#334155] hover:bg-white'
                }`}
              >
                Velocity |U|
              </button>
              <button
                type="button"
                data-testid="vtk-contour-pressure"
                disabled={!parsedMesh?.fields.pressure}
                onClick={() => setContourField('pressure')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                  activeField === 'pressure'
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#334155] hover:bg-white'
                }`}
              >
                Pressure p
              </button>
              {parsedMesh?.fields.temperature && (
                <button
                  type="button"
                  data-testid="vtk-contour-temperature"
                  onClick={() => setContourField('temperature')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    activeField === 'temperature'
                      ? 'bg-[#EA580C] text-white'
                      : 'text-[#334155] hover:bg-white'
                  }`}
                >
                  Temp T (K)
                </button>
              )}
            </div>

            {/* Colormap Selector */}
            <select
              aria-label="Colormap Palette"
              value={colormap}
              onChange={(e) => setColormap(e.target.value as VtkColormap)}
              className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] text-[11px] font-semibold cursor-pointer"
            >
              <option value="turbo">Turbo LUT</option>
              <option value="coolwarm">Cool-Warm LUT</option>
              <option value="viridis">Viridis LUT</option>
            </select>

            <button
              type="button"
              onClick={() => setShowWireframe((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                showWireframe
                  ? 'bg-[#0F172A] text-white border-[#0F172A]'
                  : 'bg-white text-[#334155] border-[#CBD5E1] hover:bg-[#F8FAFC]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Wireframe</span>
            </button>

            <button
              type="button"
              onClick={() => threeRef.current?.resetCamera()}
              className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-[#334155] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset View</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Load .vtk</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".vtk"
              onChange={handleUploadVtk}
              className="hidden"
            />
          </div>
        </div>

        {parseError && (
          <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-medium">
            {parseError}
          </div>
        )}

        {/* Dedicated 3D Canvas Container (isolated from HUD overlays) */}
        <div className="relative rounded-xl overflow-hidden border border-[#1E293B] bg-[#0B1120]">
          <div
            ref={mountRef}
            style={{ height }}
            className="w-full"
          />

          {/* Solid high-contrast overlay controls (zero backdrop-blur over WebGL) */}
          <div className="absolute top-3 left-3 bg-[#0F172A] border border-[#334155] rounded-lg px-2.5 py-1 text-[10px] font-mono text-[#E2E8F0] pointer-events-none flex items-center gap-2">
            <Eye className="w-3 h-3 text-[#38BDF8]" />
            <span>Drag to Orbit • Scroll to Zoom • Right-Drag to Pan</span>
          </div>

          {activeBounds && (
            <div
              data-testid="vtk-colorbar-legend"
              className="absolute bottom-3 right-3 bg-[#0F172A] border border-[#334155] rounded-lg px-3 py-2 text-[10px] font-mono text-[#F8FAFC] space-y-1 min-w-[210px] pointer-events-none"
            >
              <div className="flex items-center justify-between text-[#94A3B8]">
                <span className="font-bold text-[#F8FAFC]">{activeBounds.label}</span>
                <span>{activeBounds.unit}</span>
              </div>
              <div
                className="h-2.5 w-full rounded border border-[#475569]"
                style={{ background: getColormapCssGradient(colormap) }}
              />
              <div className="flex items-center justify-between text-[#CBD5E1]">
                <span>{activeBounds.min.toFixed(2)}</span>
                <span>{((activeBounds.min + activeBounds.max) * 0.5).toFixed(2)}</span>
                <span>{activeBounds.max.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

VtkPostProcessorViewer.displayName = 'VtkPostProcessorViewer';
export default VtkPostProcessorViewer;
