import React, { useState } from 'react';
import { ResidualsChart } from './ResidualsChart';
import { ForceCoefficientsPanel } from './ForceCoefficientsPanel';
import { CpDistributionPlot } from './CpDistributionPlot';
import { ProbesTable } from './ProbesTable';
import {
  ResidualPoint,
  AeroCoefficients,
  AirfoilPresetId,
  ConsoleLogMessage,
  ProbePoint
} from '../../types';
import {
  TrendingDown,
  Gauge,
  Activity,
  Table,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { LiveResultSheetDashboard } from '../Results/LiveResultSheetDashboard';

interface BottomDrawerProps {
  residuals: ResidualPoint[];
  currentIteration: number;
  coefficients: AeroCoefficients;
  mach: number;
  aoa: number;
  presetId: AirfoilPresetId;
  logs: ConsoleLogMessage[];
  onClearLogs: () => void;
  probes: ProbePoint[];
  selectedProbeId: string | null;
  onSelectProbe: (id: string) => void;
  onDeleteProbe: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const BottomDrawer: React.FC<BottomDrawerProps> = ({
  residuals,
  currentIteration,
  coefficients,
  mach,
  aoa,
  presetId,
  logs,
  onClearLogs,
  probes,
  selectedProbeId,
  onSelectProbe,
  onDeleteProbe,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'residuals' | 'forces' | 'cp' | 'probes' | 'excel_charts'>('residuals');
  const [isExpanded, setIsExpanded] = useState(false);

  const tabs = [
    {
      id: 'residuals',
      label: 'Residual Convergence',
      icon: TrendingDown,
      color: '#2563EB',
    },
    {
      id: 'forces',
      label: 'Force Coefficients (CL, CD, L/D)',
      icon: Gauge,
      color: '#10B981',
    },
    {
      id: 'cp',
      label: 'Surface Pressure (-Cp vs x/c)',
      icon: Activity,
      color: '#8B5CF6',
    },
    {
      id: 'excel_charts',
      label: 'Live Excel Sheet & Visual Charts',
      icon: FileSpreadsheet,
      color: '#059669',
      badge: 'LIVE',
    },
    {
      id: 'probes',
      label: 'Sensor Probes Data',
      icon: Table,
      color: '#EF4444',
      badge: `${probes.length}`,
    },
  ];

  return (
    <div
      className={`border-t border-[#E2E8F0] bg-white flex flex-col shrink-0 select-none z-10 transition-all duration-200 shadow-[0_-2px_6px_rgba(15,23,42,0.03)] ${
        isCollapsed ? 'h-9' : isExpanded ? 'h-[65vh] max-h-[420px]' : 'h-60 sm:h-52 md:h-56'
      }`}
    >
      {/* Bottom Drawer Tab Bar */}
      <div className="h-9 bg-[#F8FAFC] border-b border-[#E2E8F0] px-2 flex items-center justify-between text-xs shrink-0">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id && !isCollapsed;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (isCollapsed) onToggleCollapse();
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-[#0F172A] border border-[#CBD5E1] shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: tab.color }} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[9px] font-mono px-1 py-0.2 bg-[#F1F5F9] text-[#475569] rounded border border-[#E2E8F0]">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Height / Collapse Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {!isCollapsed && (
            <button
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? 'Restore Height' : 'Maximize Drawer'}
              className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Drawer' : 'Collapse Drawer'}
            className="p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded"
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden bg-white">
          {activeTab === 'residuals' && (
            <ResidualsChart residuals={residuals} currentIteration={currentIteration} />
          )}
          {activeTab === 'forces' && (
            <ForceCoefficientsPanel coefficients={coefficients} mach={mach} aoa={aoa} />
          )}
          {activeTab === 'cp' && (
            <CpDistributionPlot presetId={presetId} mach={mach} aoa={aoa} />
          )}
          {activeTab === 'excel_charts' && (
            <div className="h-full overflow-y-auto p-3">
              <LiveResultSheetDashboard
                projectName={`Airfoil ${presetId.toUpperCase()}`}
                simulationId={`SOLVER-RUN-${presetId.toUpperCase()}`}
                mach={mach}
                aoa={aoa}
                cL={coefficients.cL}
                cD={coefficients.cD}
                liftToDrag={coefficients.liftToDrag}
              />
            </div>
          )}
          {activeTab === 'probes' && (
            <ProbesTable
              probes={probes}
              selectedProbeId={selectedProbeId}
              onSelectProbe={onSelectProbe}
              onDeleteProbe={onDeleteProbe}
            />
          )}
        </div>
      )}
    </div>
  );
};
