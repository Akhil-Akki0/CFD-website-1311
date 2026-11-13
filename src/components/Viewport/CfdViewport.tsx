import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  AirfoilPresetId,
  ScalarFieldType,
  ProbePoint,
  SimulationState
} from '../../types';
import {
  getAirfoilGeometry,
  computeFieldPoint,
  AIRFOIL_PRESETS
} from '../../utils/airfoilPhysics';
import { ViewportHud } from './ViewportHud';
import { ScalarColorbar, SCALAR_METADATA } from './ScalarColorbar';
import { OrientationTriad } from './OrientationTriad';

interface CfdViewportProps {
  activePresetId: AirfoilPresetId;
  simulationState: SimulationState;
  scalarType: ScalarFieldType;
  onScalarTypeChange: (type: ScalarFieldType) => void;
  probes: ProbePoint[];
  selectedProbeId: string | null;
  onSelectProbe: (id: string) => void;
  onUpdateProbePosition: (id: string, x: number, y: number) => void;
  onAddProbeAtCoords: (x: number, y: number) => void;
}

interface Particle {
  x: number; // domain coords
  y: number;
  life: number;
  maxLife: number;
  speed: number;
  history: [number, number][];
}

export const CfdViewport: React.FC<CfdViewportProps> = ({
  activePresetId,
  simulationState,
  scalarType,
  onScalarTypeChange,
  probes,
  selectedProbeId,
  onSelectProbe,
  onUpdateProbePosition,
  onAddProbeAtCoords,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Display toggles
  const [showContours, setShowContours] = useState(true);
  const [showStreamlines, setShowStreamlines] = useState(true);
  const [showMesh, setShowMesh] = useState(false);
  const [showVectors, setShowVectors] = useState(false);
  const [showShockLine, setShowShockLine] = useState(true);
  const [showProbes, setShowProbes] = useState(true);
  const [streamlineSpeed, setStreamlineSpeed] = useState(1.0);

  // Hovered probe state for floating tooltip
  const [hoveredProbe, setHoveredProbe] = useState<ProbePoint | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null);

  // Camera Pan & Zoom state in domain units
  // Center is initially at chord center (x = 0.5, y = 0.0)
  const [camera, setCamera] = useState({
    centerX: 0.5,
    centerY: 0.0,
    zoom: 320, // pixels per chord unit
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cameraStartRef = useRef({ centerX: 0.5, centerY: 0.0 });
  const draggedProbeIdRef = useRef<string | null>(null);

  // Streamline particles pool
  const particlesRef = useRef<Particle[]>([]);

  // Initialize or replenish particles
  const initParticles = useCallback((count = 140) => {
    const list: Particle[] = [];
    for (let i = 0; i < count; i++) {
      list.push({
        x: -1.2 + Math.random() * 0.4,
        y: -0.65 + Math.random() * 1.3,
        life: Math.random() * 100,
        maxLife: 80 + Math.random() * 70,
        speed: 0.8 + Math.random() * 0.4,
        history: [],
      });
    }
    particlesRef.current = list;
  }, []);

  useEffect(() => {
    initParticles(140);
  }, [initParticles, activePresetId]);

  // Transform helpers: Domain <-> Screen Canvas Pixels
  const domainToScreen = useCallback(
    (dx: number, dy: number, width: number, height: number) => {
      const sx = width / 2 + (dx - camera.centerX) * camera.zoom;
      const sy = height / 2 - (dy - camera.centerY) * camera.zoom;
      return { sx, sy };
    },
    [camera]
  );

  const screenToDomain = useCallback(
    (sx: number, sy: number, width: number, height: number) => {
      const dx = (sx - width / 2) / camera.zoom + camera.centerX;
      const dy = -(sy - height / 2) / camera.zoom + camera.centerY;
      return { dx, dy };
    },
    [camera]
  );

  // Camera presets
  const handleSetCameraPreset = (preset: 'chord' | 'le' | 'shock' | 'wake' | 'farfield') => {
    switch (preset) {
      case 'chord':
        setCamera({ centerX: 0.5, centerY: 0.0, zoom: 340 });
        break;
      case 'le':
        setCamera({ centerX: 0.05, centerY: 0.05, zoom: 700 });
        break;
      case 'shock':
        setCamera({ centerX: 0.6, centerY: 0.12, zoom: 600 });
        break;
      case 'wake':
        setCamera({ centerX: 1.15, centerY: 0.0, zoom: 450 });
        break;
      case 'farfield':
        setCamera({ centerX: 0.5, centerY: 0.0, zoom: 180 });
        break;
    }
  };

  const handleResetCamera = () => {
    setCamera({ centerX: 0.5, centerY: 0.0, zoom: 320 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(80, Math.min(1500, camera.zoom * zoomFactor));

    // Keep point under mouse fixed in domain coordinates
    const domainBefore = screenToDomain(mouseX, mouseY, rect.width, rect.height);
    const newCenterX = domainBefore.dx - (mouseX - rect.width / 2) / newZoom;
    const newCenterY = domainBefore.dy + (mouseY - rect.height / 2) / newZoom;

    setCamera({
      centerX: newCenterX,
      centerY: newCenterY,
      zoom: newZoom,
    });
  };

  // Mouse drag pan & probe interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check if clicked near an existing probe
    for (const p of probes) {
      const { sx, sy } = domainToScreen(p.x, p.y, rect.width, rect.height);
      const dist = Math.hypot(sx - mouseX, sy - mouseY);
      if (dist < 14) {
        onSelectProbe(p.id);
        draggedProbeIdRef.current = p.id;
        return;
      }
    }

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    cameraStartRef.current = { centerX: camera.centerX, centerY: camera.centerY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dom = screenToDomain(mouseX, mouseY, rect.width, rect.height);
    setCursorCoords({ x: dom.dx, y: dom.dy });

    // Dragging a probe
    if (draggedProbeIdRef.current) {
      onUpdateProbePosition(draggedProbeIdRef.current, Number(dom.dx.toFixed(3)), Number(dom.dy.toFixed(3)));
      return;
    }

    // Pan camera
    if (isDraggingRef.current) {
      const dx = (e.clientX - dragStartRef.current.x) / camera.zoom;
      const dy = (e.clientY - dragStartRef.current.y) / camera.zoom;
      setCamera({
        centerX: cameraStartRef.current.centerX - dx,
        centerY: cameraStartRef.current.centerY + dy,
        zoom: camera.zoom,
      });
      return;
    }

    // Check probe hover
    let foundHover: ProbePoint | null = null;
    for (const p of probes) {
      const { sx, sy } = domainToScreen(p.x, p.y, rect.width, rect.height);
      const dist = Math.hypot(sx - mouseX, sy - mouseY);
      if (dist < 14) {
        foundHover = p;
        break;
      }
    }
    setHoveredProbe(foundHover);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    draggedProbeIdRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canvasRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    for (const p of probes) {
      const { sx, sy } = domainToScreen(p.x, p.y, rect.width, rect.height);
      const dist = Math.hypot(sx - mouseX, sy - mouseY);
      if (dist < 24) {
        onSelectProbe(p.id);
        draggedProbeIdRef.current = p.id;
        return;
      }
    }

    isDraggingRef.current = true;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    cameraStartRef.current = { centerX: camera.centerX, centerY: camera.centerY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canvasRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    const dom = screenToDomain(mouseX, mouseY, rect.width, rect.height);
    setCursorCoords({ x: dom.dx, y: dom.dy });

    if (draggedProbeIdRef.current) {
      onUpdateProbePosition(draggedProbeIdRef.current, Number(dom.dx.toFixed(3)), Number(dom.dy.toFixed(3)));
      return;
    }

    if (isDraggingRef.current) {
      const dx = (touch.clientX - dragStartRef.current.x) / camera.zoom;
      const dy = (touch.clientY - dragStartRef.current.y) / camera.zoom;
      setCamera((prev) => ({
        centerX: cameraStartRef.current.centerX - dx,
        centerY: cameraStartRef.current.centerY + dy,
        zoom: prev.zoom,
      }));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    draggedProbeIdRef.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const dom = screenToDomain(mouseX, mouseY, rect.width, rect.height);
    onAddProbeAtCoords(Number(dom.dx.toFixed(2)), Number(dom.dy.toFixed(2)));
  };

  // Main 60 FPS Render Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { upper, lower } = getAirfoilGeometry(activePresetId, 90);

    let lastRenderTime = 0;
    const FRAME_INTERVAL = 1000 / 60; // Smooth 60 FPS target

    const render = (currentTime: number = 0) => {
      animationFrameId = requestAnimationFrame(render);

      // 1. Zero lag optimization: Pause canvas drawing if tab is in background
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      // 2. 60 FPS Throttle: prevent runaway redraws and GPU heat on high refresh displays
      if (currentTime - lastRenderTime < FRAME_INTERVAL - 2) {
        return;
      }
      lastRenderTime = currentTime;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background to clinical aerodynamic canvas (#F8FAFC)
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, width, height);

      // 2. Background Grid lines & Coordinate rulers
      const gridStep = 0.2; // in chord units
      const minX = screenToDomain(0, height, width, height).dx;
      const maxX = screenToDomain(width, 0, width, height).dx;
      const minY = screenToDomain(0, height, width, height).dy;
      const maxY = screenToDomain(width, 0, width, height).dy;

      const startGridX = Math.floor(minX / gridStep) * gridStep;
      const endGridX = Math.ceil(maxX / gridStep) * gridStep;
      const startGridY = Math.floor(minY / gridStep) * gridStep;
      const endGridY = Math.ceil(maxY / gridStep) * gridStep;

      ctx.lineWidth = 1;
      ctx.strokeStyle = '#EDF2F7';
      ctx.beginPath();
      for (let gx = startGridX; gx <= endGridX; gx += gridStep) {
        const { sx } = domainToScreen(gx, 0, width, height);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
      for (let gy = startGridY; gy <= endGridY; gy += gridStep) {
        const { sy } = domainToScreen(0, gy, width, height);
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
      ctx.stroke();

      // Axis zero hairlines
      const origin = domainToScreen(0, 0, width, height);
      ctx.strokeStyle = '#CBD5E1';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(origin.sx, 0);
      ctx.lineTo(origin.sx, height);
      ctx.moveTo(0, origin.sy);
      ctx.lineTo(width, origin.sy);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Scalar Field Contours (Heatmap)
      if (showContours) {
        const cellCols = 68;
        const cellRows = 42;
        const colW = width / cellCols;
        const rowH = height / cellRows;
        const scalarMeta = SCALAR_METADATA[scalarType](simulationState.mach);

        for (let r = 0; r < cellRows; r++) {
          const sy = (r + 0.5) * rowH;
          for (let c = 0; c < cellCols; c++) {
            const sx = (c + 0.5) * colW;
            const dom = screenToDomain(sx, sy, width, height);

            const field = computeFieldPoint(
              dom.dx,
              dom.dy,
              activePresetId,
              simulationState.mach,
              simulationState.aoa
            );

            let val = 0;
            if (scalarType === 'pressure_cp') val = field.cp;
            else if (scalarType === 'mach') val = field.mach;
            else if (scalarType === 'velocity_u') val = field.normVelocity * simulationState.mach * 340;
            else if (scalarType === 'vorticity') val = field.vorticity;
            else if (scalarType === 'turbulent_ke') val = field.tke;
            else if (scalarType === 'temperature') val = field.temperature;

            // Normalize between 0 and 1
            const norm = Math.max(0, Math.min(1, (val - scalarMeta.min) / (scalarMeta.max - scalarMeta.min || 1)));

            // High-grade scientific colormap colors
            let rC = 37, gC = 99, bC = 235; // Cobalt default
            let alpha = 0.28;

            if (scalarType === 'pressure_cp') {
              // Coolwarm: Suction peak (Deep Blue) -> Neutral Cyan/White -> Stagnation (Orange/Red)
              if (norm < 0.4) {
                // Low Cp (suction)
                const t = norm / 0.4;
                rC = Math.round(37 + t * 50);
                gC = Math.round(99 + t * 120);
                bC = Math.round(235 - t * 30);
                alpha = 0.35;
              } else if (norm < 0.7) {
                // Mid range
                const t = (norm - 0.4) / 0.3;
                rC = Math.round(87 + t * 140);
                gC = Math.round(219 + t * 10);
                bC = Math.round(205 - t * 120);
                alpha = 0.25;
              } else {
                // High Cp (stagnation)
                const t = (norm - 0.7) / 0.3;
                rC = Math.round(227 + t * 28);
                gC = Math.round(229 - t * 160);
                bC = Math.round(85 - t * 60);
                alpha = 0.4;
              }
            } else if (scalarType === 'mach') {
              // Mach: Subsonic blue/cyan -> Transonic green/yellow -> Supersonic red (>1.0)
              if (val < 0.8) {
                rC = 14; gC = 116; bC = 230; alpha = 0.25;
              } else if (val < 1.0) {
                rC = 16; gC = 185; bC = 129; alpha = 0.35;
              } else if (val < 1.25) {
                rC = 245; gC = 158; bC = 11; alpha = 0.45;
              } else {
                rC = 239; gC = 68; bC = 68; alpha = 0.55;
              }
            } else {
              // Spectral
              const hue = (1 - norm) * 240; // 240 is blue, 0 is red
              rC = Math.round(Math.sin((hue * Math.PI) / 180) * 127 + 128);
              gC = Math.round(Math.sin(((hue + 120) * Math.PI) / 180) * 127 + 128);
              bC = Math.round(Math.sin(((hue + 240) * Math.PI) / 180) * 127 + 128);
              alpha = 0.26;
            }

            ctx.fillStyle = `rgba(${rC}, ${gC}, ${bC}, ${alpha})`;
            ctx.fillRect(c * colW, r * rowH, colW + 1, rowH + 1);
          }
        }
      }

      // 4. CFD Mesh Wireframe
      if (showMesh) {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.22)';
        ctx.lineWidth = 0.8;

        // Draw 8 concentric prism inflation loops wrapping the aerofoil
        for (let ring = 1; ring <= 8; ring++) {
          const offset = 0.006 * Math.pow(1.22, ring);
          ctx.beginPath();
          // Upper offset
          for (let i = 0; i < upper.length; i += 2) {
            const [x, y] = upper[i];
            const p = domainToScreen(x, y + offset, width, height);
            if (i === 0) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
          }
          // Lower offset
          for (let i = lower.length - 1; i >= 0; i -= 2) {
            const [x, y] = lower[i];
            const p = domainToScreen(x, y - offset, width, height);
            ctx.lineTo(p.sx, p.sy);
          }
          ctx.closePath();
          ctx.stroke();
        }

        // Radial mesh rays along surface
        for (let i = 0; i < upper.length; i += 6) {
          const [x, yu] = upper[i];
          const [, yl] = lower[i];
          const innerU = domainToScreen(x, yu, width, height);
          const outerU = domainToScreen(x, yu + 0.08, width, height);
          ctx.beginPath();
          ctx.moveTo(innerU.sx, innerU.sy);
          ctx.lineTo(outerU.sx, outerU.sy);
          ctx.stroke();

          const innerL = domainToScreen(x, yl, width, height);
          const outerL = domainToScreen(x, yl - 0.08, width, height);
          ctx.beginPath();
          ctx.moveTo(innerL.sx, innerL.sy);
          ctx.lineTo(outerL.sx, outerL.sy);
          ctx.stroke();
        }
      }

      // 5. Velocity Vectors (Quiver plot)
      if (showVectors) {
        const vCols = 24;
        const vRows = 16;
        for (let vr = 0; vr < vRows; vr++) {
          const sy = (vr + 0.5) * (height / vRows);
          for (let vc = 0; vc < vCols; vc++) {
            const sx = (vc + 0.5) * (width / vCols);
            const dom = screenToDomain(sx, sy, width, height);

            // Skip inside airfoil
            if (dom.dx > 0 && dom.dx < 1 && Math.abs(dom.dy) < 0.08) continue;

            const field = computeFieldPoint(
              dom.dx,
              dom.dy,
              activePresetId,
              simulationState.mach,
              simulationState.aoa
            );

            const vecLen = 14 * Math.min(1.8, field.normVelocity);
            const angle = Math.atan2(-field.v, field.u);
            const endX = sx + vecLen * Math.cos(angle);
            const endY = sy + vecLen * Math.sin(angle);

            ctx.strokeStyle = '#2563EB';
            ctx.fillStyle = '#2563EB';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.arc(endX, endY, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 6. Transonic Shock Wave Line & Density Gradient
      if (showShockLine && simulationState.mach >= 0.72) {
        const shockX = activePresetId === 'rae2822' ? 0.65 : 0.54;
        const shockBase = domainToScreen(shockX, 0.04, width, height);
        const shockTop = domainToScreen(shockX - 0.02, 0.32, width, height);

        // Normal shock line
        const grad = ctx.createLinearGradient(shockBase.sx, shockBase.sy, shockTop.sx, shockTop.sy);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
        grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.65)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(shockBase.sx, shockBase.sy);
        ctx.quadraticCurveTo(shockBase.sx + 8, (shockBase.sy + shockTop.sy) / 2, shockTop.sx, shockTop.sy);
        ctx.stroke();

        // Shock foot label
        ctx.font = '9px JetBrains Mono';
        ctx.fillStyle = '#EF4444';
        ctx.fillText('SHOCK FOOT M>1', shockTop.sx - 35, shockTop.sy - 6);
      }

      // 7. Animated Fluid Streamlines & Particles
      if (showStreamlines) {
        const speedMult = (simulationState.isRunning ? 1.0 : 0.25) * streamlineSpeed;
        const dt = 0.015 * speedMult;

        particlesRef.current.forEach((p) => {
          // Advance particle position
          const field = computeFieldPoint(
            p.x,
            p.y,
            activePresetId,
            simulationState.mach,
            simulationState.aoa
          );

          // Update position using local velocity field
          p.x += field.normVelocity * dt * 1.5;
          p.y += (field.v / (field.u || 1)) * dt * 1.5;
          p.life += 1;

          // Record history for smooth trace ribbon
          const screenPos = domainToScreen(p.x, p.y, width, height);
          p.history.push([screenPos.sx, screenPos.sy]);
          if (p.history.length > 8) p.history.shift();

          // Reset when out of domain or expired
          if (p.x > 2.2 || Math.abs(p.y) > 1.2 || p.life > p.maxLife) {
            p.x = -1.2 - Math.random() * 0.3;
            p.y = -0.65 + Math.random() * 1.3;
            p.life = 0;
            p.history = [];
          }

          // Draw streamline particle trail
          if (p.history.length > 2) {
            ctx.beginPath();
            ctx.moveTo(p.history[0][0], p.history[0][1]);
            for (let i = 1; i < p.history.length; i++) {
              ctx.lineTo(p.history[i][0], p.history[i][1]);
            }
            // Color based on speed
            const isAccelerated = field.normVelocity > 1.15;
            ctx.strokeStyle = isAccelerated
              ? 'rgba(6, 182, 212, 0.75)'
              : 'rgba(37, 99, 235, 0.65)';
            ctx.lineWidth = isAccelerated ? 1.5 : 1.0;
            ctx.stroke();

            // Head glow dot
            const head = p.history[p.history.length - 1];
            ctx.fillStyle = isAccelerated ? '#57DFFE' : '#2563EB';
            ctx.beginPath();
            ctx.arc(head[0], head[1], 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // 8. Solid Aerofoil Geometry (High-Precision Contour)
      ctx.beginPath();
      // Upper curve
      for (let i = 0; i < upper.length; i++) {
        const [x, y] = upper[i];
        const { sx, sy } = domainToScreen(x, y, width, height);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      // Lower curve (reverse)
      for (let i = lower.length - 1; i >= 0; i--) {
        const [x, y] = lower[i];
        const { sx, sy } = domainToScreen(x, y, width, height);
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();

      // Clinical dark aerofoil body
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Quarter-chord c/4 reference marker
      const qc = domainToScreen(0.25, 0.0, width, height);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(qc.sx, qc.sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '9px JetBrains Mono';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('c/4', qc.sx + 4, qc.sy + 3);

      // 9. Interactive Sensor Probes
      if (showProbes) {
        probes.forEach((p) => {
          const { sx, sy } = domainToScreen(p.x, p.y, width, height);
          const isSelected = selectedProbeId === p.id;
          const isHovered = hoveredProbe?.id === p.id;

          // Outer pulsing ring for selected
          if (isSelected) {
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(sx, sy, 11, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Crosshair target
          ctx.strokeStyle = isSelected ? '#2563EB' : isHovered ? '#EF4444' : '#0F172A';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sx - 7, sy);
          ctx.lineTo(sx + 7, sy);
          ctx.moveTo(sx, sy - 7);
          ctx.lineTo(sx, sy + 7);
          ctx.stroke();

          // Center dot
          ctx.fillStyle = isSelected ? '#2563EB' : '#EF4444';
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();

          // Label
          ctx.font = 'bold 9px JetBrains Mono';
          ctx.fillStyle = '#0F172A';
          ctx.fillText(p.name, sx + 9, sy - 4);
        });
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    activePresetId,
    simulationState,
    scalarType,
    showContours,
    showStreamlines,
    showMesh,
    showVectors,
    showShockLine,
    showProbes,
    streamlineSpeed,
    camera,
    probes,
    selectedProbeId,
    hoveredProbe,
    domainToScreen,
    screenToDomain,
  ]);

  // Handle canvas sizing with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      if (!canvasRef.current || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = rect.height * dpr;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full bg-[#F8FAFC] overflow-hidden select-none cursor-crosshair touch-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* Floating HUD Toolbars */}
      <ViewportHud
        scalarType={scalarType}
        onScalarTypeChange={onScalarTypeChange}
        showContours={showContours}
        onToggleContours={() => setShowContours((v) => !v)}
        showStreamlines={showStreamlines}
        onToggleStreamlines={() => setShowStreamlines((v) => !v)}
        showMesh={showMesh}
        onToggleMesh={() => setShowMesh((v) => !v)}
        showVectors={showVectors}
        onToggleVectors={() => setShowVectors((v) => !v)}
        showShockLine={showShockLine}
        onToggleShockLine={() => setShowShockLine((v) => !v)}
        showProbes={showProbes}
        onToggleProbes={() => setShowProbes((v) => !v)}
        onResetCamera={handleResetCamera}
        onSetCameraPreset={handleSetCameraPreset}
        streamlineSpeed={streamlineSpeed}
        onStreamlineSpeedChange={setStreamlineSpeed}
      />

      {/* Precision Vertical Scalar Colorbar Legend */}
      <ScalarColorbar scalarType={scalarType} mach={simulationState.mach} />

      {/* Orientation Triad and Euler Angles */}
      <OrientationTriad aoa={simulationState.aoa} scaleMeters={AIRFOIL_PRESETS[activePresetId].chord} />

      {/* Viewport Branding & Coordinate Readout (Bottom Right) */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md border border-[#BAE6FD] rounded-xl px-3 py-1 font-mono text-[10px] text-[#475569] shadow-xs select-none">
        <img src="/logo.png" alt="CFD Platform" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
        <span className="font-bold text-[#0369A1]">CFD ENGINE</span>
        <span className="text-[#BAE6FD]">|</span>
        {cursorCoords ? (
          <span>
            X/c: <strong className="text-[#0F172A]">{cursorCoords.x.toFixed(3)}</strong> | Y/c:{' '}
            <strong className="text-[#0F172A]">{cursorCoords.y.toFixed(3)}</strong>
          </span>
        ) : (
          <span className="text-[#0284C7] font-semibold">60 FPS Navier-Stokes</span>
        )}
      </div>

      {/* Hovered / Selected Probe Live Float Card */}
      {hoveredProbe && (
        <div
          className="absolute z-30 bg-white/95 backdrop-blur-md border border-[#2563EB] rounded-md p-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.12)] font-mono text-[10px] pointer-events-none"
          style={{
            left: Math.min(
              window.innerWidth - 300,
              (containerRef.current?.getBoundingClientRect().width || 600) / 2 +
                (hoveredProbe.x - camera.centerX) * camera.zoom +
                16
            ),
            top: Math.max(
              60,
              (containerRef.current?.getBoundingClientRect().height || 400) / 2 -
                (hoveredProbe.y - camera.centerY) * camera.zoom -
                30
            ),
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-1 mb-1.5 font-sans">
            <span className="font-bold text-[#0F172A] text-xs">{hoveredProbe.name}</span>
            <span className="px-1 py-0.2 bg-[#EFF6FF] text-[#2563EB] rounded text-[9px] font-mono">
              PROBE
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[#475569]">
            <div>
              <span className="text-[#94A3B8]">X/c, Y/c:</span>{' '}
              <span className="text-[#0F172A]">
                {hoveredProbe.x.toFixed(2)}, {hoveredProbe.y.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[#94A3B8]">Mach:</span>{' '}
              <span className="text-[#2563EB] font-bold">{hoveredProbe.mach.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-[#94A3B8]">Cp:</span>{' '}
              <span className="text-[#0F172A] font-bold">{hoveredProbe.cp.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-[#94A3B8]">|U|:</span>{' '}
              <span className="text-[#0F172A]">
                {Math.hypot(hoveredProbe.u, hoveredProbe.v).toFixed(1)} m/s
              </span>
            </div>
            <div>
              <span className="text-[#94A3B8]">P:</span>{' '}
              <span className="text-[#0F172A]">{(hoveredProbe.p / 1000).toFixed(1)} kPa</span>
            </div>
            <div>
              <span className="text-[#94A3B8]">T:</span>{' '}
              <span className="text-[#0F172A]">{hoveredProbe.t.toFixed(1)} K</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
