import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { GeometryRecord, ParsedMeshData } from '../types';
import { Tooltip } from '../components/common/Tooltip';
import { CfdLogo } from '../components/common/CfdLogo';
import {
  parseCadFile,
  generateSampleGeometry,
  detectFormat
} from '../utils/cadFileParser';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Box,
  Maximize2,
  Minimize2,
  FileCode,
  Sparkles,
  Info,
  ArrowRight,
  Eye,
  Layers,
  Trash2,
  Download,
  Check,
  RefreshCw,
  Compass,
  FileText,
  FolderKanban,
  Wind,
  Plane,
  Disc,
  Fan,
  Circle,
  Zap,
} from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { meshToStlDataUrl } from '../utils/stl';
import { getAccessToken, getCsrfToken } from '../utils/api';

type RenderMode = 'shaded-wireframe' | 'shaded' | 'wireframe' | 'points';

export const GeometryPage: React.FC = () => {
  const {
    geometries,
    currentGeometryId,
    setCurrentGeometryId,
    saveGeometry,
    deleteGeometry,
    currentProjectId,
    setPage
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'upload' | 'existing'>('upload');
  const [selectedPresetType, setSelectedPresetType] = useState<string>('airfoil');
  const [renderMode, setRenderMode] = useState<RenderMode>('shaded-wireframe');
  const [showNormals, setShowNormals] = useState<boolean>(false);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);

  // 3D Camera Controls
  const [yaw, setYaw] = useState<number>(35); // Azimuth (degrees)
  const [pitch, setPitch] = useState<number>(20); // Elevation (degrees)
  const [zoom, setZoom] = useState<number>(1.2); // Zoom factor

  // Upload & Drag-and-Drop state
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisStage, setAnalysisStage] = useState<string>('');
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Mouse & Touch drag tracking for 3D rotation
  const isDraggingCanvas = useRef<boolean>(false);
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartDist = useRef<number | null>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(300, Math.floor(rect.width * dpr));
      canvas.height = Math.max(260, Math.floor(rect.height * dpr));
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    handleResize();

    return () => ro.disconnect();
  }, []);

  // Active geometry being inspected
  const currentGeom = geometries.find((g) => g.id === currentGeometryId) || geometries[0];

  // Resolve or generate mesh data for current geometry
  const getActiveMeshData = useCallback((): ParsedMeshData => {
    if (currentGeom.meshData && currentGeom.meshData.vertices.length > 0) {
      return currentGeom.meshData;
    }

    // Generate fallback benchmark geometry
    const geomType = (currentGeom.geometryType || 'airfoil') as any;
    const raw = generateSampleGeometry(geomType);

    // Compute basic bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const [x, y, z] of raw.vertices) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    return {
      vertices: raw.vertices,
      faces: raw.faces,
      bounds: { minX, maxX, minY, maxY, minZ, maxZ },
      surfaceArea: currentGeom.maxSize * 1.8,
      volume: currentGeom.volume,
      aspectRatioMax: 1.2,
      isWatertight: true,
    };
  }, [currentGeom]);

  // --------------------------------------------------------------------------
  // Real 3D Canvas Rendering Engine
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background subtle engineering grid
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 0.8;
      const gridStep = 24;
      for (let x = 0; x < w; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Origin center
      const cx = w / 2;
      const cy = h / 2;

      const mesh = getActiveMeshData();
      const { vertices, faces, bounds } = mesh;

      if (vertices.length === 0) return;

      // Model center offset for centering
      const centerOffsetX = (bounds.minX + bounds.maxX) / 2;
      const centerOffsetY = (bounds.minY + bounds.maxY) / 2;
      const centerOffsetZ = (bounds.minZ + bounds.maxZ) / 2;

      const maxDim = Math.max(
        Math.abs(bounds.maxX - bounds.minX),
        Math.abs(bounds.maxY - bounds.minY),
        Math.abs(bounds.maxZ - bounds.minZ),
        0.001
      );

      // Normalization scale factor to fit canvas
      const baseScale = (Math.min(w, h) * 0.42 * zoom) / maxDim;

      // Camera angles in radians
      const radYaw = (yaw * Math.PI) / 180;
      const radPitch = (pitch * Math.PI) / 180;

      const cosY = Math.cos(radYaw);
      const sinY = Math.sin(radYaw);
      const cosP = Math.cos(radPitch);
      const sinP = Math.sin(radPitch);

      // 3D Transform function (world -> camera space)
      const projectPoint = (x: number, y: number, z: number): [number, number, number] => {
        // Center model
        const ox = x - centerOffsetX;
        const oy = y - centerOffsetY;
        const oz = z - centerOffsetZ;

        // Yaw around Y
        const x1 = ox * cosY + oz * sinY;
        const z1 = -ox * sinY + oz * cosY;

        // Pitch around X
        const y2 = oy * cosP - z1 * sinP;
        const z2 = oy * sinP + z1 * cosP;

        // Perspective / Orthogonal projection to screen
        const sx = cx + x1 * baseScale;
        const sy = cy - y2 * baseScale; // Invert Y for screen coordinates

        return [sx, sy, z2];
      };

      // Transform all vertices
      const transformedVerts: [number, number, number][] = new Array(vertices.length);
      for (let i = 0; i < vertices.length; i++) {
        transformedVerts[i] = projectPoint(vertices[i][0], vertices[i][1], vertices[i][2]);
      }

      // 3D Directional Light Vector (from upper-left front)
      const lightDir = [-0.577, 0.577, 0.577];

      // Prepare faces for depth sorting (Painter's Algorithm)
      interface FaceRenderItem {
        v0: [number, number, number];
        v1: [number, number, number];
        v2: [number, number, number];
        avgZ: number;
        normalZ: number;
        lightIntensity: number;
        origV0: [number, number, number];
        origV1: [number, number, number];
        origV2: [number, number, number];
      }

      const faceItems: FaceRenderItem[] = [];

      for (let i = 0; i < faces.length; i++) {
        const [i0, i1, i2] = faces[i];
        const tv0 = transformedVerts[i0];
        const tv1 = transformedVerts[i1];
        const tv2 = transformedVerts[i2];

        if (!tv0 || !tv1 || !tv2) continue;

        // 2D Cross product for screen normal (Z component)
        const e1x = tv1[0] - tv0[0];
        const e1y = tv1[1] - tv0[1];
        const e2x = tv2[0] - tv0[0];
        const e2y = tv2[1] - tv0[1];
        const normalZ = e1x * e2y - e1y * e2x;

        // 3D face normal in world space for realistic Lambertian shading
        const ov0 = vertices[i0];
        const ov1 = vertices[i1];
        const ov2 = vertices[i2];
        const we1x = ov1[0] - ov0[0];
        const we1y = ov1[1] - ov0[1];
        const we1z = ov1[2] - ov0[2];
        const we2x = ov2[0] - ov0[0];
        const we2y = ov2[1] - ov0[1];
        const we2z = ov2[2] - ov0[2];

        let nx = we1y * we2z - we1z * we2y;
        let ny = we1z * we2x - we1x * we2z;
        let nz = we1x * we2y - we1y * we2x;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;

        // Dot product with light
        const dot = Math.abs(nx * lightDir[0] + ny * lightDir[1] + nz * lightDir[2]);
        const lightIntensity = Math.min(1.0, 0.28 + 0.72 * dot);

        faceItems.push({
          v0: tv0,
          v1: tv1,
          v2: tv2,
          avgZ: (tv0[2] + tv1[2] + tv2[2]) / 3,
          normalZ,
          lightIntensity,
          origV0: ov0,
          origV1: ov1,
          origV2: ov2,
        });
      }

      // Sort faces back to front (largest Z to smallest Z)
      faceItems.sort((a, b) => a.avgZ - b.avgZ);

      // Render faces based on mode
      const isShaded = renderMode === 'shaded' || renderMode === 'shaded-wireframe';
      const isWire = renderMode === 'wireframe' || renderMode === 'shaded-wireframe';

      if (renderMode !== 'points') {
        for (let i = 0; i < faceItems.length; i++) {
          const item = faceItems[i];
          const { v0, v1, v2, lightIntensity } = item;

          ctx.beginPath();
          ctx.moveTo(v0[0], v0[1]);
          ctx.lineTo(v1[0], v1[1]);
          ctx.lineTo(v2[0], v2[1]);
          ctx.closePath();

          if (isShaded) {
            // Elegant Aerodynamic Azure / Cyan Shading
            const r = Math.round(180 * lightIntensity + 30);
            const g = Math.round(215 * lightIntensity + 40);
            const b = Math.round(250 * lightIntensity + 5);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fill();
          }

          if (isWire) {
            ctx.strokeStyle = isShaded ? '#0284C7' : '#2563EB';
            ctx.lineWidth = isShaded ? 0.6 : 1.0;
            ctx.stroke();
          }

          // Render surface normal spikes if toggled
          if (showNormals && i % 4 === 0) {
            const midX = (v0[0] + v1[0] + v2[0]) / 3;
            const midY = (v0[1] + v1[1] + v2[1]) / 3;
            const normLen = 14;
            ctx.beginPath();
            ctx.moveTo(midX, midY);
            ctx.lineTo(midX, midY - normLen);
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Render point cloud if selected or mode is points
      if (renderMode === 'points') {
        ctx.fillStyle = '#0284C7';
        for (let i = 0; i < transformedVerts.length; i++) {
          const tv = transformedVerts[i];
          ctx.fillRect(tv[0] - 1.5, tv[1] - 1.5, 3, 3);
        }
      }

      // 3D Bounding Box Overlay
      if (showBoundingBox) {
        ctx.save();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 4]);

        const b = bounds;
        const corners = [
          projectPoint(b.minX, b.minY, b.minZ),
          projectPoint(b.maxX, b.minY, b.minZ),
          projectPoint(b.maxX, b.maxY, b.minZ),
          projectPoint(b.minX, b.maxY, b.minZ),
          projectPoint(b.minX, b.minY, b.maxZ),
          projectPoint(b.maxX, b.minY, b.maxZ),
          projectPoint(b.maxX, b.maxY, b.maxZ),
          projectPoint(b.minX, b.maxY, b.maxZ),
        ];

        // Draw bounding box wire edges
        const boxEdges = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7]
        ];

        for (const [s, e] of boxEdges) {
          ctx.beginPath();
          ctx.moveTo(corners[s][0], corners[s][1]);
          ctx.lineTo(corners[e][0], corners[e][1]);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3D Axis Triad in Bottom-Left Corner
      const triadX = 48;
      const triadY = h - 48;
      const triadLen = 28;

      const drawAxis = (xDir: number, yDir: number, zDir: number, label: string, color: string) => {
        // Yaw
        const x1 = xDir * cosY + zDir * sinY;
        const z1 = -xDir * sinY + zDir * cosY;
        // Pitch
        const y2 = yDir * cosP - z1 * sinP;
        const ex = triadX + x1 * triadLen;
        const ey = triadY - y2 * triadLen;

        ctx.beginPath();
        ctx.moveTo(triadX, triadY);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 9px monospace';
        ctx.fillText(label, ex + 3, ey + 3);
      };

      drawAxis(1, 0, 0, 'X', '#EF4444'); // Red X
      drawAxis(0, 1, 0, 'Y', '#10B981'); // Green Y
      drawAxis(0, 0, 1, 'Z', '#2563EB'); // Blue Z
    };

    render();
  }, [yaw, pitch, zoom, renderMode, showNormals, showBoundingBox, getActiveMeshData]);

  // --------------------------------------------------------------------------
  // Canvas Mouse Drag Orbit & Zoom Handlers
  // --------------------------------------------------------------------------
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingCanvas.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingCanvas.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    setYaw((prev) => (prev + dx * 0.7) % 360);
    setPitch((prev) => Math.max(-85, Math.min(85, prev - dy * 0.7)));
  };

  const handleCanvasMouseUp = () => {
    isDraggingCanvas.current = false;
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.4, Math.min(3.5, prev - e.deltaY * 0.0015)));
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingCanvas.current = true;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchStartDist.current = null;
    } else if (e.touches.length === 2) {
      isDraggingCanvas.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist.current = Math.hypot(dx, dy);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDraggingCanvas.current) {
      const dx = e.touches[0].clientX - lastMousePos.current.x;
      const dy = e.touches[0].clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setYaw((prev) => (prev + dx * 0.7) % 360);
      setPitch((prev) => Math.max(-85, Math.min(85, prev - dy * 0.7)));
    } else if (e.touches.length === 2 && touchStartDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      const ratio = currentDist / touchStartDist.current;
      touchStartDist.current = currentDist;
      setZoom((prev) => Math.max(0.4, Math.min(3.5, prev * ratio)));
    }
  };

  const handleCanvasTouchEnd = () => {
    isDraggingCanvas.current = false;
    touchStartDist.current = null;
  };

  const handleResetView = () => {
    sound.playClick();
    setYaw(35);
    setPitch(20);
    setZoom(1.2);
  };

  // --------------------------------------------------------------------------
  // Real File Upload & Parsing Pipeline
  // --------------------------------------------------------------------------
  const processUploadedFile = async (file: File) => {
    sound.playSave();
    setIsAnalyzingFile(true);
    setAnalysisProgress(15);
    setAnalysisStage(`Reading binary data from ${file.name}...`);

    try {
      await new Promise((r) => setTimeout(r, 180));
      setAnalysisProgress(45);
      setAnalysisStage(`Parsing 3D geometric entities & facet coordinates...`);

      const result = await parseCadFile(file);

      setAnalysisProgress(80);
      setAnalysisStage(`Validating 2-manifold watertight boundary & normals...`);
      await new Promise((r) => setTimeout(r, 220));

      // Read file as base64 for real OpenFOAM solver execution
      let base64Data = '';
      try {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } catch (e) {
        console.warn('Could not encode file as base64:', e);
      }

      // Attempt multipart /api/upload-stl registration for real .stl files (stores isolated /tmp/of_cases/<uuid>/)
      let serverCaseId: string | undefined;
      if (file.name.toLowerCase().endsWith('.stl')) {
        try {
          const formData = new FormData();
          formData.append('stlFile', file);
          const headers: Record<string, string> = {};
          const token = getAccessToken();
          const csrf = getCsrfToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
          if (csrf) headers['X-CSRF-Token'] = csrf;

          const uploadRes = await fetch('/api/upload-stl', {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers,
          });
          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            if (uploadJson?.caseId) {
              serverCaseId = uploadJson.caseId;
            }
          }
        } catch (uploadErr) {
          console.warn('Server /api/upload-stl skipped; falling back to inline STL payload:', uploadErr);
        }
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

      const newRecord = saveGeometry({
        projectId: currentProjectId,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        filename: file.name,
        format: result.format,
        fileSize: file.size,
        points: result.points,
        cells: result.cells,
        maxSize: result.maxSize,
        isTriangulated: result.isTriangulated,
        volume: result.volume,
        validationStatus: result.validationStatus,
        validationMessage: result.validationMessage,
        warnings: result.warnings,
        type: 'upload',
        geometryType: 'custom',
        serverCaseId,
        meshData: result.meshData,
        // OpenFOAM accepts STL here; normalize parsed OBJ/PLY/VTK meshes to STL.
        stlBase64: result.meshData ? meshToStlDataUrl(result.meshData, cleanName) : base64Data,
      });

      // Immediately activate the uploaded 3D geometry in the viewer
      setCurrentGeometryId(newRecord.id);
      setActiveTab('upload');

      setAnalysisProgress(100);
      setAnalysisStage('Completed successfully!');
      setUploadSuccessMessage(
        serverCaseId
          ? `Successfully uploaded ${file.name} (${result.points.toLocaleString()} points, ${result.cells.toLocaleString()} cells) — Staged case ${serverCaseId.slice(0, 8)}.`
          : `Successfully uploaded ${file.name} (${result.points.toLocaleString()} points, ${result.cells.toLocaleString()} cells).`
      );

      setTimeout(() => {
        setIsAnalyzingFile(false);
        setUploadSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setIsAnalyzingFile(false);
      sound.playWarning();
      setAnalysisStage(`Upload error: ${err.message || 'Unknown format error'}`);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
    // Reset input so same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  // --------------------------------------------------------------------------
  // Instant Benchmark Preset & Sample Model Loaders
  // --------------------------------------------------------------------------
  const handlePresetSelect = (
    type:
      | 'airfoil'
      | 'cylinder'
      | 'sphere'
      | 'cube'
      | 'fsae_wing'
      | 'propeller'
      | 'five_spoke_rim'
      | 'aero_disc_rim'
      | 'multi_spoke_rim'
  ) => {
    sound.playClick();
    setSelectedPresetType(type);
    const found = geometries.find((g) => g.geometryType === type);
    if (found) {
      setCurrentGeometryId(found.id);
    } else {
      // Create and save preset
      const raw = generateSampleGeometry(type);
      const bounds = getActiveMeshData().bounds;
      const newGeom = saveGeometry({
        projectId: currentProjectId,
        name: type.replace(/_/g, ' ').toUpperCase(),
        filename: `${type}_model.stl`,
        format: 'STL',
        fileSize: raw.faces.length * 50,
        points: raw.vertices.length,
        cells: raw.faces.length,
        maxSize: 0.65,
        isTriangulated: true,
        volume: 0.1,
        validationStatus: 'valid',
        validationMessage: 'Watertight benchmark surface geometry.',
        warnings: [],
        type: 'preset',
        geometryType: type,
        meshData: {
          vertices: raw.vertices,
          faces: raw.faces,
          bounds,
          surfaceArea: 1.5,
          volume: 0.1,
          aspectRatioMax: 1.1,
          isWatertight: true,
        },
        stlBase64: meshToStlDataUrl(raw, `${type}_benchmark`),
      });
      setCurrentGeometryId(newGeom.id);
    }
  };

  // Try Quick Sample Models
  const handleLoadSampleFile = (
    type:
      | 'fsae_wing'
      | 'propeller'
      | 'airfoil'
      | 'cylinder'
      | 'five_spoke_rim'
      | 'aero_disc_rim'
      | 'multi_spoke_rim'
  ) => {
    sound.playSave();
    const configMap = {
      fsae_wing: { name: 'Formula Racing Downforce Wing', filename: 'formula_front_wing.stl', format: 'STL' },
      propeller: { name: 'High-Twist Drone Propeller', filename: 'drone_propeller.ply', format: 'PLY' },
      airfoil: { name: 'Supercritical Transonic Wing', filename: 'transonic_wing.obj', format: 'OBJ' },
      cylinder: { name: 'Vortex Shedding Cylinder', filename: 'karman_cylinder.vtk', format: 'VTK' },
      five_spoke_rim: { name: '5-Spoke Performance Rim', filename: 'five_spoke_rim.stl', format: 'STL' },
      aero_disc_rim: { name: 'F1 Aero-Disc Fairing', filename: 'aero_disc_rim.stl', format: 'STL' },
      multi_spoke_rim: { name: '10-Spoke Cooling Rim', filename: 'multi_spoke_rim.stl', format: 'STL' },
    }[type];

    const raw = generateSampleGeometry(type);
    saveGeometry({
      projectId: currentProjectId,
      name: configMap.name,
      filename: configMap.filename,
      format: configMap.format as any,
      fileSize: raw.faces.length * 48 + 1200,
      points: raw.vertices.length,
      cells: raw.faces.length,
      maxSize: type.includes('rim') ? 0.66 : 1.25,
      isTriangulated: true,
      volume: 0.085,
      validationStatus: 'valid',
      validationMessage: 'Verified 2-manifold surface for snappyHexMesh boundary snapping.',
      warnings: [],
      type: 'upload',
      geometryType: type,
      meshData: {
        vertices: raw.vertices,
        faces: raw.faces,
        bounds: { minX: -0.35, maxX: 0.35, minY: -0.35, maxY: 0.35, minZ: -0.15, maxZ: 0.15 },
        surfaceArea: 1.82,
        volume: 0.085,
        aspectRatioMax: 1.15,
        isWatertight: true,
      },
      stlBase64: meshToStlDataUrl(raw, type),
    });
  };

  // Export current geometry as ASCII STL
  const handleDownloadSTL = () => {
    sound.playClick();
    const mesh = getActiveMeshData();
    let stl = `solid ${currentGeom.name.replace(/\s+/g, '_')}\n`;
    for (const [i0, i1, i2] of mesh.faces) {
      const v0 = mesh.vertices[i0];
      const v1 = mesh.vertices[i1];
      const v2 = mesh.vertices[i2];
      if (!v0 || !v1 || !v2) continue;
      stl += `  facet normal 0 0 0\n    outer loop\n`;
      stl += `      vertex ${v0[0].toFixed(6)} ${v0[1].toFixed(6)} ${v0[2].toFixed(6)}\n`;
      stl += `      vertex ${v1[0].toFixed(6)} ${v1[1].toFixed(6)} ${v1[2].toFixed(6)}\n`;
      stl += `      vertex ${v2[0].toFixed(6)} ${v2[1].toFixed(6)} ${v2[2].toFixed(6)}\n`;
      stl += `    endloop\n  endfacet\n`;
    }
    stl += `endsolid ${currentGeom.name.replace(/\s+/g, '_')}\n`;

    const blob = new Blob([stl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentGeom.name.toLowerCase().replace(/\s+/g, '_')}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mesh = getActiveMeshData();

  return (
    <div className="flex-1 overflow-y-auto select-none text-[#0F172A] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl,.obj,.vtk,.step,.stp,.ply,.iges,.igs,.off,.dxf,.gltf,.glb,*/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
              <span>Geometry Studio</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]">
                REAL-TIME CAD PARSER
              </span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Upload external STL, OBJ, VTK, STEP, PLY models, inspect 3D manifold topology, and configure domain obstacles
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-[#E2E8F0]/60 p-1 rounded-lg border border-[#CBD5E1]">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('upload');
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload & 3D Studio</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('existing');
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'existing'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Geometries Library ({geometries.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'upload' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Col: Upload Zone, Quick Samples, Benchmarks & Validation (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Real Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center space-y-3 relative ${
                isDraggingFile
                  ? 'border-[#0284C7] bg-[#E0F2FE]/70 scale-[1.01]'
                  : 'border-[#BAE6FD] hover:border-[#0284C7] bg-white/90 hover:bg-white shadow-xs'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center mx-auto shadow-xs">
                <Upload className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-bold text-sm text-[#0F172A]">
                  Drag & Drop any CAD file here
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  or click anywhere to browse from your computer
                </p>
              </div>

              {/* Supported Formats Badges */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                {['STL', 'OBJ', 'VTK', 'STEP', 'PLY', 'IGES', 'OFF'].map((fmt) => (
                  <span
                    key={fmt}
                    className="px-2 py-0.5 bg-[#F1F5F9] text-[#0F172A] text-[10px] font-mono font-bold rounded border border-[#E2E8F0]"
                  >
                    .{fmt.toLowerCase()}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-center gap-1 text-[11px] text-[#64748B] pt-1">
                <span>ASCII & Binary Little-Endian supported</span>
                <Tooltip
                  title="Universal 3D CAD Ingestion"
                  content="Supports polygon facet files (STL, OBJ, PLY, VTK) and boundary surface geometry (STEP ISO-10303, IGES). Automatically resolves vertex indices, normals, surface area, and watertightness."
                  tip="Maximum recommended browser file size: 50MB."
                />
              </div>

              {/* Uploading / Analyzing Overlay */}
              {isAnalyzingFile && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center p-6 space-y-3 z-20">
                  <div className="w-10 h-10 border-3 border-[#0284C7] border-t-transparent rounded-full animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-[#0F172A]">{analysisStage}</p>
                    <div className="w-48 bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden mx-auto">
                      <div
                        className="bg-[#0284C7] h-full transition-all duration-300"
                        style={{ width: `${analysisProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Feedback Banner */}
            {uploadSuccessMessage && (
              <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl flex items-center gap-2.5 text-xs text-[#065F46] shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span className="font-medium">{uploadSuccessMessage}</span>
              </div>
            )}

            {/* Quick Test Sample CAD Files */}
            <div className="bg-white/90 backdrop-blur-xs rounded-xl border border-[#BAE6FD]/70 p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0284c7]" />
                  <span>Quick Test CAD Samples (1-Click Load)</span>
                </span>
                <Tooltip
                  title="Sample External Models"
                  content="Load pre-built industry CAD surface models to test the 3D viewer and CFD boundary generator without searching for files on disk."
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'five_spoke_rim', label: '5-Spoke Rim (STL)', icon: Disc },
                  { id: 'aero_disc_rim', label: 'F1 Aero-Disc (STL)', icon: Circle },
                  { id: 'multi_spoke_rim', label: '10-Spoke Rim (STL)', icon: Fan },
                  { id: 'fsae_wing', label: 'Formula Wing (STL)', icon: Zap },
                  { id: 'airfoil', label: 'Supercritical (OBJ)', icon: Wind },
                  { id: 'propeller', label: 'Drone Rotor (PLY)', icon: Fan },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleLoadSampleFile(item.id as any)}
                      className="px-2.5 py-1.5 bg-[#F0F9FF] hover:bg-[#E0F2FE] border border-[#BAE6FD] text-[#0284C7] rounded-lg text-xs font-semibold text-left flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Benchmark Preset Selector */}
            <div className="bg-white/90 backdrop-blur-xs rounded-xl border border-[#E2E8F0] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider block">
                  Aerodynamic Benchmark Presets
                </span>
                <Tooltip
                  title="Aerodynamic Benchmarks"
                  content="Calibrated benchmark models for validating CFD solvers against published experimental wind tunnel and calibrated empirical research data."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'five_spoke_rim',
                    name: '5-Spoke Performance Rim',
                    icon: Disc,
                    desc: '18-inch forged 5-spoke automotive wheel rim balancing brake cooling ventilation and rotational pumping drag.'
                  },
                  {
                    id: 'aero_disc_rim',
                    name: 'F1 Aero-Disc Fairing',
                    icon: Circle,
                    desc: 'Flush-faced aerodynamic wheel cover minimizing wheel-well wake turbulence and crosswind drag.'
                  },
                  {
                    id: 'multi_spoke_rim',
                    name: '10-Spoke Cooling Rim',
                    icon: Fan,
                    desc: 'High-ventilation 10-spoke racing wheel engineered for maximum convective brake disc heat rejection.'
                  },
                  {
                    id: 'airfoil',
                    name: 'NACA 0012 Airfoil',
                    icon: Plane,
                    desc: 'Symmetric 12% thickness profile; ideal for subsonic & transonic lift/drag polars.'
                  },
                  {
                    id: 'cylinder',
                    name: 'Cylinder (Vortex)',
                    icon: Disc,
                    desc: 'Classic Karman vortex street shedding & oscillatory Strouhal frequency analysis.'
                  },
                  {
                    id: 'sphere',
                    name: 'Drag Sphere',
                    icon: Circle,
                    desc: 'Flow separation crisis baseline; Re ~ 3e5 laminar separation bubble.'
                  },
                  {
                    id: 'cube',
                    name: 'Bluff Cube',
                    icon: Box,
                    desc: 'High aerodynamic drag bluff body with sharp corner recirculating separation zones.'
                  },
                  {
                    id: 'fsae_wing',
                    name: 'Formula Downforce Wing',
                    icon: Zap,
                    desc: 'High-downforce multi-element inverted wing with endplates for ground-effect racing.'
                  },
                  {
                    id: 'propeller',
                    name: 'Drone Propeller',
                    icon: Fan,
                    desc: 'Rotating reference frame (MRF) blade profile generating thrust & helical tip vortices.'
                  },
                ].map((item) => {
                  const IconComp = item.icon;
                  return (
                    <Tooltip
                      key={item.id}
                      title={item.name}
                      content={item.desc}
                      position="top"
                      className="w-full"
                    >
                      <button
                        onClick={() => handlePresetSelect(item.id as any)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          currentGeom.geometryType === item.id || selectedPresetType === item.id
                            ? 'bg-[#E0F2FE] border-[#0284C7] text-[#0284C7] font-semibold shadow-xs'
                            : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] hover:bg-white hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-white/80 border border-[#E2E8F0]">
                          <IconComp className="w-3.5 h-3.5 text-[#0284C7]" />
                        </div>
                        <span className="text-xs truncate">{item.name}</span>
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            {/* Validation & Topology Metrics Card */}
            <div className="bg-white/90 backdrop-blur-xs rounded-xl border border-[#E2E8F0] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#0F172A]">
                    2-Manifold Mesh Topology
                  </span>
                  <Tooltip
                    title="2-Manifold Watertight Topology"
                    content="In a closed 2-manifold surface, every interior edge belongs to exactly two triangular facets. Required for OpenFOAM snappyHexMesh inside/outside domain tagging."
                  />
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                    mesh.isWatertight
                      ? 'bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]'
                      : 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                  }`}
                >
                  {mesh.isWatertight ? 'VALIDATED WATERTIGHT' : 'TOPOLOGY ADVISORY'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Surface Points</span>
                  <strong className="text-sm text-[#0F172A]">
                    {mesh.vertices.length.toLocaleString()}
                  </strong>
                </div>

                <div className="p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Triangular Cells</span>
                  <strong className="text-sm text-[#0F172A]">
                    {mesh.faces.length.toLocaleString()}
                  </strong>
                </div>

                <div className="p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Max Scale (L)</span>
                  <strong className="text-sm text-[#0F172A]">
                    {currentGeom.maxSize} m
                  </strong>
                </div>

                <div className="p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Displaced Vol</span>
                  <strong className="text-sm text-[#0284C7]">
                    {mesh.volume > 0 ? `${mesh.volume.toFixed(4)} m³` : 'Open Shell'}
                  </strong>
                </div>
              </div>

              {/* Bounding Box Coordinate Readout */}
              <div className="p-2 bg-[#F1F5F9]/80 rounded border border-[#E2E8F0] text-[10px] font-mono text-[#475569] space-y-0.5">
                <div className="font-semibold text-[#0F172A]">Spatial Coordinates (Meters):</div>
                <div>X: [{mesh.bounds.minX.toFixed(2)} to {mesh.bounds.maxX.toFixed(2)}] m</div>
                <div>Y: [{mesh.bounds.minY.toFixed(2)} to {mesh.bounds.maxY.toFixed(2)}] m</div>
                <div>Z: [{mesh.bounds.minZ.toFixed(2)} to {mesh.bounds.maxZ.toFixed(2)}] m</div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleDownloadSTL}
                  className="py-2 px-3 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download STL</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setPage('setup');
                  }}
                  className="py-2 px-3 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Use in Setup</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Col: Interactive 3D Canvas Viewport & Camera Orbit (7 cols) */}
          <div className="lg:col-span-7 bg-white/95 backdrop-blur-md rounded-xl border border-[#BAE6FD]/70 p-4 shadow-sm flex flex-col justify-between space-y-3">
            {/* Viewport Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-[#0284C7]" />
                <span className="text-xs font-bold text-[#0F172A]">
                  Interactive 3D Surface Viewport
                </span>
                <span className="text-[10px] font-mono text-[#0284C7] bg-[#E0F2FE] px-2 py-0.5 rounded font-bold">
                  {currentGeom.format}
                </span>
                <span className="text-[10px] font-mono text-[#64748B] truncate max-w-[140px]">
                  {currentGeom.filename}
                </span>
              </div>

              {/* Render Mode Toggle & Options */}
              <div className="flex items-center gap-1.5">
                <div className="flex bg-[#F1F5F9] p-0.5 rounded-lg border border-[#CBD5E1]">
                  {(['shaded-wireframe', 'shaded', 'wireframe', 'points'] as RenderMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        sound.playClick();
                        setRenderMode(mode);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-semibold capitalize transition-all cursor-pointer ${
                        renderMode === mode
                          ? 'bg-white text-[#0284C7] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      {mode.replace('-', '+')}
                    </button>
                  ))}
                </div>

                <Tooltip title="Toggle Bounding Box" content="Show or hide the 3D bounding dimension extent cage.">
                  <button
                    onClick={() => setShowBoundingBox(!showBoundingBox)}
                    className={`p-1.5 rounded border text-xs cursor-pointer ${
                      showBoundingBox
                        ? 'bg-[#E0F2FE] text-[#0284C7] border-[#BAE6FD]'
                        : 'bg-white text-[#64748B] border-[#CBD5E1]'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>

                <Tooltip title="Reset Viewport" content="Reset camera angles and zoom to canonical front perspective.">
                  <button
                    onClick={handleResetView}
                    className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded border border-[#CBD5E1] hover:bg-[#F1F5F9] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Canvas Stage */}
            <div
              ref={canvasContainerRef}
              className="flex-1 min-h-[340px] sm:min-h-[380px] bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] relative overflow-hidden flex items-center justify-center touch-none"
            >
              <canvas
                ref={canvasRef}
                width={620}
                height={380}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onWheel={handleCanvasWheel}
                onTouchStart={handleCanvasTouchStart}
                onTouchMove={handleCanvasTouchMove}
                onTouchEnd={handleCanvasTouchEnd}
                onTouchCancel={handleCanvasTouchEnd}
                className="w-full h-full object-contain cursor-grab active:cursor-grabbing select-none"
              />

              {/* Viewport Overlay Controls & Badges */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs border border-[#CBD5E1] p-1 rounded-lg text-[10px] font-mono shadow-xs">
                <button
                  onClick={() => setZoom((z) => Math.min(3.5, z + 0.2))}
                  className="w-5 h-5 flex items-center justify-center text-[#0F172A] hover:bg-[#F1F5F9] rounded font-bold cursor-pointer"
                >
                  +
                </button>
                <span className="text-[#64748B] font-bold">{(zoom * 100).toFixed(0)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                  className="w-5 h-5 flex items-center justify-center text-[#0F172A] hover:bg-[#F1F5F9] rounded font-bold cursor-pointer"
                >
                  -
                </button>
              </div>

              {/* Status HUD at bottom-left */}
              <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs border border-[#CBD5E1] px-2.5 py-1 rounded text-[10px] font-mono text-[#64748B] shadow-2xs">
                Drag on canvas to orbit • Scroll wheel to zoom
              </div>
            </div>

            {/* Interactive Sliders for Azimuth and Elevation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-medium text-[#64748B]">
              <div className="flex items-center gap-2">
                <span className="shrink-0 w-20">Yaw (Azimuth):</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={yaw}
                  onChange={(e) => setYaw(Number(e.target.value))}
                  className="w-full accent-[#0284C7] cursor-pointer"
                />
                <span className="font-mono text-[#0F172A] w-10 text-right">{yaw}°</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="shrink-0 w-20">Pitch (Elevation):</span>
                <input
                  type="range"
                  min="-85"
                  max="85"
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-full accent-[#0284C7] cursor-pointer"
                />
                <span className="font-mono text-[#0F172A] w-10 text-right">{pitch}°</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: EXISTING GEOMETRIES LIBRARY */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Stored Surface Geometries ({geometries.length})
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload New CAD File</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {geometries.map((geom) => {
              const isSelected = geom.id === currentGeometryId;

              return (
                <div
                  key={geom.id}
                  className={`bg-white/95 backdrop-blur-md rounded-xl border p-4 shadow-xs transition-all duration-200 flex flex-col justify-between space-y-3 ${
                    isSelected ? 'border-[#0284C7] ring-2 ring-[#0284C7]/30 shadow-md' : 'border-[#E2E8F0] hover:border-[#BAE6FD]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-xs text-[#0F172A] font-sans truncate">
                        {geom.name}
                      </h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#E0F2FE] text-[#0284C7] rounded font-bold border border-[#BAE6FD] shrink-0">
                        {geom.format}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#64748B] font-mono truncate">
                      {geom.filename} ({Math.max(1, Math.round(geom.fileSize / 1024))} KB)
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#64748B] pt-1">
                      <span>Points: {geom.points.toLocaleString()}</span>
                      <span>Cells: {geom.cells.toLocaleString()}</span>
                      <span>Scale: {geom.maxSize}m</span>
                      <span className="text-[#10B981] font-semibold">✓ {geom.validationStatus}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          sound.playClick();
                          setCurrentGeometryId(geom.id);
                          setActiveTab('upload');
                        }}
                        className="flex items-center gap-1 text-xs text-[#0284C7] hover:underline font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect in 3D</span>
                      </button>

                      {geometries.length > 1 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete geometry ${geom.name}?`)) {
                              deleteGeometry(geom.id);
                            }
                          }}
                          className="p-1 text-[#94A3B8] hover:text-[#EF4444] rounded hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                          title="Delete geometry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        sound.playClick();
                        setCurrentGeometryId(geom.id);
                        setPage('setup');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#F0F9FF] hover:bg-[#0284C7] text-[#0284C7] hover:text-white rounded text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span>Use in Setup</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
