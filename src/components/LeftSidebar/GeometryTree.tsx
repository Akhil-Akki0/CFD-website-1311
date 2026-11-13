import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Box,
  Layers,
  CircleDot,
  Compass,
  Plus
} from 'lucide-react';
import { TreeItem, ProbePoint } from '../../types';

interface GeometryTreeProps {
  probes: ProbePoint[];
  selectedProbeId: string | null;
  onSelectProbe: (id: string) => void;
  onToggleProbeVisibility: (id: string) => void;
  onAddProbe: () => void;
}

export const GeometryTree: React.FC<GeometryTreeProps> = ({
  probes,
  selectedProbeId,
  onSelectProbe,
  onToggleProbeVisibility,
  onAddProbe,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    domain: true,
    boundaries: true,
    airfoil: true,
    mesh_zones: true,
    probes: true,
  });

  const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>({
    domain_farfield: true,
    inlet_bc: true,
    outlet_bc: true,
    airfoil_surface: true,
    boundary_layer_prisms: true,
    shock_refinement: true,
    wake_refinement: true,
    probes_all: true,
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const toggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVisibilityState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto text-xs select-none">
      <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
        <div>
          <span className="font-semibold text-[#0F172A] tracking-tight uppercase text-[10px]">
            Model Hierarchy & Features
          </span>
          <p className="text-[11px] text-[#64748B]">Computational domain decomposition</p>
        </div>
        <button
          onClick={onAddProbe}
          title="Place Sensor Probe in Flowfield"
          className="flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded text-[11px] font-medium text-[#2563EB] shadow-2xs"
        >
          <Plus className="w-3 h-3" />
          <span>Add Probe</span>
        </button>
      </div>

      <div className="p-2 space-y-1 font-mono text-[11px]">
        {/* Domain Node */}
        <div>
          <div
            onClick={() => toggleNode('domain')}
            className="flex items-center justify-between p-1 hover:bg-[#F1F5F9] rounded cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[#0F172A] font-sans font-medium">
              {expandedNodes.domain ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
              )}
              <Box className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Fluid Domain (Farfield)</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#F1F5F9] text-[#475569] rounded border border-[#E2E8F0]">
              [-5c, +15c]
            </span>
          </div>

          {expandedNodes.domain && (
            <div className="ml-4 pl-2 border-l border-[#E2E8F0] space-y-0.5 mt-0.5">
              <div className="flex items-center justify-between py-1 px-1.5 hover:bg-[#F1F5F9] rounded">
                <div className="flex items-center gap-1.5 text-[#475569]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
                  <span>Velocity Inlet [X = -5c]</span>
                </div>
                <button
                  onClick={(e) => toggleVisibility('inlet_bc', e)}
                  className="text-[#94A3B8] hover:text-[#0F172A]"
                >
                  {visibilityState.inlet_bc ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              </div>

              <div className="flex items-center justify-between py-1 px-1.5 hover:bg-[#F1F5F9] rounded">
                <div className="flex items-center gap-1.5 text-[#475569]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]"></span>
                  <span>Pressure Outlet [X = +15c]</span>
                </div>
                <button
                  onClick={(e) => toggleVisibility('outlet_bc', e)}
                  className="text-[#94A3B8] hover:text-[#0F172A]"
                >
                  {visibilityState.outlet_bc ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Airfoil Solid Body Node */}
        <div>
          <div
            onClick={() => toggleNode('airfoil')}
            className="flex items-center justify-between p-1 hover:bg-[#F1F5F9] rounded cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[#0F172A] font-sans font-medium">
              {expandedNodes.airfoil ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
              )}
              <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>Aerofoil Solid Geometry</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#EFF6FF] text-[#2563EB] rounded border border-[#DBEAFE]">
              Chord c = 1.0m
            </span>
          </div>

          {expandedNodes.airfoil && (
            <div className="ml-4 pl-2 border-l border-[#E2E8F0] space-y-0.5 mt-0.5">
              <div className="flex items-center justify-between py-1 px-1.5 hover:bg-[#F1F5F9] rounded">
                <div className="flex items-center gap-1.5 text-[#475569]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F172A]"></span>
                  <span>No-Slip Wall Surface</span>
                </div>
                <span className="text-[9px] text-[#10B981] font-mono">y+ ~ 0.92</span>
              </div>

              <div className="flex items-center justify-between py-1 px-1.5 hover:bg-[#F1F5F9] rounded">
                <div className="flex items-center gap-1.5 text-[#475569]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]"></span>
                  <span>18-Layer Prism Inflation</span>
                </div>
                <span className="text-[9px] text-[#64748B] font-mono">GR 1.18</span>
              </div>
            </div>
          )}
        </div>

        {/* Mesh Refinement Zones */}
        <div>
          <div
            onClick={() => toggleNode('mesh_zones')}
            className="flex items-center justify-between p-1 hover:bg-[#F1F5F9] rounded cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[#0F172A] font-sans font-medium">
              {expandedNodes.mesh_zones ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
              )}
              <Compass className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Adaptive Mesh Refinements</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#F1F5F9] text-[#64748B] rounded border border-[#E2E8F0]">
              3 Zones
            </span>
          </div>

          {expandedNodes.mesh_zones && (
            <div className="ml-4 pl-2 border-l border-[#E2E8F0] space-y-0.5 mt-0.5">
              <div className="flex items-center justify-between py-1 px-1.5 hover:bg-[#F1F5F9] rounded">
                <span className="text-[#475569]">Leading Edge Curvature</span>
                <span className="text-[9px] text-[#0F172A] font-mono">Δs 0.2mm</span>
              </div>
              <div className="flex items-center justify-between py-1 px-1.5 hover:bg-[#F1F5F9] rounded">
                <span className="text-[#475569]">Transonic Shock Refinement</span>
                <span className="text-[9px] text-[#2563EB] font-mono">Active</span>
              </div>
              <div className="flex items-center justify-between py-1 px-1.5 hover:bg-[#F1F5F9] rounded">
                <span className="text-[#475569]">Trailing Edge Wake Box</span>
                <span className="text-[9px] text-[#64748B] font-mono">2.5c Length</span>
              </div>
            </div>
          )}
        </div>

        {/* Probes Node */}
        <div>
          <div
            onClick={() => toggleNode('probes')}
            className="flex items-center justify-between p-1 hover:bg-[#F1F5F9] rounded cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-[#0F172A] font-sans font-medium">
              {expandedNodes.probes ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />
              )}
              <CircleDot className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>Flowfield Sampling Probes</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#EFF6FF] text-[#2563EB] rounded border border-[#DBEAFE]">
              {probes.length} Active
            </span>
          </div>

          {expandedNodes.probes && (
            <div className="ml-4 pl-2 border-l border-[#E2E8F0] space-y-1 mt-0.5">
              {probes.map((p) => {
                const isSelected = selectedProbeId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectProbe(p.id)}
                    className={`flex items-center justify-between py-1 px-1.5 rounded cursor-pointer transition-colors border-l-2 ${
                      isSelected
                        ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB] font-medium'
                        : 'text-[#475569] border-transparent hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0"></span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <span className="text-[#64748B]">
                        ({p.x >= 0 ? `+${p.x.toFixed(2)}` : p.x.toFixed(2)}, {p.y >= 0 ? `+${p.y.toFixed(2)}` : p.y.toFixed(2)})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
