import React, { useState } from 'react';
import { GeometryTree } from './GeometryTree';
import { PhysicsInspector } from './PhysicsInspector';
import { MeshInspector } from './MeshInspector';
import {
  SimulationState,
  TurbulenceModel,
  ProbePoint,
  MeshStatistics,
  AirfoilPresetId
} from '../../types';
import { Layers, Activity, Grid, ChevronLeft, ChevronRight } from 'lucide-react';

interface LeftSidebarProps {
  simulationState: SimulationState;
  turbulenceModel: TurbulenceModel;
  onTurbulenceModelChange: (model: TurbulenceModel) => void;
  onMachChange: (mach: number) => void;
  onAoAChange: (aoa: number) => void;
  onCflChange: (cfl: number) => void;
  onReynoldsChange: (re: number) => void;
  probes: ProbePoint[];
  selectedProbeId: string | null;
  onSelectProbe: (id: string) => void;
  onToggleProbeVisibility: (id: string) => void;
  onAddProbe: () => void;
  meshStats: MeshStatistics;
  onRegenerateMesh: () => void;
  onUpdateInflation: (layers: number, growthRate: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  simulationState,
  turbulenceModel,
  onTurbulenceModelChange,
  onMachChange,
  onAoAChange,
  onCflChange,
  onReynoldsChange,
  probes,
  selectedProbeId,
  onSelectProbe,
  onToggleProbeVisibility,
  onAddProbe,
  meshStats,
  onRegenerateMesh,
  onUpdateInflation,
  collapsed,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'tree' | 'physics' | 'mesh'>('physics');

  if (collapsed) {
    return (
      <div className="w-10 border-r border-[#E2E8F0] bg-white flex flex-col items-center py-3 gap-3 shrink-0 select-none z-10">
        <button
          onClick={onToggleCollapse}
          title="Expand Inspector Sidebar"
          className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-6 h-[1px] bg-[#E2E8F0]"></div>
        <button
          onClick={() => {
            onToggleCollapse();
            setActiveTab('tree');
          }}
          title="Geometry Tree"
          className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9] rounded"
        >
          <Layers className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            onToggleCollapse();
            setActiveTab('physics');
          }}
          title="Physics & Boundary Conditions"
          className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9] rounded"
        >
          <Activity className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            onToggleCollapse();
            setActiveTab('mesh');
          }}
          title="Mesh Topology"
          className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9] rounded"
        >
          <Grid className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-[85vw] sm:w-80 md:w-84 lg:w-88 max-w-[340px] border-r border-[#E2E8F0] bg-white flex flex-col shrink-0 h-full select-none z-10 shadow-[1px_0_3px_rgba(15,23,42,0.02)]">
      {/* Top Segmented Mode Switcher (Recessed #F1F5F9 cradle containing sliding segmented tabs with 2px inner padding) */}
      <div className="p-2 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
        <div className="flex-1 flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#E2E8F0]">
          <button
            onClick={() => setActiveTab('physics')}
            className={`flex-1 py-1 px-1.5 text-[11px] font-semibold rounded transition-all flex items-center justify-center gap-1 ${
              activeTab === 'physics'
                ? 'bg-white text-[#2563EB] shadow-xs border border-[#CBD5E1]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Activity className="w-3 h-3 text-[#2563EB]" />
            <span>Physics</span>
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`flex-1 py-1 px-1.5 text-[11px] font-semibold rounded transition-all flex items-center justify-center gap-1 ${
              activeTab === 'tree'
                ? 'bg-white text-[#2563EB] shadow-xs border border-[#CBD5E1]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Layers className="w-3 h-3 text-[#8B5CF6]" />
            <span>Tree</span>
          </button>

          <button
            onClick={() => setActiveTab('mesh')}
            className={`flex-1 py-1 px-1.5 text-[11px] font-semibold rounded transition-all flex items-center justify-center gap-1 ${
              activeTab === 'mesh'
                ? 'bg-white text-[#2563EB] shadow-xs border border-[#CBD5E1]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Grid className="w-3 h-3 text-[#10B981]" />
            <span>Mesh</span>
          </button>
        </div>

        <button
          onClick={onToggleCollapse}
          title="Collapse Inspector Shelf"
          className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded border border-transparent hover:border-[#E2E8F0]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'tree' && (
          <GeometryTree
            probes={probes}
            selectedProbeId={selectedProbeId}
            onSelectProbe={onSelectProbe}
            onToggleProbeVisibility={onToggleProbeVisibility}
            onAddProbe={onAddProbe}
          />
        )}
        {activeTab === 'physics' && (
          <PhysicsInspector
            simulationState={simulationState}
            turbulenceModel={turbulenceModel}
            onTurbulenceModelChange={onTurbulenceModelChange}
            onMachChange={onMachChange}
            onAoAChange={onAoAChange}
            onCflChange={onCflChange}
            onReynoldsChange={onReynoldsChange}
          />
        )}
        {activeTab === 'mesh' && (
          <MeshInspector
            meshStats={meshStats}
            onRegenerateMesh={onRegenerateMesh}
            onUpdateInflation={onUpdateInflation}
          />
        )}
      </div>
    </aside>
  );
};
