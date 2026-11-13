import React from 'react';

interface OrientationTriadProps {
  aoa: number; // pitch angle in degrees
  scaleMeters: number; // e.g. 1.0 m chord
}

export const OrientationTriad: React.FC<OrientationTriadProps> = ({ aoa, scaleMeters }) => {
  const rad = (aoa * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Center of triad
  const cx = 32;
  const cy = 32;
  const armLen = 22;

  // X axis (rotated by AoA)
  const xEndX = cx + armLen * cos;
  const xEndY = cy - armLen * sin;

  // Y axis (perpendicular)
  const yEndX = cx - armLen * sin;
  const yEndY = cy - armLen * cos;

  return (
    <div className="absolute bottom-3 left-3 z-20 flex items-center gap-3 bg-white/85 backdrop-blur-md border border-[#E2E8F0]/90 rounded-md px-2.5 py-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.06)] select-none">
      {/* 2D / 3D Triad Vector Graphic */}
      <div className="relative w-16 h-16 shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64" className="overflow-visible">
          {/* Background circle */}
          <circle cx="32" cy="32" r="28" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />

          {/* Reference baseline */}
          <line x1="10" y1="32" x2="54" y2="32" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="1 3" />

          {/* X Axis (Airfoil Chord vector, red #EF4444) */}
          <line
            x1={cx}
            y1={cy}
            x2={xEndX}
            y2={xEndY}
            stroke="#EF4444"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon
            points={`${xEndX},${xEndY} ${xEndX - 4 * cos + 3 * sin},${xEndY + 4 * sin + 3 * cos} ${xEndX - 4 * cos - 3 * sin},${xEndY + 4 * sin - 3 * cos}`}
            fill="#EF4444"
          />
          <text
            x={xEndX + 6 * cos}
            y={xEndY - 6 * sin + 3}
            fill="#EF4444"
            fontSize="9"
            fontFamily="JetBrains Mono"
            fontWeight="bold"
            textAnchor="middle"
          >
            X
          </text>

          {/* Y Axis (Normal vector, green #10B981) */}
          <line
            x1={cx}
            y1={cy}
            x2={yEndX}
            y2={yEndY}
            stroke="#10B981"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon
            points={`${yEndX},${yEndY} ${yEndX + 4 * sin + 3 * cos},${yEndY + 4 * cos - 3 * sin} ${yEndX + 4 * sin - 3 * cos},${yEndY + 4 * cos + 3 * sin}`}
            fill="#10B981"
          />
          <text
            x={yEndX - 6 * sin}
            y={yEndY - 6 * cos + 3}
            fill="#10B981"
            fontSize="9"
            fontFamily="JetBrains Mono"
            fontWeight="bold"
            textAnchor="middle"
          >
            Y
          </text>

          {/* Z Axis origin point (out of screen, blue #2563EB) */}
          <circle cx={cx} cy={cy} r="3" fill="#2563EB" />
          <circle cx={cx} cy={cy} r="1" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Euler Angles & Reference Scale */}
      <div className="flex flex-col justify-center font-mono text-[10px] text-[#475569] leading-tight space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[#94A3B8]">PITCH α:</span>
          <span className="font-bold text-[#0F172A] bg-[#F1F5F9] px-1 rounded">
            {aoa >= 0 ? `+${aoa.toFixed(1)}°` : `${aoa.toFixed(1)}°`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[#94A3B8]">YAW β:</span>
          <span className="text-[#64748B]">0.0°</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[#94A3B8]">SCALE:</span>
          <span className="text-[#2563EB] font-medium">c = {scaleMeters.toFixed(2)}m</span>
        </div>
      </div>
    </div>
  );
};
