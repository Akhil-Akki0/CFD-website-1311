import React from 'react';

interface CfdLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  onClick?: () => void;
}

export const CfdLogo: React.FC<CfdLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  onClick,
}) => {
  // Size mappings
  const sizeConfig = {
    xs: { imgSize: 'w-6 h-6', textSize: 'text-xs', subSize: 'text-[8px]', gap: 'gap-1.5' },
    sm: { imgSize: 'w-8 h-8', textSize: 'text-sm', subSize: 'text-[9px]', gap: 'gap-2' },
    md: { imgSize: 'w-10 h-10', textSize: 'text-base', subSize: 'text-[10px]', gap: 'gap-2.5' },
    lg: { imgSize: 'w-16 h-16', textSize: 'text-xl', subSize: 'text-xs', gap: 'gap-3' },
    xl: { imgSize: 'w-24 h-24', textSize: 'text-3xl', subSize: 'text-sm', gap: 'gap-4' },
  };

  const { imgSize, textSize, subSize, gap } = sizeConfig[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${gap} ${onClick ? 'cursor-pointer select-none' : ''} ${className}`}
    >
      {/* Circular RIMZ Logo Emblem */}
      <div
        className={`relative ${imgSize} shrink-0 rounded-full p-[1.5px] bg-gradient-to-tr from-sky-500 via-cyan-300 to-blue-600 shadow-[0_0_16px_rgba(2,132,199,0.45)] hover:shadow-[0_0_24px_rgba(2,132,199,0.7)] transition-all duration-300 flex items-center justify-center`}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-slate-950 flex items-center justify-center relative">
          {/* Pristine, bug-free circular RIMZ vector badge */}
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full drop-shadow-md select-none"
            aria-label="RIMZ Circular Logo"
          >
            <defs>
              {/* Radial background glow */}
              <radialGradient id="rimzBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0369a1" />
                <stop offset="60%" stopColor="#082f49" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
              {/* Transonic supersonic gradient */}
              <linearGradient id="rimzGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              {/* Streamline gradient */}
              <linearGradient id="rimzStream" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="1" />
              </linearGradient>
            </defs>

            {/* Background Disc */}
            <circle cx="50" cy="50" r="48" fill="url(#rimzBg)" />

            {/* Concentric Mach shockwave rings */}
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeOpacity="0.4"
              strokeDasharray="4 3"
            />
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="#0284c7"
              strokeWidth="0.8"
              strokeOpacity="0.5"
            />

            {/* Aerodynamic high-speed streamlines */}
            <path
              d="M 12 36 Q 38 24 64 34 T 92 38"
              fill="none"
              stroke="url(#rimzStream)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M 8 50 Q 40 40 68 50 T 94 48"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
            <path
              d="M 14 64 Q 42 72 68 62 T 90 60"
              fill="none"
              stroke="url(#rimzStream)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />

            {/* Stylized Supersonic Aerodynamic 'R' / RIMZ Core Glyph */}
            <g transform="translate(24, 20)">
              {/* Vertical pillar with supersonic camber */}
              <path
                d="M 8 10 L 19 10 C 26 10 32 14 32 22 C 32 30 26 34 19 34 L 8 34 Z"
                fill="none"
                stroke="url(#rimzGlow)"
                strokeWidth="5.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Back stem */}
              <path
                d="M 8 10 L 8 50"
                stroke="#ffffff"
                strokeWidth="5.5"
                strokeLinecap="round"
              />
              {/* Diagonal supersonic thruster leg */}
              <path
                d="M 18 33 L 34 50"
                stroke="url(#rimzGlow)"
                strokeWidth="5.5"
                strokeLinecap="round"
              />
              {/* Leading edge light glint */}
              <circle cx="8" cy="10" r="3.5" fill="#38bdf8" />
            </g>
          </svg>
        </div>
      </div>

      {/* Typography Label */}
      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight ${textSize} font-sans flex items-center`}>
              <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent font-black tracking-widest text-[1.05em] drop-shadow-sm">
                RIMZ
              </span>
              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-sky-500/15 border border-sky-400/40 rounded-full text-sky-700 dark:text-sky-300">
                CFD
              </span>
            </span>
          </div>
          <span className={`font-bold tracking-wider uppercase text-slate-500 dark:text-sky-400/80 ${subSize}`}>
            Aerodynamics & Multi-Physics
          </span>
        </div>
      )}
    </div>
  );
};
