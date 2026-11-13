import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { CfdLogo } from '../components/common/CfdLogo';
import {
  Brain,
  Sparkles,
  Zap,
  CheckCircle2,
  Cpu,
  Clock,
  Gauge,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { AIPredictionResult } from '../types';

export const AIAnalysisPage: React.FC = () => {
  const {
    aiModels,
    activeModelId,
    activateModel,
    simConfig,
    triggerConfetti
  } = usePlatform();

  const [inflowSpeed, setInflowSpeed] = useState<number>(simConfig.inletVelocity || 25.0);
  const [inflowAngle, setInflowAngle] = useState<number>(simConfig.inletAngle || 4.5);
  const [fluidTemp, setFluidTemp] = useState<number>(288.15);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionResult, setPredictionResult] = useState<AIPredictionResult | null>({
    modelName: 'Fourier Neural Operator (FNO) — Cylinder Wake',
    modelType: 'FNO',
    confidence: 0.984,
    timestamp: new Date().toLocaleTimeString(),
    prediction: {
      maxVelocity: inflowSpeed * 1.52,
      avgVelocity: inflowSpeed * 0.88,
      pressureDrop: 0.5 * 1.225 * inflowSpeed ** 2 * 0.84,
      estimatedCL: 0.54,
      estimatedCD: 0.0142,
      wallShearStress: 4.82,
      recirculationLength: 1.42,
      inferenceTimeMs: 12.4,
    },
  });

  const activeModel = aiModels.find((m) => m.modelId === activeModelId) || aiModels[0];

  const handlePredict = () => {
    sound.playAIPredict();
    setIsPredicting(true);

    setTimeout(() => {
      setIsPredicting(false);
      const res: AIPredictionResult = {
        modelName: activeModel.name,
        modelType: activeModel.modelType,
        confidence: 0.975 + Math.random() * 0.02,
        timestamp: new Date().toLocaleTimeString(),
        prediction: {
          maxVelocity: Number((inflowSpeed * (1.35 + Math.random() * 0.25)).toFixed(2)),
          avgVelocity: Number((inflowSpeed * (0.82 + Math.random() * 0.08)).toFixed(2)),
          pressureDrop: Number((0.5 * 1.225 * inflowSpeed ** 2 * (0.75 + Math.random() * 0.15)).toFixed(1)),
          estimatedCL: Number((0.1 * inflowAngle + 0.12).toFixed(3)),
          estimatedCD: Number((0.008 + 0.002 * (inflowAngle / 5) ** 2).toFixed(4)),
          wallShearStress: Number((3.5 + Math.random() * 2.0).toFixed(2)),
          recirculationLength: Number((1.2 + Math.random() * 0.4).toFixed(2)),
          inferenceTimeMs: Number((10.5 + Math.random() * 4.0).toFixed(1)),
        },
      };
      setPredictionResult(res);
      triggerConfetti();
    }, 600);
  };

  return (
    <div className="flex-1 overflow-y-auto select-none text-[#0F172A] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
              <span>AI Analysis & Neural Operators</span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Real-time aerodynamic surrogate modeling powered by Fourier Neural Operators (FNO) and PINNs
            </p>
          </div>
        </div>

        {/* AI System Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F3FF] border border-[#DDD6FE] text-[#7C3AED] rounded-lg text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_#8b5cf6]"></span>
          <span>AI Inference Subsystem: READY</span>
        </div>
      </div>

      {/* Registered AI Models Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Registered Neural Surrogate Models ({aiModels.length})
          </h2>
          <span className="text-[11px] text-[#64748B]">Click to bind active operator</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {aiModels.map((model) => {
            const isCurrent = model.modelId === activeModelId;
            return (
              <div
                key={model.modelId}
                onClick={() => activateModel(model.modelId)}
                className={`bg-white rounded-xl border p-4 shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
                  isCurrent
                    ? 'border-[#8B5CF6] ring-2 ring-[#8B5CF6]/30 bg-[#FAF5FF]'
                    : 'border-[#E2E8F0] hover:border-[#8B5CF6]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] font-bold border border-[#DDD6FE]">
                      {model.modelType}
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">v{model.version}</span>
                  </div>

                  <h3 className="font-bold text-xs text-[#0F172A] font-sans">
                    {model.name}
                  </h3>

                  <p className="text-[11px] text-[#64748B] leading-relaxed line-clamp-3">
                    {model.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#64748B]">
                    Val RMSE: <strong>{model.valRmse}</strong>
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      isCurrent ? 'text-[#8B5CF6]' : 'text-[#94A3B8]'
                    }`}
                  >
                    {isCurrent ? '● ACTIVE' : 'Select'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Prediction Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Parameter Sliders (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Surrogate Flow Parameters
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            {/* Speed Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#475569]">Inflow Speed (m/s)</label>
                <span className="font-mono font-bold text-[#0F172A]">{inflowSpeed} m/s</span>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                step="1"
                value={inflowSpeed}
                onChange={(e) => setInflowSpeed(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
              />
            </div>

            {/* Angle Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#475569]">Angle of Attack α</label>
                <span className="font-mono font-bold text-[#0F172A]">{inflowAngle}°</span>
              </div>
              <input
                type="range"
                min="-5"
                max="20"
                step="0.5"
                value={inflowAngle}
                onChange={(e) => setInflowAngle(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
              />
            </div>

            {/* Fluid Temp Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#475569]">Fluid Temperature (K)</label>
                <span className="font-mono font-bold text-[#0F172A]">{fluidTemp} K</span>
              </div>
              <input
                type="range"
                min="250"
                max="350"
                step="1"
                value={fluidTemp}
                onChange={(e) => setFluidTemp(Number(e.target.value))}
                className="w-full accent-[#8B5CF6]"
              />
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[11px] text-[#64748B] space-y-1">
              <div className="flex items-center justify-between">
                <span>Active Bound Operator:</span>
                <strong className="text-[#0F172A]">{activeModel.modelType}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated Speedup:</span>
                <strong className="text-[#10B981]">1,200x vs OpenFOAM</strong>
              </div>
            </div>

            <button
              onClick={handlePredict}
              disabled={isPredicting}
              className="w-full min-h-[44px] py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isPredicting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Executing Tensor Forward Pass...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Predict Flow Field Instantly</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Col: Prediction Readout & Visual Cards (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#8B5CF6]" />
              <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Neural Surrogate Inference Output
              </h2>
            </div>
            {predictionResult && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#10B981] font-bold">
                Confidence: {(predictionResult.confidence * 100).toFixed(1)}%
              </span>
            )}
          </div>

          {predictionResult ? (
            <div className="space-y-4">
              {/* 4 Metric Output Boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Max Velocity</span>
                  <strong className="text-base font-mono text-[#0F172A] mt-1 block">
                    {predictionResult.prediction.maxVelocity} m/s
                  </strong>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Pressure Drop Δp</span>
                  <strong className="text-base font-mono text-[#2563EB] mt-1 block">
                    {predictionResult.prediction.pressureDrop} Pa
                  </strong>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Est. Lift / Drag</span>
                  <strong className="text-base font-mono text-[#10B981] mt-1 block">
                    {(predictionResult.prediction.estimatedCL / predictionResult.prediction.estimatedCD).toFixed(1)}
                  </strong>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                  <span className="text-[10px] text-[#64748B] block">Inference Time</span>
                  <strong className="text-base font-mono text-[#8B5CF6] mt-1 block">
                    {predictionResult.prediction.inferenceTimeMs} ms
                  </strong>
                </div>
              </div>

              {/* Coefficient comparison */}
              <div className="p-4 bg-[#FAF5FF] rounded-lg border border-[#DDD6FE] space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-medium text-[#0F172A]">
                  <span>Surrogate Estimated Lift Coefficient (cL):</span>
                  <strong className="font-mono">{predictionResult.prediction.estimatedCL}</strong>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-medium text-[#0F172A]">
                  <span>Surrogate Estimated Drag Coefficient (cD):</span>
                  <strong className="font-mono">{predictionResult.prediction.estimatedCD}</strong>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-medium text-[#0F172A]">
                  <span>Separation / Recirculation Length:</span>
                  <strong className="font-mono">{predictionResult.prediction.recirculationLength} m</strong>
                </div>
              </div>

              <div className="text-[11px] text-[#64748B] text-center font-mono">
                Model: {predictionResult.modelName} • Computed in {predictionResult.prediction.inferenceTimeMs} ms
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-[#94A3B8] text-xs">
              Select parameters and click Predict to run neural operator inference.
            </div>
          )}
        </div>
      </div>

      {/* AI Roadmap Table matching Cwebsite-CFD-001 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
          AI Architecture & Roadmap
        </h3>

        <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                <th className="py-2 font-semibold">Model Class</th>
                <th className="py-2 font-semibold">Underlying Physics</th>
                <th className="py-2 font-semibold">Training Framework</th>
                <th className="py-2 font-semibold">Deployment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px] text-[#334155]">
              <tr>
                <td className="py-2.5 font-bold text-[#0F172A]">Fourier Neural Operator (FNO)</td>
                <td>Incompressible Navier-Stokes (2D Karman Vortex)</td>
                <td>PyTorch + NeuralOperator library</td>
                <td><span className="text-[#10B981] font-semibold">✓ Deployed v1.2</span></td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-[#0F172A]">Physics-Informed NN (PINN)</td>
                <td>Transonic Euler + Shock Discontinuity capturing</td>
                <td>DeepXDE / NVIDIA Modulus</td>
                <td><span className="text-[#10B981] font-semibold">✓ Deployed v2.0</span></td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-[#0F172A]">DeepONet Branch-Trunk</td>
                <td>Turbulent expansion & pressure head loss</td>
                <td>JAX / Flax</td>
                <td><span className="text-[#2563EB] font-semibold">Beta Active</span></td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-[#0F172A]">Multi-Fidelity Kriging (MF-GPR)</td>
                <td>Aero surface polar prediction across flight envelope</td>
                <td>GPyTorch</td>
                <td><span className="text-[#2563EB] font-semibold">Production Ready</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
