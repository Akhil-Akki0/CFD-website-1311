import { MetalPresetId, SolidMaterialProperties } from '../types';

export const METAL_MATERIAL_PRESETS: Record<Exclude<MetalPresetId, 'custom'>, SolidMaterialProperties> = {
  aluminum_6061_t6: {
    presetId: 'aluminum_6061_t6',
    name: 'Aluminum 6061-T6',
    density: 2700,
    specificHeat: 896,
    thermalConductivity: 167,
    surfaceRoughness: 0.000015,
  },
  pure_copper: {
    presetId: 'pure_copper',
    name: 'Pure Copper',
    density: 8960,
    specificHeat: 385,
    thermalConductivity: 401,
    surfaceRoughness: 0.0000015,
  },
  stainless_steel_304: {
    presetId: 'stainless_steel_304',
    name: 'Stainless Steel 304',
    density: 8000,
    specificHeat: 500,
    thermalConductivity: 16.2,
    surfaceRoughness: 0.000015,
  },
  titanium_ti6al4v: {
    presetId: 'titanium_ti6al4v',
    name: 'Titanium Ti-6Al-4V',
    density: 4430,
    specificHeat: 526,
    thermalConductivity: 6.7,
    surfaceRoughness: 0.000008,
  },
  cast_iron: {
    presetId: 'cast_iron',
    name: 'Cast Iron',
    density: 7200,
    specificHeat: 460,
    thermalConductivity: 55,
    surfaceRoughness: 0.00026,
  },
  forged_magnesium: {
    presetId: 'forged_magnesium',
    name: 'Forged Magnesium',
    density: 1800,
    specificHeat: 1020,
    thermalConductivity: 156,
    surfaceRoughness: 0.000012,
  },
};

export const CUSTOM_METAL_ALLOY_DEFAULT: SolidMaterialProperties = {
  presetId: 'custom',
  name: 'Custom Metal Alloy',
  density: 7850,
  specificHeat: 480,
  thermalConductivity: 45,
  surfaceRoughness: 0.00002,
};

export const METAL_MATERIAL_OPTIONS: SolidMaterialProperties[] = [
  METAL_MATERIAL_PRESETS.aluminum_6061_t6,
  METAL_MATERIAL_PRESETS.pure_copper,
  METAL_MATERIAL_PRESETS.stainless_steel_304,
  METAL_MATERIAL_PRESETS.titanium_ti6al4v,
  METAL_MATERIAL_PRESETS.cast_iron,
  METAL_MATERIAL_PRESETS.forged_magnesium,
  CUSTOM_METAL_ALLOY_DEFAULT,
];

export type FluidMediumPresetId = 'air_20c' | 'hot_brake_air_150c' | 'water_20c' | 'custom';

export interface FluidMediumPreset {
  presetId: FluidMediumPresetId;
  label: string;
  fluidType: 'Air' | 'Water' | 'Custom';
  density: number;
  viscosity: number;
  temperature: number;
  pressure: number;
}

export const FLUID_MEDIUM_PRESETS: Record<Exclude<FluidMediumPresetId, 'custom'>, FluidMediumPreset> = {
  air_20c: {
    presetId: 'air_20c',
    label: 'Air (Standard 20°C / 293 K)',
    fluidType: 'Air',
    density: 1.225,
    viscosity: 1.5e-5,
    temperature: 293.15,
    pressure: 101325,
  },
  hot_brake_air_150c: {
    presetId: 'hot_brake_air_150c',
    label: 'Hot Brake-Zone Air (150°C / 423 K)',
    fluidType: 'Air',
    density: 0.834,
    viscosity: 2.86e-5,
    temperature: 423.15,
    pressure: 101325,
  },
  water_20c: {
    presetId: 'water_20c',
    label: 'Water (Hydrodynamic 20°C / 293 K)',
    fluidType: 'Water',
    density: 998.2,
    viscosity: 1.004e-6,
    temperature: 293.15,
    pressure: 101325,
  },
};

export const FLUID_MEDIUM_OPTIONS: FluidMediumPreset[] = [
  FLUID_MEDIUM_PRESETS.air_20c,
  FLUID_MEDIUM_PRESETS.hot_brake_air_150c,
  FLUID_MEDIUM_PRESETS.water_20c,
  {
    presetId: 'custom',
    label: 'Custom Fluid Medium',
    fluidType: 'Custom',
    density: 1.225,
    viscosity: 1.5e-5,
    temperature: 293.15,
    pressure: 101325,
  },
];

export const MATERIAL_BOUNDS = {
  density: { min: 100, max: 25000 },
  specificHeat: { min: 50, max: 10000 },
  thermalConductivity: { min: 0.1, max: 2500 },
  surfaceRoughness: { min: 1e-8, max: 0.05 },
  solidWallTemperature: { min: 150, max: 4000 },
} as const;
