import React from 'react';
import { MeshStatistics } from '../../types';
import { Grid, Layers, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';

interface MeshInspectorProps {
  meshStats: MeshStatistics;
  onRegenerateMesh: () => void;
  onUpdateInflation: (layers: number, growthRate: number) => void;
}

export const MeshInspector: React.FC<MeshInspectorProps> = ({
  meshStats,
  onRegenerateMesh,
  onUpdateInflation,
}) => {
  return (
    <div className="flex flex-col h-full overflow-y-auto text-xs select-none">
      {/* Header */}
      <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
        <div>
          <span className="font-semibold text-[#0F172A] tracking-tight uppercase text-[10px]">
            Mesh Topology & Quality
          </span>
          <p className="text-[11px] text-[#64748B]">Hybrid unstructured quad/prism grid</p>
        </div>
        <button
          onClick={onRegenerateMesh}
          className="flex items-center gap-1 px-2 py-0.5 bg-[#2563EB] text-white rounded text-[11px] font-medium hover:bg-[#1D4ED8] transition-colors shadow-2xs"
        >
          <Sparkles className="w-3 h-3" />
          <span>Remesh</span>
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Cell & Node Stats Matrix */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-[#F1F5F9] rounded border border-[#E2E8F0]">
            <span className="text-[10px] text-[#64748B] block">Total Elements</span>
            <span className="font-mono text-base font-bold text-[#0F172A] tabular-nums">
              {meshStats.totalCells.toLocaleString()}
            </span>
            <span className="text-[9px] text-[#2563EB] font-mono block">84% Quadrilateral</span>
          </div>

          <div className="p-2 bg-[#F1F5F9] rounded border border-[#E2E8F0]">
            <span className="text-[10px] text-[#64748B] block">Grid Vertices</span>
            <span className="font-mono text-base font-bold text-[#0F172A] tabular-nums">
              {meshStats.totalNodes.toLocaleString()}
            </span>
            <span className="text-[9px] text-[#10B981] font-mono block">Conforming Nodes</span>
          </div>
        </div>

        {/* Quality Metrics */}
        <div>
          <label className="block text-[11px] font-semibold text-[#0F172A] mb-2">
            Mesh Metric Integrity
          </label>
          <div className="space-y-2">
            {/* Orthogonal Quality */}
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-0.5">
                <span className="text-[#475569]">Min Orthogonal Quality</span>
                <span className="text-[#10B981] font-bold">
                  {meshStats.minOrthogonalQuality.toFixed(2)} (Nominal)
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#10B981] h-full rounded-full"
                  style={{ width: `${meshStats.minOrthogonalQuality * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Skewness */}
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-0.5">
                <span className="text-[#475569]">Max Face Skewness</span>
                <span className="text-[#2563EB] font-bold">
                  {meshStats.maxSkewness.toFixed(2)} (Low)
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#2563EB] h-full rounded-full"
                  style={{ width: `${(1 - meshStats.maxSkewness) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Boundary layer y+ estimation */}
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-0.5">
                <span className="text-[#475569]">Target Wall y+ Spacing</span>
                <span className="text-[#10B981] font-bold">
                  y+ = {meshStats.yPlusAverage.toFixed(2)} (&lt; 1.0)
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#10B981] h-full rounded-full" style={{ width: '92%' }}></div>
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                Resolves laminar sublayer without wall functions
              </p>
            </div>
          </div>
        </div>

        {/* Boundary Layer Prism Inflation Controls */}
        <div className="p-2.5 bg-white border border-[#E2E8F0] rounded space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F172A]">
            <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Boundary Layer Inflation Stack</span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div>
              <label className="text-[10px] text-[#64748B] block mb-0.5">Prism Layers</label>
              <input
                type="number"
                min="5"
                max="35"
                value={meshStats.inflationLayers}
                onChange={(e) =>
                  onUpdateInflation(parseInt(e.target.value, 10) || 18, meshStats.growthRate)
                }
                className="w-full bg-[#F1F5F9] border border-[#CBD5E1] rounded px-1.5 py-1 text-[#0F172A] font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#64748B] block mb-0.5">Growth Rate</label>
              <input
                type="number"
                step="0.02"
                min="1.05"
                max="1.4"
                value={meshStats.growthRate}
                onChange={(e) =>
                  onUpdateInflation(meshStats.inflationLayers, parseFloat(e.target.value) || 1.18)
                }
                className="w-full bg-[#F1F5F9] border border-[#CBD5E1] rounded px-1.5 py-1 text-[#0F172A] font-bold focus:outline-none"
              />
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#64748B] flex items-center gap-1 pt-1 border-t border-[#F1F5F9]">
            <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
            <span>First cell height Δy1: {meshStats.firstCellHeightMm} mm</span>
          </div>
        </div>
      </div>
    </div>
  );
};
