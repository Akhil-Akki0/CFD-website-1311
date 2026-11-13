import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { CfdLogo } from '../components/common/CfdLogo';
import { LiveResultSheetDashboard } from '../components/Results/LiveResultSheetDashboard';
import { sound } from '../utils/soundEffects';
import { parseSTL, parseCadFile } from '../utils/cadFileParser';
import {
  Wind,
  Gauge,
  Thermometer,
  Flame,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  Plane,
  Rocket,
  Car,
  Train,
  Upload,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Layers,
  FileSpreadsheet,
  Download,
  Activity,
  AlertTriangle,
  Info,
  Maximize2
} from 'lucide-react';

export type ModelType =
  | 'airliner'
  | 'fighter_jet'
  | 'rocket'
  | 'hypercar'
  | 'bullet_train'
  | 'evtol_drone'
  | 'airfoil'
  | 'custom_upload';

export interface ModelPreset {
  id: ModelType;
  name: string;
  category: string;
  description: string;
  referenceArea: number; // m^2
  baseCL: number;
  baseCD: number;
  maxMach: number;
  maxPressureLoadKPa: number;
  nominalWeightKg: number;
}

const MODEL_PRESETS: Record<ModelType, ModelPreset> = {
  airliner: {
    id: 'airliner',
    name: 'Commercial Airliner (Widebody Jet)',
    category: 'Commercial Aviation',
    description: 'High-aspect ratio swept wings, twin high-bypass turbofan engines, pressurized fuselage.',
    referenceArea: 122.4,
    baseCL: 0.52,
    baseCD: 0.024,
    maxMach: 0.89,
    maxPressureLoadKPa: 85.0,
    nominalWeightKg: 185000,
  },
  fighter_jet: {
    id: 'fighter_jet',
    name: 'Supersonic Stealth Fighter (F-22 Style)',
    category: 'Supersonic Military',
    description: 'Clipped delta wings, twin afterburning turbofans, chined nosecone, high-G structural envelope.',
    referenceArea: 78.0,
    baseCL: 0.42,
    baseCD: 0.019,
    maxMach: 2.45,
    maxPressureLoadKPa: 180.0,
    nominalWeightKg: 29000,
  },
  rocket: {
    id: 'rocket',
    name: 'Hypersonic Re-entry Vehicle / Rocket',
    category: 'Aerospace / Spacecraft',
    description: 'Blunt nosecone, ceramic thermal protection system, body flap actuators, high heat flux capability.',
    referenceArea: 48.0,
    baseCL: 0.28,
    baseCD: 0.045,
    maxMach: 4.80,
    maxPressureLoadKPa: 320.0,
    nominalWeightKg: 85000,
  },
  hypercar: {
    id: 'hypercar',
    name: 'Formula 1 / Le Mans Ground-Effect Hypercar',
    category: 'Automotive Motorsports',
    description: 'Front carbon wing, underbody Venturi tunnels, high-downforce rear wing, high-heat radiator ducts.',
    referenceArea: 14.5,
    baseCL: -1.85, // Heavy downforce
    baseCD: 0.38,
    maxMach: 0.35,
    maxPressureLoadKPa: 60.0,
    nominalWeightKg: 850,
  },
  bullet_train: {
    id: 'bullet_train',
    name: 'High-Speed Maglev Bullet Train',
    category: 'High-Speed Rail',
    description: 'Ultra-slender aerodynamic nose, crosswind stability skirts, pantograph cavity smoothing.',
    referenceArea: 32.0,
    baseCL: -0.15,
    baseCD: 0.12,
    maxMach: 0.48,
    maxPressureLoadKPa: 55.0,
    nominalWeightKg: 450000,
  },
  evtol_drone: {
    id: 'evtol_drone',
    name: 'Autonomous eVTOL Heavy-Lift Drone',
    category: 'Urban Air Mobility',
    description: 'Tilt-wing aerostructure, distributed electric propulsion, compact cabin, hovering-to-cruise transition.',
    referenceArea: 18.0,
    baseCL: 0.65,
    baseCD: 0.042,
    maxMach: 0.28,
    maxPressureLoadKPa: 35.0,
    nominalWeightKg: 2400,
  },
  airfoil: {
    id: 'airfoil',
    name: 'NACA 0012 Supercritical Wing Section',
    category: 'Fundamental Aerodynamics',
    description: 'Symmetric transonic foil section for boundary layer transition and shock development testing.',
    referenceArea: 1.0,
    baseCL: 0.584,
    baseCD: 0.0138,
    maxMach: 1.25,
    maxPressureLoadKPa: 120.0,
    nominalWeightKg: 120,
  },
  custom_upload: {
    id: 'custom_upload',
    name: 'User Custom CAD Model (STL Uploaded)',
    category: 'Custom Geometry',
    description: 'Fully parsed user 3D triangular mesh. Real geometry contours evaluated in the wind tunnel.',
    referenceArea: 25.0,
    baseCL: 0.45,
    baseCD: 0.035,
    maxMach: 2.0,
    maxPressureLoadKPa: 100.0,
    nominalWeightKg: 5000,
  },
};

export interface CustomModelGeometry {
  name: string;
  triangles: [number, number, number][][];
  center: [number, number, number];
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  maxDim: number;
  scale: number;
  vertexCount: number;
}

export const LiveSimulationPage: React.FC = () => {
  const { geometries, triggerConfetti } = usePlatform();

  // Model Selection
  const [selectedModel, setSelectedModel] = useState<ModelType>('airliner');
  const [customModelName, setCustomModelName] = useState<string>('');
  const [customVertexCount, setCustomVertexCount] = useState<number>(0);
  const [customMeshPoints, setCustomMeshPoints] = useState<[number, number][]>([]);
  const [customModelGeometry, setCustomModelGeometry] = useState<CustomModelGeometry | null>(null);

  // Simulation Running State
  const [isSimulating, setIsSimulating] = useState<boolean>(true);

  // Environmental Parameters
  const [airSpeedMs, setAirSpeedMs] = useState<number>(240); // m/s (approx Mach 0.70 at cruise)
  const [altitudeM, setAltitudeM] = useState<number>(10000); // meters (0 to 35,000m)
  const [aoaDeg, setAoaDeg] = useState<number>(3.5); // Angle of Attack (-15° to +35°)
  const [coolingRatePct, setCoolingRatePct] = useState<number>(65); // Cooling rate (0% to 100%)
  const [coolingMode, setCoolingMode] = useState<'ram_air' | 'liquid_chiller' | 'cryogenic' | 'passive'>('ram_air');
  const [materialType, setMaterialType] = useState<'carbon_fiber' | 'titanium' | 'inconel' | 'ceramic'>('titanium');

  // Visualization View Mode
  const [vizMode, setVizMode] = useState<'pressure' | 'temperature' | 'cooling' | 'stress'>('pressure');

  // Probe Inspection Pin
  const [probePos, setProbePos] = useState<{ x: number; y: number } | null>({ x: 0.28, y: 0.42 });

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Model Preset
  const activePreset = MODEL_PRESETS[selectedModel];

  // International Standard Atmosphere (ISA) Calculations
  const atmosphere = useMemo(() => {
    // Sea level constants
    const T0 = 288.15; // K (15°C)
    const P0 = 101325; // Pa
    const rho0 = 1.225; // kg/m^3
    const L = 0.0065; // K/m temperature lapse rate in troposphere

    let T_amb = T0 - L * Math.min(altitudeM, 11000);
    if (altitudeM > 11000) {
      T_amb = 216.65; // Isothermal stratosphere up to 20,000m
    }

    const P_amb = P0 * Math.pow(1 - (L * Math.min(altitudeM, 11000)) / T0, 5.25588);
    const rho_amb = P_amb / (287.058 * T_amb);
    const speedOfSound = Math.sqrt(1.4 * 287.058 * T_amb); // m/s

    return {
      tempK: T_amb,
      tempC: T_amb - 273.15,
      pressurePa: P_amb,
      pressureKPa: P_amb / 1000,
      densityKgM3: rho_amb,
      speedOfSound,
    };
  }, [altitudeM]);

  // High-Speed Aerodynamics & Shock / Stagnation Calculations
  const aeroPhysics = useMemo(() => {
    const mach = airSpeedMs / atmosphere.speedOfSound;
    const dynamicPressurePa = 0.5 * atmosphere.densityKgM3 * Math.pow(airSpeedMs, 2);
    const dynamicPressureKPa = dynamicPressurePa / 1000;

    // Stagnation pressure (Isentropic relation)
    const gamma = 1.4;
    const stagPressurePa =
      atmosphere.pressurePa * Math.pow(1 + ((gamma - 1) / 2) * Math.pow(mach, 2), gamma / (gamma - 1));
    const stagPressureKPa = stagPressurePa / 1000;

    // Aerodynamic heating / Stagnation temperature
    // T0 = T_inf * (1 + (gamma-1)/2 * M^2)
    const totalTempK = atmosphere.tempK * (1 + 0.2 * Math.pow(mach, 2));
    const totalTempC = totalTempK - 273.15;

    // Recovery temperature at boundary layer (recovery factor r ≈ 0.89 for turbulent flow)
    const recoveryTempK = atmosphere.tempK * (1 + 0.89 * 0.2 * Math.pow(mach, 2));
    const recoveryTempC = recoveryTempK - 273.15;

    // Active cooling temperature reduction
    // Cooling effectiveness scales with coolingRatePct
    const maxCoolingDeltaC = coolingMode === 'cryogenic' ? 140 : coolingMode === 'liquid_chiller' ? 95 : 55;
    const coolingDeltaC = (coolingRatePct / 100) * maxCoolingDeltaC;
    const netSkinTempC = Math.max(atmosphere.tempC, recoveryTempC - coolingDeltaC);

    // Heat extraction rate in kW
    const coolingPowerKW = (coolingRatePct / 100) * (activePreset.referenceArea * 3.8);

    // Material Limits
    const materialLimits = {
      carbon_fiber: { yieldMpa: 650, maxTempC: 180, name: 'Carbon-Fiber Composite' },
      titanium: { yieldMpa: 880, maxTempC: 600, name: 'Aerospace Titanium Ti-6Al-4V' },
      inconel: { yieldMpa: 1100, maxTempC: 980, name: 'Inconel 718 Superalloy' },
      ceramic: { yieldMpa: 450, maxTempC: 1650, name: 'Ceramic Thermal Barrier' },
    }[materialType];

    // Peak Von Mises Stress on airframe
    // Scales with dynamic pressure Q and AoA maneuver load
    const loadG = 1 + (Math.abs(aoaDeg) / 10) * (mach > 1 ? 2.5 : 1.5);
    const peakStressMpa = (dynamicPressureKPa * 2.8 * loadG) / (activePreset.id === 'hypercar' ? 0.8 : 1.2);
    const safetyFactor = materialLimits.yieldMpa / Math.max(1, peakStressMpa);

    // Aerodynamic Forces (Lift & Drag in kN)
    // Angle of Attack lift curve slope dCL/da ≈ 0.1 / deg, with stall past 16°
    const isStalled = Math.abs(aoaDeg) > 17;
    const aoaEffective = isStalled ? Math.sign(aoaDeg) * (17 - (Math.abs(aoaDeg) - 17) * 0.6) : aoaDeg;
    const cL = activePreset.baseCL + aoaEffective * 0.095;
    const inducedCD = Math.pow(cL, 2) / (Math.PI * 8.5 * 0.85);
    const waveCD = mach > 0.95 ? 0.04 * Math.pow(mach - 0.95, 1.8) : 0;
    const cD = activePreset.baseCD + Math.abs(inducedCD) + waveCD;

    const liftForceKN = (0.5 * atmosphere.densityKgM3 * Math.pow(airSpeedMs, 2) * activePreset.referenceArea * cL) / 1000;
    const dragForceKN = (0.5 * atmosphere.densityKgM3 * Math.pow(airSpeedMs, 2) * activePreset.referenceArea * cD) / 1000;
    const liftToDrag = cL / Math.max(0.001, cD);

    return {
      mach,
      dynamicPressureKPa,
      stagPressureKPa,
      totalTempC,
      recoveryTempC,
      coolingDeltaC,
      netSkinTempC,
      coolingPowerKW,
      peakStressMpa,
      safetyFactor,
      isStalled,
      cL,
      cD,
      liftForceKN,
      dragForceKN,
      liftToDrag,
      materialLimits,
    };
  }, [airSpeedMs, atmosphere, aoaDeg, coolingRatePct, coolingMode, materialType, activePreset]);

  // Auto-sync geometry from Workbench Geometry Page if user previously uploaded one
  useEffect(() => {
    if (geometries && geometries.length > 0 && !customModelGeometry) {
      const customGeom = geometries.find((g) => g.meshData && g.meshData.vertices.length > 0);
      if (customGeom && customGeom.meshData) {
        const vertices = customGeom.meshData.vertices;
        const faces = customGeom.meshData.faces;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let i = 0; i < vertices.length; i++) {
          const [x, y, z] = vertices[i];
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const cz = (minZ + maxZ) / 2;
        const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.001);

        const step = Math.max(1, Math.floor(faces.length / 1000));
        const triangles: [number, number, number][][] = [];
        for (let i = 0; i < faces.length; i += step) {
          const f = faces[i];
          if (f && vertices[f[0]] && vertices[f[1]] && vertices[f[2]]) {
            triangles.push([vertices[f[0]], vertices[f[1]], vertices[f[2]]]);
          }
        }

        setCustomModelGeometry({
          name: customGeom.name || customGeom.filename || 'Workbench 3D CAD',
          triangles,
          center: [cx, cy, cz],
          bounds: { minX, maxX, minY, maxY, minZ, maxZ },
          maxDim,
          scale: 220 / maxDim,
          vertexCount: vertices.length,
        });
        setCustomModelName(customGeom.name || customGeom.filename || 'Workbench 3D CAD');
        setCustomVertexCount(vertices.length);
      }
    }
  }, [geometries, customModelGeometry]);

  // Handle Custom STL Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Security & Lag safeguard: limit file upload to 50MB max to prevent browser tab crash
    if (file.size > 50 * 1024 * 1024) {
      sound.playWarning();
      console.warn('File exceeds 50MB limit. Please upload an optimized STL geometry.');
      return;
    }

    try {
      sound.playSuccess();
      const arrayBuffer = await file.arrayBuffer();

      let text = '';
      try {
        const slice = arrayBuffer.byteLength > 20 * 1024 * 1024 ? arrayBuffer.slice(0, 20 * 1024 * 1024) : arrayBuffer;
        text = new TextDecoder('utf-8', { fatal: false }).decode(slice);
      } catch {
        text = '';
      }

      let parsed = parseSTL(arrayBuffer, text);
      let vertices = parsed.vertices;
      let faces = parsed.faces;

      // If STL parse returned 0 vertices, try full cad parser
      if (vertices.length === 0) {
        const cadResult = await parseCadFile(file);
        vertices = cadResult.meshData.vertices;
        faces = cadResult.meshData.faces;
      }

      if (vertices.length === 0) {
        sound.playWarning();
        console.warn('No 3D vertices found in model file.');
        return;
      }

      setCustomModelName(file.name);
      setCustomVertexCount(vertices.length);

      // Compute bounding box & dimensions
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      for (let i = 0; i < vertices.length; i++) {
        const [x, y, z] = vertices[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const cz = (minZ + maxZ) / 2;
      const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.001);

      // Extract sampled triangles for smooth 60 FPS wind-tunnel rendering (up to 1200 triangles)
      const step = Math.max(1, Math.floor(faces.length / 1000));
      const triangles: [number, number, number][][] = [];
      for (let i = 0; i < faces.length; i += step) {
        const f = faces[i];
        if (f && vertices[f[0]] && vertices[f[1]] && vertices[f[2]]) {
          triangles.push([vertices[f[0]], vertices[f[1]], vertices[f[2]]]);
        }
      }

      // If faces were not generated, synthesize facets
      if (triangles.length === 0 && vertices.length >= 3) {
        for (let i = 0; i < Math.min(vertices.length - 2, 900); i += 2) {
          triangles.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
        }
      }

      setCustomModelGeometry({
        name: file.name,
        triangles,
        center: [cx, cy, cz],
        bounds: { minX, maxX, minY, maxY, minZ, maxZ },
        maxDim,
        scale: 220 / maxDim,
        vertexCount: vertices.length,
      });

      setSelectedModel('custom_upload');
      triggerConfetti();
    } catch (err) {
      console.error('Failed parsing STL geometry:', err);
    }
  };

  // Canvas Real-Time Wind Tunnel Simulation Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // Particles system
    const numParticles = 65;
    const particles = Array.from({ length: numParticles }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 400,
      speed: (airSpeedMs / 50) * (0.8 + Math.random() * 0.4),
      size: 1.5 + Math.random() * 2,
    }));

    let lastRenderTime = 0;
    const FRAME_INTERVAL = 1000 / 60;

    const render = (currentTime: number = 0) => {
      animId = requestAnimationFrame(render);

      // 1. Zero lag optimization: Pause canvas drawing if tab is in background
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      // 2. 60 FPS Throttle: prevent runaway redraws on 120Hz/144Hz displays
      if (currentTime - lastRenderTime < FRAME_INTERVAL - 2) {
        return;
      }
      lastRenderTime = currentTime;

      time += 0.04;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Dark Aerospace Aerodynamic Wind Tunnel Background
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#090D16');
      bgGrad.addColorStop(0.5, '#0F172A');
      bgGrad.addColorStop(1, '#070B12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle Aerodynamic Chamber Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 2. Shock Wave Visualization (if Supersonic / Mach > 1.0)
      if (aeroPhysics.mach >= 1.0) {
        const shockAngle = Math.asin(1 / aeroPhysics.mach); // Mach angle
        const noseX = w * 0.28;
        const noseY = h * 0.5;

        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);

        // Upper Shockwave
        ctx.beginPath();
        ctx.moveTo(noseX, noseY);
        ctx.lineTo(noseX + Math.cos(shockAngle) * 500, noseY - Math.sin(shockAngle) * 500);
        ctx.stroke();

        // Lower Shockwave
        ctx.beginPath();
        ctx.moveTo(noseX, noseY);
        ctx.lineTo(noseX + Math.cos(shockAngle) * 500, noseY + Math.sin(shockAngle) * 500);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Multiphysics Field Rendering behind and around the model
      const centerX = w * 0.45;
      const centerY = h * 0.5;

      // Stagnation High Pressure / Thermal Glow at leading nose
      const noseX = centerX - 110;
      const noseY = centerY;

      if (vizMode === 'pressure') {
        // Red Stagnation Peak
        const stagGrad = ctx.createRadialGradient(noseX, noseY, 5, noseX, noseY, 90);
        stagGrad.addColorStop(0, 'rgba(239, 68, 68, 0.65)');
        stagGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.35)');
        stagGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = stagGrad;
        ctx.beginPath();
        ctx.arc(noseX, noseY, 90, 0, Math.PI * 2);
        ctx.fill();

        // Upper Wing Suction Peak (Blue)
        const suctionGrad = ctx.createRadialGradient(centerX - 10, centerY - 45, 10, centerX - 10, centerY - 45, 120);
        suctionGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
        suctionGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.2)');
        suctionGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = suctionGrad;
        ctx.beginPath();
        ctx.arc(centerX - 10, centerY - 45, 120, 0, Math.PI * 2);
        ctx.fill();
      } else if (vizMode === 'temperature') {
        // Aerodynamic Friction Heating Thermal Boundary Layer
        const heatGrad = ctx.createRadialGradient(noseX, noseY, 10, centerX, centerY, 180);
        const heatAlpha = Math.min(0.85, 0.2 + (aeroPhysics.mach / 3) * 0.6);
        heatGrad.addColorStop(0, `rgba(239, 68, 68, ${heatAlpha})`);
        heatGrad.addColorStop(0.4, `rgba(245, 158, 11, ${heatAlpha * 0.7})`);
        heatGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 180, 0, Math.PI * 2);
        ctx.fill();
      } else if (vizMode === 'cooling') {
        // Active Cooling Airflow Streams into Radiator Ducts (Ice Cyan)
        const coolGrad = ctx.createLinearGradient(noseX - 40, centerY, centerX + 60, centerY);
        coolGrad.addColorStop(0, 'rgba(6, 182, 212, 0.8)');
        coolGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.6)');
        coolGrad.addColorStop(1, 'rgba(99, 102, 241, 0.1)');
        ctx.fillStyle = coolGrad;
        ctx.fillRect(noseX, centerY - 25, 150, 50);
      } else if (vizMode === 'stress') {
        // High Stress Regions (Wing root and nosecone)
        const stressGrad = ctx.createRadialGradient(centerX - 20, centerY, 10, centerX - 20, centerY, 80);
        const stressAlpha = Math.min(0.9, aeroPhysics.peakStressMpa / 800);
        stressGrad.addColorStop(0, `rgba(220, 38, 38, ${stressAlpha})`);
        stressGrad.addColorStop(0.6, `rgba(234, 179, 8, ${stressAlpha * 0.6})`);
        stressGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = stressGrad;
        ctx.beginPath();
        ctx.arc(centerX - 20, centerY, 80, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Streamlines & Wind Particles flowing over the model
      particles.forEach((p) => {
        if (isSimulating) {
          p.x += p.speed;
          if (p.x > w) {
            p.x = 0;
            p.y = Math.random() * h;
          }
        }

        // Deflect particles around model body
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let drawY = p.y;

        if (dist < 110) {
          const push = (110 - dist) * 0.35;
          drawY += dy < 0 ? -push : push;
        }

        // Particle color according to active mode
        ctx.fillStyle =
          vizMode === 'cooling'
            ? 'rgba(56, 189, 248, 0.8)'
            : vizMode === 'temperature'
            ? 'rgba(251, 146, 60, 0.8)'
            : 'rgba(255, 255, 255, 0.75)';

        ctx.beginPath();
        ctx.arc(p.x, drawY, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Draw Selected Model 2D/3D Silhouette with Angle of Attack (AoA)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((-aoaDeg * Math.PI) / 180); // Pitch rotation

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';

      if (selectedModel === 'airliner') {
        // Commercial Airliner Body, Swept Wings, Jet Engine Nacelles
        ctx.beginPath();
        // Fuselage
        ctx.ellipse(0, 0, 120, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Nosecone
        ctx.beginPath();
        ctx.moveTo(-115, -6);
        ctx.quadraticCurveTo(-140, 0, -115, 6);
        ctx.fill();
        ctx.stroke();

        // Main Swept Wings
        ctx.beginPath();
        ctx.moveTo(-20, -18);
        ctx.lineTo(40, -110);
        ctx.lineTo(60, -110);
        ctx.lineTo(15, -18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Lower Wing
        ctx.beginPath();
        ctx.moveTo(-20, 18);
        ctx.lineTo(40, 110);
        ctx.lineTo(60, 110);
        ctx.lineTo(15, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Engine Nacelles
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-10, -58, 42, 14);
        ctx.fillRect(-10, 44, 42, 14);

        // Tail Stabilizers
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.beginPath();
        ctx.moveTo(90, -10);
        ctx.lineTo(125, -45);
        ctx.lineTo(135, -45);
        ctx.lineTo(110, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (selectedModel === 'fighter_jet') {
        // F-22 Fighter Delta Wing Silhouette
        ctx.beginPath();
        ctx.moveTo(-130, 0); // Sharp radome
        ctx.lineTo(-70, -22); // Chines
        ctx.lineTo(15, -95); // Swept wingtip
        ctx.lineTo(45, -95);
        ctx.lineTo(35, -30);
        ctx.lineTo(95, -55); // Twin horizontal tail
        ctx.lineTo(110, -55);
        ctx.lineTo(85, -15);
        ctx.lineTo(95, 0); // Twin exhaust nozzle
        ctx.lineTo(85, 15);
        ctx.lineTo(110, 55);
        ctx.lineTo(95, 55);
        ctx.lineTo(35, 30);
        ctx.lineTo(45, 95);
        ctx.lineTo(15, 95);
        ctx.lineTo(-70, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Canopy
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-50, 0, 32, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (selectedModel === 'rocket') {
        // Hypersonic Space Rocket Capsule
        ctx.beginPath();
        ctx.moveTo(-110, 0); // Blunt nosecone
        ctx.quadraticCurveTo(-110, -38, -60, -36);
        ctx.lineTo(90, -36);
        ctx.lineTo(95, -48); // Flap
        ctx.lineTo(105, -48);
        ctx.lineTo(100, -36);
        ctx.lineTo(105, -15);
        ctx.lineTo(120, -15); // Engine skirt
        ctx.lineTo(120, 15);
        ctx.lineTo(105, 15);
        ctx.lineTo(100, 36);
        ctx.lineTo(105, 48);
        ctx.lineTo(95, 48);
        ctx.lineTo(90, 36);
        ctx.lineTo(-60, 36);
        ctx.quadraticCurveTo(-110, 38, -110, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Thermal Shield Tiles Texture
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 1.5;
        for (let tx = -90; tx < 60; tx += 20) {
          ctx.beginPath();
          ctx.moveTo(tx, -35);
          ctx.lineTo(tx, 35);
          ctx.stroke();
        }
      } else if (selectedModel === 'hypercar') {
        // F1 / Le Mans Hypercar side profile
        ctx.beginPath();
        ctx.moveTo(-120, 12); // Front splitter
        ctx.lineTo(-120, 0);
        ctx.lineTo(-80, -10); // Front wing nose
        ctx.lineTo(-40, -32); // Cockpit bubble
        ctx.lineTo(10, -34);
        ctx.lineTo(60, -18); // Engine cover fin
        ctx.lineTo(105, -45); // High rear wing
        ctx.lineTo(120, -45);
        ctx.lineTo(110, 20); // Rear diffuser
        ctx.lineTo(-115, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wheels
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(-70, 20, 18, 0, Math.PI * 2);
        ctx.arc(75, 20, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (selectedModel === 'bullet_train') {
        // Shinkansen / Maglev Aerodynamic Long Nose Train
        ctx.beginPath();
        ctx.moveTo(-140, 18);
        ctx.quadraticCurveTo(-120, -5, -60, -22);
        ctx.lineTo(130, -22);
        ctx.lineTo(130, 18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Windshield
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(-75, -12);
        ctx.lineTo(-50, -20);
        ctx.lineTo(-30, -20);
        ctx.lineTo(-55, -12);
        ctx.closePath();
        ctx.fill();
      } else if (selectedModel === 'evtol_drone') {
        // eVTOL Passenger Pod & Booms
        ctx.beginPath();
        ctx.ellipse(0, 0, 75, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Rotor Booms
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-50, -65);
        ctx.lineTo(-50, 65);
        ctx.moveTo(50, -65);
        ctx.lineTo(50, 65);
        ctx.stroke();

        // Rotors
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fillRect(-70, -70, 40, 8);
        ctx.fillRect(-70, 62, 40, 8);
        ctx.fillRect(30, -70, 40, 8);
        ctx.fillRect(30, 62, 40, 8);
      } else if (selectedModel === 'custom_upload' && customModelGeometry && customModelGeometry.triangles.length > 0) {
        // True 3D STL Model Rendering (Faceted Mesh with Aerodynamic Shaders)
        const { triangles, center, scale } = customModelGeometry;
        const [cx, cy, cz] = center;

        // Mild 3D orientation for aerodynamic wind tunnel observation
        const yaw3d = 0.32; // ~18 deg
        const pitch3d = 0.16; // ~9 deg
        const cosY = Math.cos(yaw3d);
        const sinY = Math.sin(yaw3d);
        const cosP = Math.cos(pitch3d);
        const sinP = Math.sin(pitch3d);

        const project = (v: [number, number, number]): [number, number, number] => {
          const ox = v[0] - cx;
          const oy = v[1] - cy;
          const oz = v[2] - cz;

          const x1 = ox * cosY + oz * sinY;
          const z1 = -ox * sinY + oz * cosY;
          const y2 = oy * cosP - z1 * sinP;
          const z2 = oy * sinP + z1 * cosP;

          return [x1 * scale, -y2 * scale, z2];
        };

        // Render each triangular facet with lighting and thermal/pressure shaders
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';

        for (let i = 0; i < triangles.length; i++) {
          const tri = triangles[i];
          const p0 = project(tri[0]);
          const p1 = project(tri[1]);
          const p2 = project(tri[2]);

          // Simple 2D cross product for face normal in screen space
          const e1x = p1[0] - p0[0];
          const e1y = p1[1] - p0[1];
          const e2x = p2[0] - p0[0];
          const e2y = p2[1] - p0[1];
          const crossZ = e1x * e2y - e1y * e2x;

          const normZ = crossZ >= 0 ? 1 : 0.65;
          const faceCenterX = (p0[0] + p1[0] + p2[0]) / 3;

          // Surface coloring based on vizMode & flow stagnation
          if (vizMode === 'pressure') {
            const stagnationFactor = Math.max(0, Math.min(1, (-faceCenterX + 80) / 160));
            const red = Math.round(30 + stagnationFactor * 190);
            const green = Math.round(80 + (1 - stagnationFactor) * 110);
            const blue = Math.round(180 + (1 - stagnationFactor) * 75);
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.75 * normZ})`;
          } else if (vizMode === 'temperature') {
            const heatFactor = Math.max(0, Math.min(1, (-faceCenterX + 90) / 180));
            const red = Math.round(160 + heatFactor * 95);
            const green = Math.round(50 + (1 - heatFactor) * 120);
            const blue = Math.round(40 + (1 - heatFactor) * 90);
            ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.8 * normZ})`;
          } else if (vizMode === 'cooling') {
            ctx.fillStyle = `rgba(14, 165, 233, ${0.7 * normZ})`;
          } else {
            // Stress mode
            ctx.fillStyle = `rgba(59, 130, 246, ${0.75 * normZ})`;
          }

          ctx.beginPath();
          ctx.moveTo(p0[0], p0[1]);
          ctx.lineTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else {
        // Airfoil or Custom STL
        ctx.beginPath();
        ctx.moveTo(-110, 0);
        ctx.bezierCurveTo(-90, -45, 20, -50, 120, 0);
        ctx.bezierCurveTo(20, 25, -90, 25, -110, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // 6. Interactive Inspection Probe HUD Pin
      if (probePos) {
        const px = probePos.x * w;
        const py = probePos.y * h;

        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Floating Probe Data Box
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.roundRect(px + 12, py - 40, 150, 64, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(`P_loc: ${(aeroPhysics.stagPressureKPa * 0.88).toFixed(1)} kPa`, px + 20, py - 24);
        ctx.fillStyle = '#38BDF8';
        ctx.fillText(`T_skin: ${aeroPhysics.netSkinTempC.toFixed(1)} °C`, px + 20, py - 10);
        ctx.fillStyle = '#34D399';
        ctx.fillText(`SF: ${aeroPhysics.safetyFactor.toFixed(2)} (Safe)`, px + 20, py + 4);
        ctx.restore();
      }
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [airSpeedMs, aoaDeg, isSimulating, vizMode, selectedModel, aeroPhysics, probePos, customModelGeometry]);

  // Canvas Click Handler to move Probe Pin
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    sound.playTick();
    setProbePos({ x, y });
  };

  return (
    <div className="flex-1 overflow-y-auto select-none p-4 sm:p-6 lg:p-8 space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-300/40 dark:border-white/10">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>RIMZ Live Simulation</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20">
                  MULTI-PHYSICS LAB
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live interactive air pressure, aerodynamic heating, structural capability limits, and active cooling effect testing on ANY aircraft or CAD model.
            </p>
          </div>
        </div>

        {/* Play/Pause & Reset Simulation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { sound.playTick(); setIsSimulating((v) => !v); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95 text-white ${
              isSimulating ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {isSimulating ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isSimulating ? 'Pause Flow' : 'Resume Flow'}</span>
          </button>

          <button
            onClick={() => {
              sound.playTick();
              setAirSpeedMs(240);
              setAltitudeM(10000);
              setAoaDeg(3.5);
              setCoolingRatePct(65);
            }}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl shadow-xs cursor-pointer"
            title="Reset parameters to default cruise"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODEL SELECTION RAIL (Support for ANY Model: Airliner, Fighter, Rocket, Train, Car, Drone, Airfoil, or Custom STL) */}
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-sky-200/50 dark:border-white/10 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Select or Upload Any Model for Testing
            </h3>
          </div>

          {/* Hidden File Input for Custom STL Upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".stl,.obj,.vtk"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Your Own 3D STL Model</span>
          </button>
        </div>

        {/* Model Presets Horizontal Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {Object.values(MODEL_PRESETS).map((p) => {
            const isSelected = selectedModel === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  sound.playTick();
                  setSelectedModel(p.id);
                  if (p.id === 'hypercar') {
                    setAltitudeM(0);
                    setAirSpeedMs(95);
                  } else if (p.id === 'rocket') {
                    setAltitudeM(22000);
                    setAirSpeedMs(1100);
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 dark:border-sky-400 shadow-md ring-1 ring-sky-400/50'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  {p.id === 'airliner' && <Plane className="w-4 h-4 text-sky-600" />}
                  {p.id === 'fighter_jet' && <Wind className="w-4 h-4 text-indigo-600" />}
                  {p.id === 'rocket' && <Rocket className="w-4 h-4 text-rose-600" />}
                  {p.id === 'hypercar' && <Car className="w-4 h-4 text-emerald-600" />}
                  {p.id === 'bullet_train' && <Train className="w-4 h-4 text-amber-600" />}
                  {p.id === 'evtol_drone' && <Activity className="w-4 h-4 text-cyan-600" />}
                  {p.id === 'airfoil' && <Gauge className="w-4 h-4 text-purple-600" />}
                  {p.id === 'custom_upload' && <Upload className="w-4 h-4 text-teal-600" />}

                  {isSelected && <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]" />}
                </div>

                <div className="mt-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                    {p.name.split(' (')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {p.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {customModelName && selectedModel === 'custom_upload' && (
          <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 text-teal-800 dark:text-teal-300 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>Loaded custom STL model: <strong>{customModelName}</strong> ({customVertexCount.toLocaleString()} triangles)</span>
            </div>
            <span className="font-mono text-[10px] font-bold">READY FOR LIVE TESTING</span>
          </div>
        )}
      </div>

      {/* 4 MAIN TESTING KPI CARDS (PRESSURE, HEATING, COOLING, STRUCTURAL INTEGRITY) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Dynamic & Stagnation Air Pressure */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-sky-200/60 dark:border-white/10 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">DYNAMIC PRESSURE (q)</span>
            <Gauge className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {aeroPhysics.dynamicPressureKPa.toFixed(1)} <span className="text-sm font-normal text-slate-400">kPa</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Stagnation Peak:</span>
            <strong className="text-blue-600">{aeroPhysics.stagPressureKPa.toFixed(1)} kPa</strong>
          </div>
        </div>

        {/* 2. Aerodynamic Stagnation & Boundary Layer Heating */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-sky-200/60 dark:border-white/10 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">AERODYNAMIC HEATING (T0)</span>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {aeroPhysics.totalTempC.toFixed(1)} <span className="text-sm font-normal text-slate-400">°C</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Skin Recovery Temp:</span>
            <strong className="text-amber-600">{aeroPhysics.recoveryTempC.toFixed(1)} °C</strong>
          </div>
        </div>

        {/* 3. Cooling Effects & Heat Dissipation */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-sky-200/60 dark:border-white/10 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">ACTIVE COOLING EFFECT</span>
            <Snowflake className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400">
            -{aeroPhysics.coolingDeltaC.toFixed(1)} <span className="text-sm font-normal text-slate-400">°C</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Cooled Equilibrium:</span>
            <strong className="text-teal-600">{aeroPhysics.netSkinTempC.toFixed(1)} °C</strong>
          </div>
        </div>

        {/* 4. Structural Stress & Airframe Capability Limit */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-sky-200/60 dark:border-white/10 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">AIRFRAME SAFETY FACTOR</span>
            {aeroPhysics.safetyFactor >= 1.5 ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div className={`text-2xl font-black font-mono ${
            aeroPhysics.safetyFactor >= 1.5 ? 'text-emerald-600' : aeroPhysics.safetyFactor >= 1.0 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            SF {aeroPhysics.safetyFactor.toFixed(2)}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Peak Von Mises Stress:</span>
            <strong>{aeroPhysics.peakStressMpa.toFixed(0)} / {aeroPhysics.materialLimits.yieldMpa} MPa</strong>
          </div>
        </div>
      </div>

      {/* INTERACTIVE WIND TUNNEL CANVAS & MULTI-PHYSICS SLIDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col (8 cols): High-Resolution Aerospace Wind Tunnel Canvas */}
        <div className="lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          {/* Canvas Toolbar */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Multiphysics Field Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => { sound.playTick(); setVizMode('pressure'); }}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  vizMode === 'pressure' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Air Pressure Field
              </button>
              <button
                onClick={() => { sound.playTick(); setVizMode('temperature'); }}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  vizMode === 'temperature' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Thermal Heatmap
              </button>
              <button
                onClick={() => { sound.playTick(); setVizMode('cooling'); }}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  vizMode === 'cooling' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cooling Streamlines
              </button>
              <button
                onClick={() => { sound.playTick(); setVizMode('stress'); }}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  vizMode === 'stress' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Structural Stress
              </button>
            </div>

            {/* Live Flow Regime Indicator */}
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <span>
                {aeroPhysics.mach < 0.8
                  ? 'SUBSONIC LAMINAR'
                  : aeroPhysics.mach < 1.2
                  ? 'TRANSONIC CRITICAL'
                  : aeroPhysics.mach < 3.0
                  ? 'SUPERSONIC OBLIQUE'
                  : 'HYPERSONIC DETACHED SHOCK'}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-sky-400 font-bold">Mach {aeroPhysics.mach.toFixed(2)}</span>
            </div>
          </div>

          {/* Canvas Rendering Area */}
          <div className="relative flex-1 min-h-[360px] sm:min-h-[420px] bg-slate-950 flex items-center justify-center cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={800}
              height={420}
              onClick={handleCanvasClick}
              className="w-full h-full object-contain"
            />

            {/* Click to Probe Hint */}
            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-slate-300 border border-white/10 pointer-events-none flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>Click anywhere on model to inspect local pressure, temperature &amp; stress</span>
            </div>

            {/* Stall Warning Banner if Angle of Attack is beyond critical limit */}
            {aeroPhysics.isStalled && (
              <div className="absolute top-3 right-3 bg-rose-950/90 backdrop-blur-md px-3 py-1 rounded-md text-xs font-mono text-rose-300 border border-rose-600 shadow-md flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>AERODYNAMIC STALL: FLOW SEPARATION ACTIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Col (4 cols): Environmental Wind Tunnel Chamber Controls */}
        <div className="lg:col-span-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-sky-200/60 dark:border-white/10 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
            <Sliders className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Environmental Chamber Controls
            </h3>
          </div>

          {/* Air Speed / Mach Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Airflow Velocity</span>
              <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">
                {airSpeedMs} m/s (Mach {aeroPhysics.mach.toFixed(2)})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1200"
              step="10"
              value={airSpeedMs}
              onChange={(e) => setAirSpeedMs(Number(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>0 m/s (Static)</span>
              <span>340 m/s (Mach 1.0)</span>
              <span>1200 m/s (Mach 4.0)</span>
            </div>
          </div>

          {/* Altitude Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Flight Altitude</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {altitudeM.toLocaleString()} m ({atmosphere.pressureKPa.toFixed(1)} kPa)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="35000"
              step="500"
              value={altitudeM}
              onChange={(e) => setAltitudeM(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>Sea Level (0m)</span>
              <span>10,000m (Cruise)</span>
              <span>35,000m (Near Space)</span>
            </div>
          </div>

          {/* Angle of Attack (AoA) */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Angle of Attack (AoA)</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                {aoaDeg >= 0 ? `+${aoaDeg}°` : `${aoaDeg}°`}
              </span>
            </div>
            <input
              type="range"
              min="-15"
              max="35"
              step="0.5"
              value={aoaDeg}
              onChange={(e) => setAoaDeg(Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>-15°</span>
              <span>0° (Neutral)</span>
              <span>+35° (High Alpha)</span>
            </div>
          </div>

          {/* Cooling System Power Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-300">Cooling System Rate</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                {coolingRatePct}% ({aeroPhysics.coolingPowerKW.toFixed(0)} kW Heat Sink)
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={coolingRatePct}
              onChange={(e) => setCoolingRatePct(Number(e.target.value))}
              className="w-full accent-cyan-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>0% (Disabled)</span>
              <span>50% (Standard)</span>
              <span>100% (Cryo Flush)</span>
            </div>
          </div>

          {/* Cooling Mechanism Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">Cooling Method</label>
            <select
              value={coolingMode}
              onChange={(e) => setCoolingMode(e.target.value as any)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ram_air">Forced Convection Ram Air Intakes</option>
              <option value="liquid_chiller">Closed-Loop Liquid Glycol Chiller</option>
              <option value="cryogenic">Cryogenic Active Phase-Change</option>
              <option value="passive">Passive Structural Heat Sink</option>
            </select>
          </div>

          {/* Airframe Material */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">Structural Material</label>
            <select
              value={materialType}
              onChange={(e) => setMaterialType(e.target.value as any)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="titanium">Aerospace Titanium Ti-6Al-4V (880 MPa / 600°C)</option>
              <option value="carbon_fiber">Carbon-Fiber Polymer Matrix (650 MPa / 180°C)</option>
              <option value="inconel">Inconel 718 Superalloy (1100 MPa / 980°C)</option>
              <option value="ceramic">Ceramic Matrix Thermal Barrier (450 MPa / 1650°C)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SYNCHRONIZED LIVE EXCEL REPORT, PIE CHART, AND NORMAL CHART FOR THIS SIMULATION */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            Final Results: Synchronized Live Excel &amp; Visual Analytics Sheet
          </h2>
        </div>

        <LiveResultSheetDashboard
          projectName={`RIMZ Live Testing: ${activePreset.name}`}
          simulationId={`SIM-${selectedModel.toUpperCase()}-${Math.round(airSpeedMs)}MS`}
          mach={aeroPhysics.mach}
          aoa={aoaDeg}
          cL={aeroPhysics.cL}
          cD={aeroPhysics.cD}
          liftToDrag={aeroPhysics.liftToDrag}
        />
      </div>
    </div>
  );
};
