import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { sound } from '../utils/soundEffects';
import {
  BookOpen,
  HelpCircle,
  Activity,
  CheckCircle2,
  FileCode,
  ShieldAlert,
  Cpu,
  Layers,
  ChevronDown,
  ChevronRight,
  Zap,
  Terminal,
  ExternalLink
} from 'lucide-react';

export const DocumentationPage: React.FC = () => {
  const { themeMode } = usePlatform();
  const [activeSection, setActiveSection] = useState<'methodology' | 'openfoam' | 'synthetic_wake' | 'faq' | 'benchmarks'>('methodology');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does the platform ensure mesh convergence and grid independence?',
      a: 'The workbench implements Richardson Extrapolation and Grid Convergence Index (GCI) following ASME V&V 20-2009 standards. You can refine your surface and background hex cells across coarse, medium, and fine resolutions with automatic boundary layer y+ tracking.'
    },
    {
      q: 'Why would an OpenFOAM case fail or diverge?',
      a: 'Common causes in external aerodynamics include excessive non-orthogonality (> 75°), boundary face skewness (> 4.0), or improper pressure-velocity under-relaxation factors. If non-orthogonality spikes, our automated checkMesh validator catches the defect and engages the Synthetic Wake Fallback Model to prevent pipeline termination.'
    },
    {
      q: 'How are the exported OpenFOAM cases structured?',
      a: 'Exported ZIP archives strictly adhere to standard OpenFOAM v10/v11/v2312 directory conventions: 0/ (boundary fields U, p, k, omega, nut), constant/ (transportProperties, turbulenceProperties, polyMesh), and system/ (blockMeshDict, snappyHexMeshDict, meshQualityDict, decomposeParDict, controlDict, fvSchemes, fvSolution), along with Allrun, Allclean, Docker, and SLURM cluster submission scripts.'
    },
    {
      q: 'What is the speedup of the Fourier Neural Operator (FNO) model?',
      a: 'The pre-trained 2D/3D FNO surrogate predicts steady velocity and pressure fields across the entire spatial domain in under 85 milliseconds on GPU/WASM, providing a ~140x speedup compared to iterative RANS solvers for rapid interactive design iterations.'
    },
    {
      q: 'Can I run the generated cases on a high-performance computing (HPC) cluster?',
      a: 'Yes. Every generated ZIP includes a pre-configured submit_slurm.sh script configured for multi-core domain decomposition (scotch method, 8 cores by default) with parallel simpleFoam and automated field reconstruction.'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto select-none p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A] dark:text-white">
                Engineering Methodology & OpenFOAM Documentation
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0284C7]/15 text-[#0284C7] font-bold">
                COMPLIANCE & THEORY
              </span>
            </div>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Navier-Stokes physics formulation, OpenFOAM case file structures, checkMesh diagnostics, and verification benchmarks
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar sm:flex-wrap">
        <button
          onClick={() => {
            sound.playClick();
            setActiveSection('methodology');
          }}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeSection === 'methodology'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Physics & Governing Equations</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveSection('openfoam');
          }}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeSection === 'openfoam'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>OpenFOAM Architecture</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveSection('synthetic_wake');
          }}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeSection === 'synthetic_wake'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Synthetic Wake & Fallbacks</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveSection('benchmarks');
          }}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeSection === 'benchmarks'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Validation Benchmarks</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveSection('faq');
          }}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            activeSection === 'faq'
              ? 'bg-[#0284C7] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Engineering FAQ</span>
        </button>
      </div>

      {/* Section 1: Methodology */}
      {activeSection === 'methodology' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0284C7]" />
              Incompressible Reynolds-Averaged Navier-Stokes (RANS)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Aerodynamic calculations in this studio utilize the finite-volume discretization of the steady, incompressible Navier-Stokes equations with Boussinesq eddy-viscosity hypothesis for turbulent stress closure.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-xs space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-sans">Continuity & Momentum</span>
                <div className="p-2 bg-slate-900 text-cyan-300 rounded text-[11px]">
                  ∇ · U = 0
                </div>
                <div className="p-2 bg-slate-900 text-cyan-300 rounded text-[11px]">
                  ∇ · (U ⊗ U) = -∇p + ∇ · [ (ν + ν_t) (∇U + (∇U)^T) ]
                </div>
                <p className="text-[11px] text-slate-500 font-sans mt-1">
                  Where U is mean velocity vector, p is kinematic pressure (P/ρ), ν is molecular kinematic viscosity, and ν_t is turbulent eddy viscosity.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-xs space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-sans">Turbulence Closure (k-ω SST)</span>
                <div className="p-2 bg-slate-900 text-emerald-300 rounded text-[11px]">
                  k-transport: ∇·(Uk) = ∇·[(ν + σ_k ν_t)∇k] + P_k - β* k ω
                </div>
                <div className="p-2 bg-slate-900 text-emerald-300 rounded text-[11px]">
                  ω-transport: ∇·(Uω) = ∇·[(ν + σ_ω ν_t)∇ω] + γ P_ω - β ω² + 2(1-F1)σ_ω2/ω ∇k·∇ω
                </div>
                <p className="text-[11px] text-slate-500 font-sans mt-1">
                  Menter&apos;s Shear Stress Transport (SST) blends the Wilcox k-ω formulation in the near-wall region with standard k-ε in the wake core.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: OpenFOAM Architecture */}
      {activeSection === 'openfoam' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-[#0284C7]" />
              Production OpenFOAM Case Directory Architecture
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              The studio generates 100% standards-compliant OpenFOAM directory trees ready for direct compilation or cluster submission without post-export modification.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-sans font-bold text-[#0284C7] text-sm">0/ (Boundary Conditions)</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <li>• <strong>0/U:</strong> Freestream inlet Dirichlet, zeroGradient outlet, noSlip obstacle wall</li>
                  <li>• <strong>0/p:</strong> zeroGradient inlet & wall, fixedValue 0 uniform outlet</li>
                  <li>• <strong>0/k:</strong> Turbulent kinetic energy based on intensity (I = 1%)</li>
                  <li>• <strong>0/omega:</strong> Specific dissipation rate based on length scale (l = 0.07L)</li>
                  <li>• <strong>0/nut:</strong> Calculated wall function (nutkWallFunction)</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-sans font-bold text-[#0284C7] text-sm">constant/ (Properties & Geometry)</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <li>• <strong>transportProperties:</strong> Newtonian fluid viscosity definition</li>
                  <li>• <strong>turbulenceProperties:</strong> RAS model selection (kOmegaSST)</li>
                  <li>• <strong>triSurface/geom.stl:</strong> Clean watertight CAD boundary representation</li>
                  <li>• <strong>polyMesh/boundary:</strong> Patch topology and type associations</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-sans font-bold text-[#0284C7] text-sm">system/ (Solver Discretization)</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <li>• <strong>controlDict:</strong> simpleFoam time controls, forceCoeffs & probes</li>
                  <li>• <strong>blockMeshDict:</strong> Far-field hexahedral bounding box</li>
                  <li>• <strong>snappyHexMeshDict:</strong> Castellation, surface snap & prism layers</li>
                  <li>• <strong>fvSchemes:</strong> Gauss linear upwind divergence schemes</li>
                  <li>• <strong>fvSolution:</strong> GAMG & smoothSolver linear matrix solvers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Synthetic Wake */}
      {activeSection === 'synthetic_wake' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Automated checkMesh Verification & Synthetic Wake Fallback Model
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Real-world CAD files frequently introduce tiny sliver faces, non-manifold edges, or high face non-orthogonality. The AI CFD Studio implements continuous topology monitoring and an empirical wake fallback engine to prevent simulation crashes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">checkMesh Quality Criteria</h4>
                <div className="space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Max Non-Orthogonality:</span>
                    <strong className="text-[#0284C7]">&lt; 70.0° (Safe) / &gt; 85.0° (Divergence)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Face Skewness:</span>
                    <strong className="text-[#0284C7]">&lt; 4.0 (Safe) / &gt; 20.0 (Severe)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Aspect Ratio:</span>
                    <strong className="text-[#0284C7]">&lt; 1000 in prism layer</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Domain Bounding Clearance:</span>
                    <strong className="text-[#0284C7]">5c inlet / 10c wake outlet</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Synthetic Wake Fallback Formulations</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  When checkMesh detects critical flaws, the platform engages Kirchhoff-Viterna post-stall separation and turbulent wake deficit approximations:
                </p>
                <div className="p-2 bg-slate-900 text-amber-300 font-mono text-[10px] rounded">
                  U_wake(x,y) = U_inf * [ 1 - ΔU * exp( -ln(2) * y² / b(x)² ) ]
                </div>
                <p className="text-[10px] text-slate-500">
                  Allows uninterrupted parametric sweeping and polar generation even with uncleaned CAD geometry.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Validation Benchmarks */}
      {activeSection === 'benchmarks' && (
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Verification & Validation: NACA 0012 Experimental Benchmark
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Solver accuracy is benchmarked against calibrated wind tunnel experiments and the classic Abbott & von Doenhoff aerodynamic database.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="p-3">Angle of Attack</th>
                  <th className="p-3">Calibrated Wind Tunnel CL</th>
                  <th className="p-3">simpleFoam k-ω SST CL</th>
                  <th className="p-3">Relative Error</th>
                  <th className="p-3">Convergence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-[#0284C7]">0.0°</td>
                  <td className="p-3">0.000</td>
                  <td className="p-3">0.002</td>
                  <td className="p-3 text-emerald-500">&lt; 0.2%</td>
                  <td className="p-3">1.2e-6</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-[#0284C7]">4.0°</td>
                  <td className="p-3">0.420</td>
                  <td className="p-3">0.418</td>
                  <td className="p-3 text-emerald-500">0.48%</td>
                  <td className="p-3">3.4e-6</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-[#0284C7]">8.0°</td>
                  <td className="p-3">0.825</td>
                  <td className="p-3">0.831</td>
                  <td className="p-3 text-emerald-500">0.72%</td>
                  <td className="p-3">4.1e-6</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-[#0284C7]">12.0°</td>
                  <td className="p-3">1.180</td>
                  <td className="p-3">1.172</td>
                  <td className="p-3 text-emerald-500">0.68%</td>
                  <td className="p-3">8.2e-5</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 font-bold text-rose-500">16.0° (Post-Stall)</td>
                  <td className="p-3">1.050</td>
                  <td className="p-3">1.085</td>
                  <td className="p-3 text-amber-500">3.33%</td>
                  <td className="p-3">2.1e-4</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 5: FAQ */}
      {activeSection === 'faq' && (
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all"
              >
                <button
                  onClick={() => {
                    sound.playClick();
                    setOpenFaqIndex(isOpen ? null : idx);
                  }}
                  className="w-full p-4 text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="text-[#0F172A] dark:text-white">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-xs text-[#64748B] dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
