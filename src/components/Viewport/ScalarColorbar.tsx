import React from 'react';
import { ScalarFieldType, ScalarMetadata } from '../../types';

interface ScalarColorbarProps {
  scalarType: ScalarFieldType;
  mach: number;
}

export const SCALAR_METADATA: Record<ScalarFieldType, (mach: number) => ScalarMetadata> = {
  pressure_cp: () => ({
    id: 'pressure_cp',
    name: 'Pressure Coefficient',
    symbol: 'Cp',
    unit: '-',
    min: -2.5,
    max: 1.0,
    colormap: 'coolwarm',
  }),
  mach: (mach) => ({
    id: 'mach',
    name: 'Local Mach Number',
    symbol: 'M',
    unit: '-',
    min: 0.0,
    max: Number((mach * 1.5).toFixed(2)),
    colormap: 'spectral',
  }),
  velocity_u: (mach) => ({
    id: 'velocity_u',
    name: 'Velocity Magnitude',
    symbol: '|U|',
    unit: 'm/s',
    min: 0,
    max: Math.round(mach * 340 * 1.4),
    colormap: 'spectral',
  }),
  vorticity: () => ({
    id: 'vorticity',
    name: 'Spanwise Vorticity',
    symbol: 'ω_z',
    unit: '1/s',
    min: -150,
    max: 150,
    colormap: 'coolwarm',
  }),
  turbulent_ke: () => ({
    id: 'turbulent_ke',
    name: 'Turbulent Kinetic Energy',
    symbol: 'k',
    unit: 'm²/s²',
    min: 0.0,
    max: 45.0,
    colormap: 'plasma',
  }),
  temperature: () => ({
    id: 'temperature',
    name: 'Static Temperature',
    symbol: 'T',
    unit: 'K',
    min: 240,
    max: 320,
    colormap: 'spectral',
  }),
};

export const ScalarColorbar: React.FC<ScalarColorbarProps> = ({ scalarType, mach }) => {
  const meta = SCALAR_METADATA[scalarType](mach);

  // Colormap gradient styles
  const getGradient = () => {
    switch (meta.colormap) {
      case 'coolwarm':
        // Blue (low Cp / suction) -> White / Cyan -> Red (stagnation)
        return 'linear-gradient(to bottom, #EF4444, #F59E0B, #E2E8F0, #06B6D4, #2563EB)';
      case 'spectral':
        // High (Red) -> Yellow -> Green -> Cyan -> Blue (Low)
        return 'linear-gradient(to bottom, #EF4444, #F59E0B, #10B981, #06B6D4, #2563EB)';
      case 'plasma':
        return 'linear-gradient(to bottom, #FACC15, #F97316, #C026D3, #7C3AED, #1E1B4B)';
      default:
        return 'linear-gradient(to bottom, #EF4444, #10B981, #2563EB)';
    }
  };

  const steps = 5;
  const tickValues = [];
  for (let i = 0; i <= steps; i++) {
    const val = meta.max - (i / steps) * (meta.max - meta.min);
    tickValues.push(val);
  }

  return (
    <div className="absolute top-14 right-3.5 z-20 flex flex-col items-center bg-white/85 backdrop-blur-md border border-[#E2E8F0]/90 rounded-md p-2 shadow-[0_4px_16px_-2px_rgba(15,23,42,0.08)] select-none">
      {/* Title & Units */}
      <div className="text-center font-mono mb-1.5 leading-tight">
        <span className="text-[11px] font-bold text-[#0F172A] block">{meta.symbol}</span>
        <span className="text-[9px] text-[#64748B] font-normal">[{meta.unit}]</span>
      </div>

      {/* Bar + Ticks Container */}
      <div className="flex items-stretch gap-1.5 h-44">
        {/* Precision 12px vertical gradient strip */}
        <div
          className="w-3 rounded-xs border border-[#CBD5E1] shadow-inner"
          style={{ background: getGradient() }}
        ></div>

        {/* Monospace Ticks */}
        <div className="flex flex-col justify-between font-mono text-[10px] text-[#475569] tabular-nums pl-0.5">
          {tickValues.map((val, idx) => (
            <div key={idx} className="flex items-center gap-1 leading-none">
              <span className="w-1.5 h-[1px] bg-[#94A3B8]"></span>
              <span>{val >= 0 && val !== 0 ? `+${val.toFixed(1)}` : val.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Field name label */}
      <span className="text-[9px] text-[#64748B] font-medium tracking-tight mt-1 max-w-[65px] text-center leading-tight truncate">
        {meta.name}
      </span>
    </div>
  );
};
