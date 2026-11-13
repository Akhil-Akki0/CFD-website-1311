import { AirfoilPreset, AirfoilPresetId, AeroCoefficients, ProbePoint } from '../types';

export const AIRFOIL_PRESETS: Record<AirfoilPresetId, AirfoilPreset> = {
  naca0012: {
    id: 'naca0012',
    name: 'NACA 0012 Transonic',
    category: 'Transonic Wing',
    chord: 1.0,
    description: 'Symmetric NACA 4-digit airfoil benchmark for subsonic and transonic buffet validation.',
    defaultMach: 0.75,
    defaultAoA: 2.0,
    defaultRe: 3.2e6,
  },
  rae2822: {
    id: 'rae2822',
    name: 'RAE 2822 Supercritical',
    category: 'Supercritical',
    chord: 1.0,
    description: 'Classic supercritical transonic profile designed to delay wave drag rise and weaken upper shocks.',
    defaultMach: 0.729,
    defaultAoA: 2.31,
    defaultRe: 6.5e6,
  },
  diamond_wedge: {
    id: 'diamond_wedge',
    name: 'Supersonic Diamond Wedge',
    category: 'Supersonic',
    chord: 1.0,
    description: 'Biconvex / double-wedge supersonic aerofoil exhibiting oblique attached shockwaves and Prandtl-Meyer expansions.',
    defaultMach: 1.65,
    defaultAoA: 1.5,
    defaultRe: 2.1e6,
  },
  turbine_vane: {
    id: 'turbine_vane',
    name: 'High-Turning Gas Turbine Vane',
    category: 'Turbomachinery',
    chord: 1.0,
    description: 'Stator nozzle guide vane characterized by high aerodynamic turning, adverse pressure gradients, and trailing edge wake.',
    defaultMach: 0.85,
    defaultAoA: 12.0,
    defaultRe: 1.8e6,
  },
};

/**
 * Returns normalized surface points for upper and lower surfaces [0..1]
 */
export function getAirfoilGeometry(presetId: AirfoilPresetId, numPoints = 80): { upper: [number, number][]; lower: [number, number][] } {
  const upper: [number, number][] = [];
  const lower: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    // Cosine spacing for dense clustering near leading and trailing edges
    const beta = (i / numPoints) * Math.PI;
    const x = 0.5 * (1 - Math.cos(beta));

    let yu = 0;
    let yl = 0;

    if (presetId === 'naca0012') {
      // Standard NACA 0012 thickness distribution
      const yt = 5 * 0.12 * (
        0.2969 * Math.sqrt(Math.max(0.0001, x)) -
        0.1260 * x -
        0.3516 * Math.pow(x, 2) +
        0.2843 * Math.pow(x, 3) -
        0.1015 * Math.pow(x, 4)
      );
      yu = yt;
      yl = -yt;
    } else if (presetId === 'rae2822') {
      // Supercritical camber + flat upper surface
      const camber = 0.015 * (4 * x * (1 - x)) - 0.008 * Math.sin(Math.PI * x);
      const yt = 0.121 * (
        0.29 * Math.sqrt(Math.max(0.0001, x)) -
        0.08 * x -
        0.38 * Math.pow(x, 2) +
        0.31 * Math.pow(x, 3) -
        0.14 * Math.pow(x, 4)
      );
      yu = camber + yt * 0.9;
      yl = camber - yt * 1.1;
    } else if (presetId === 'diamond_wedge') {
      // Diamond wedge (half-angle ~ 5 degrees, max thickness at x = 0.5)
      const tMax = 0.07;
      if (x <= 0.5) {
        yu = (x / 0.5) * tMax;
        yl = -yu;
      } else {
        yu = ((1.0 - x) / 0.5) * tMax;
        yl = -yu;
      }
    } else {
      // Turbine Vane: large camber turn
      const camber = 0.18 * Math.sin(Math.pow(x, 0.7) * Math.PI);
      const yt = 0.15 * Math.sin(Math.PI * Math.pow(x, 0.6)) * (1 - 0.5 * x);
      yu = camber + yt * 0.8;
      yl = camber - yt * 0.9;
    }

    upper.push([x, yu]);
    lower.push([x, yl]);
  }

  return { upper, lower };
}

/**
 * Calculates flow velocity (u, v), Mach, Cp, Vorticity, TKE, Temp at any field point (x, y)
 */
export function computeFieldPoint(
  x: number, // normalized chord units, e.g. -0.5 to 1.8
  y: number, // normalized chord units, e.g. -0.8 to 0.8
  presetId: AirfoilPresetId,
  mach: number,
  aoaDeg: number
) {
  const aoaRad = (aoaDeg * Math.PI) / 180;
  const uInf = mach * 340.29; // approximate speed of sound
  const vInf = 0;

  // Transform coordinates into airfoil-aligned frame
  const cosA = Math.cos(aoaRad);
  const sinA = Math.sin(aoaRad);
  const xr = x * cosA + y * sinA;
  const yr = -x * sinA + y * cosA;

  // Distance to leading edge (0,0) and trailing edge (1,0)
  const rLE = Math.sqrt(xr * xr + yr * yr) + 0.02;
  const rTE = Math.sqrt((xr - 1) * (xr - 1) + yr * yr) + 0.02;

  // Circulation / lift effect
  const circulationFactor = 2.0 * Math.PI * (aoaRad + (presetId === 'rae2822' ? 0.03 : presetId === 'turbine_vane' ? 0.22 : 0));
  
  // Potential flow approximation around profile
  let uPerturb = 0;
  let vPerturb = 0;

  // Doublet / thickness perturbation
  const thickness = presetId === 'naca0012' ? 0.12 : presetId === 'rae2822' ? 0.121 : presetId === 'diamond_wedge' ? 0.07 : 0.22;
  const doubletStrength = 0.35 * thickness;

  if (xr >= -0.05 && xr <= 1.05) {
    const distToChord = Math.abs(yr);
    const decay = Math.exp(-distToChord * 6);
    
    // Suction over upper surface
    if (yr > 0) {
      const peakX = presetId === 'rae2822' ? 0.45 : 0.15;
      const suctionShape = Math.exp(-Math.pow((xr - peakX) / 0.35, 2));
      uPerturb += (0.45 * suctionShape + doubletStrength) * (1 + 0.8 * aoaRad) * decay;
    } else {
      // Pressure stagnation under lower surface
      const pressureShape = Math.exp(-Math.pow((xr - 0.2) / 0.4, 2));
      uPerturb -= 0.15 * pressureShape * decay;
    }
  }

  // Vortex sheet effect for angle of attack
  const vortexDecay = 1 / (rLE + 0.1);
  vPerturb += (circulationFactor / (2 * Math.PI)) * ((xr - 0.25) / (rLE * rLE + 0.05));
  uPerturb -= (circulationFactor / (2 * Math.PI)) * (yr / (rLE * rLE + 0.05));

  // Transonic shock wave modeling (Mach 0.75+)
  let shockIntensity = 0;
  if (mach >= 0.72 && presetId !== 'diamond_wedge') {
    const shockX = presetId === 'rae2822' ? 0.65 : 0.52;
    // Shock exists on upper surface
    if (yr > 0.01 && yr < 0.35 && xr > shockX - 0.08 && xr < shockX + 0.08) {
      shockIntensity = Math.exp(-Math.pow((xr - shockX) / 0.04, 2)) * Math.exp(-yr * 4) * (mach - 0.68) * 4;
    }
  } else if (presetId === 'diamond_wedge' && mach >= 1.0) {
    // Oblique shock at leading edge & expansion fans
    const shockAngle = Math.asin(1 / mach) * 1.2;
    const distToOblique = Math.abs(Math.abs(yr) - xr * Math.tan(shockAngle));
    if (distToOblique < 0.06 && xr > 0 && xr < 1.4) {
      shockIntensity = Math.exp(-distToOblique * 20) * 1.5;
    }
  }

  // Wake & boundary layer separation at high AoA
  let wakeTurbulence = 0;
  let vorticity = 0;
  if (xr > 0.85) {
    const wakeCenter = yr - (xr - 1) * Math.tan(-aoaRad * 0.6);
    const wakeWidth = 0.04 + (xr - 0.85) * 0.15 * (1 + Math.max(0, aoaDeg - 8) * 0.3);
    const inWake = Math.exp(-Math.pow(wakeCenter / wakeWidth, 2));
    wakeTurbulence = inWake * (0.08 + Math.max(0, aoaDeg - 5) * 0.03);
    uPerturb -= inWake * 0.45; // momentum deficit in wake
    vorticity = -2 * (wakeCenter / wakeWidth) * inWake * (1.2 + aoaRad * 2);
  }

  // Leading edge stagnation & curvature
  if (rLE < 0.15) {
    vorticity += (yr / (rLE + 0.01)) * 3.5;
  }

  // Combined local velocity
  const localU = Math.max(0.05, 1.0 + uPerturb - shockIntensity * 0.3);
  const localV = vPerturb * 0.5;
  const velMagNorm = Math.sqrt(localU * localU + localV * localV);
  const localMach = mach * velMagNorm;

  // Pressure coefficient Cp via Prandtl-Glauert / isentropic compressible relation
  // Cp = 2 / (gamma * M^2) * ( (1 + 0.5*(gamma-1)*M_inf^2 * (1 - velMagNorm^2))^(gamma/(gamma-1)) - 1 )
  const gamma = 1.4;
  let cp = 1 - Math.pow(velMagNorm, 2);
  if (mach > 0.3 && mach < 1.0) {
    // Compressibility correction
    const beta = Math.sqrt(1 - mach * mach);
    cp = cp / Math.max(0.2, beta);
  }
  if (shockIntensity > 0) {
    cp += shockIntensity * 0.8;
  }

  // Temperature (isentropic ratio)
  // T / T_inf = 1 + ((gamma - 1) / 2) * M_inf^2 * (1 - (localMach/M_inf)^2)
  const tRatio = 1 + 0.2 * Math.pow(mach, 2) * (1 - Math.pow(velMagNorm, 2));
  const localT = 288.15 * Math.max(0.7, tRatio);

  // Turbulent kinetic energy k
  const tke = Math.max(0.001, (wakeTurbulence * 2.5 + Math.abs(vorticity) * 0.08 + shockIntensity * 0.15) * Math.pow(uInf, 2) * 0.02);

  return {
    u: localU * uInf,
    v: localV * uInf,
    normVelocity: velMagNorm,
    mach: Math.max(0.01, localMach),
    cp: Math.max(-3.5, Math.min(1.2, cp)),
    vorticity: vorticity * (uInf / 1.0),
    tke,
    temperature: localT,
    shockIntensity,
  };
}

/**
 * Calculates surface Cp distribution across chord length x/c (0 to 1)
 */
export function getCpDistribution(presetId: AirfoilPresetId, mach: number, aoaDeg: number): { x: number; cpUpper: number; cpLower: number }[] {
  const points: { x: number; cpUpper: number; cpLower: number }[] = [];
  const { upper, lower } = getAirfoilGeometry(presetId, 60);

  for (let i = 0; i < upper.length; i++) {
    const [xu, yu] = upper[i];
    const [, yl] = lower[i];

    const ptUpper = computeFieldPoint(xu, yu + 0.005, presetId, mach, aoaDeg);
    const ptLower = computeFieldPoint(xu, yl - 0.005, presetId, mach, aoaDeg);

    points.push({
      x: xu,
      cpUpper: ptUpper.cp,
      cpLower: ptLower.cp,
    });
  }

  return points;
}

/**
 * Calculates Aerodynamic Force Coefficients (CL, CD, CM, L/D)
 */
export function computeAeroCoefficients(presetId: AirfoilPresetId, mach: number, aoaDeg: number): AeroCoefficients {
  const aoaRad = (aoaDeg * Math.PI) / 180;
  
  // Base 2D thin airfoil theory slope dCl/da ~ 2*pi / sqrt(1 - M^2)
  const beta = Math.sqrt(Math.max(0.08, Math.abs(1 - mach * mach)));
  const liftSlope = (2 * Math.PI) / Math.max(0.4, beta);

  let cL0 = 0;
  if (presetId === 'rae2822') cL0 = 0.18;
  if (presetId === 'turbine_vane') cL0 = 0.85;

  let cL = cL0 + liftSlope * aoaRad;

  // Stall / separation modeling beyond critical angle of attack
  const stallAngle = presetId === 'diamond_wedge' ? 12 : 14.5;
  if (Math.abs(aoaDeg) > stallAngle) {
    const overStall = Math.abs(aoaDeg) - stallAngle;
    const drop = 0.5 * Math.sin((overStall * Math.PI) / 20);
    cL = (cL > 0 ? 1 : -1) * (Math.abs(cL) - drop);
  }

  // Drag calculation: Skin friction + Induced/Form + Wave drag
  const cd0_friction = 0.0068 * (presetId === 'turbine_vane' ? 1.8 : 1.0);
  const cd_induced = 0.015 * Math.pow(cL, 2);

  // Wave drag rise above drag divergence Mach number
  let cd_wave = 0;
  const mDivergence = presetId === 'rae2822' ? 0.76 : presetId === 'diamond_wedge' ? 1.0 : 0.73;
  if (mach > mDivergence) {
    cd_wave = 0.12 * Math.pow(mach - mDivergence, 1.8);
    if (presetId === 'diamond_wedge' && mach >= 1.0) {
      // Wave drag of diamond wedge ~ 4 * (t/c)^2 / sqrt(M^2 - 1)
      const tOverC = 0.07;
      cd_wave = (4 * Math.pow(tOverC, 2)) / Math.sqrt(Math.max(0.01, mach * mach - 1)) + 0.01;
    }
  }

  const cDp = cd_induced + cd_wave;
  const cDf = cd0_friction;
  const cD = Math.max(0.008, cDp + cDf);

  // Pitching moment at quarter chord c/4
  const cM = -0.05 * (presetId === 'rae2822' ? 1.8 : presetId === 'turbine_vane' ? 4.2 : 0.2) - 0.02 * cL;
  const liftToDrag = cD > 0 ? cL / cD : 0;

  return {
    cL: Number(cL.toFixed(4)),
    cD: Number(cD.toFixed(4)),
    cDp: Number(cDp.toFixed(4)),
    cDf: Number(cDf.toFixed(4)),
    cM: Number(cM.toFixed(4)),
    liftToDrag: Number(liftToDrag.toFixed(2)),
  };
}

/**
 * Generate initial convergence residuals curve
 */
export function generateInitialResiduals(currentIter: number): {
  continuity: number;
  xMomentum: number;
  yMomentum: number;
  kTurbulence: number;
  omegaDissipation: number;
}[] {
  const list = [];
  const total = Math.max(1, currentIter);
  const stepSize = Math.max(1, Math.floor(total / 80));

  for (let it = 1; it <= total; it += stepSize) {
    const t = it / 2500;
    // Logarithmic decay with realistic solver oscillations
    const noise = (Math.sin(it * 0.15) * 0.08 + Math.cos(it * 0.3) * 0.05);
    const cont = Math.pow(10, -0.2 - t * 4.8 + noise);
    const xMom = Math.pow(10, -0.4 - t * 5.1 + noise * 1.1);
    const yMom = Math.pow(10, -0.5 - t * 5.0 + noise * 0.9);
    const kTurb = Math.pow(10, -0.3 - t * 4.4 + noise * 1.3);
    const omega = Math.pow(10, -0.1 - t * 4.6 + noise * 0.7);

    list.push({
      continuity: cont,
      xMomentum: xMom,
      yMomentum: yMom,
      kTurbulence: kTurb,
      omegaDissipation: omega,
    });
  }

  return list;
}

/**
 * Update probe values based on current simulation state
 */
export function updateProbesWithState(
  probes: ProbePoint[],
  presetId: AirfoilPresetId,
  mach: number,
  aoa: number,
  p0: number,
  t0: number
): ProbePoint[] {
  return probes.map((p) => {
    const res = computeFieldPoint(p.x, p.y, presetId, mach, aoa);
    return {
      ...p,
      cp: Number(res.cp.toFixed(3)),
      mach: Number(res.mach.toFixed(3)),
      u: Number(res.u.toFixed(1)),
      v: Number(res.v.toFixed(1)),
      p: Number((p0 * (1 + 0.5 * res.cp * 0.1)).toFixed(1)),
      t: Number(res.temperature.toFixed(1)),
    };
  });
}
