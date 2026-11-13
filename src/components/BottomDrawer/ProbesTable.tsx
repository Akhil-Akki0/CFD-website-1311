import React from 'react';
import { ProbePoint } from '../../types';
import { CircleDot, Trash2, Eye } from 'lucide-react';

interface ProbesTableProps {
  probes: ProbePoint[];
  selectedProbeId: string | null;
  onSelectProbe: (id: string) => void;
  onDeleteProbe: (id: string) => void;
}

export const ProbesTable: React.FC<ProbesTableProps> = ({
  probes,
  selectedProbeId,
  onSelectProbe,
  onDeleteProbe,
}) => {
  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-auto p-2.5 select-none font-mono text-[11px]">
      <table className="w-full min-w-[580px] text-left border-collapse">
        <thead>
          <tr className="border-b border-[#E2E8F0] text-[10px] text-[#64748B] uppercase tracking-wider bg-[#F8FAFC]">
            <th className="py-1.5 px-2 sticky left-0 bg-[#F8FAFC] z-10">Probe Identifier</th>
            <th className="py-1.5 px-2">X/c</th>
            <th className="py-1.5 px-2">Y/c</th>
            <th className="py-1.5 px-2">Mach (M)</th>
            <th className="py-1.5 px-2">Cp</th>
            <th className="py-1.5 px-2">|U| (m/s)</th>
            <th className="py-1.5 px-2">Pressure (kPa)</th>
            <th className="py-1.5 px-2">Temp (K)</th>
            <th className="py-1.5 px-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A] tabular-nums">
          {probes.map((p) => {
            const isSelected = selectedProbeId === p.id;
            return (
              <tr
                key={p.id}
                onClick={() => onSelectProbe(p.id)}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <td className={`py-1.5 px-2 flex items-center gap-1.5 font-sans font-semibold sticky left-0 z-10 ${
                  isSelected ? 'bg-[#EFF6FF]' : 'bg-white'
                }`}>
                  <CircleDot className="w-3 h-3 text-[#EF4444]" />
                  <span>{p.name}</span>
                </td>
                <td className="py-1.5 px-2">{p.x.toFixed(3)}</td>
                <td className="py-1.5 px-2">{p.y.toFixed(3)}</td>
                <td className="py-1.5 px-2 font-bold text-[#2563EB]">{p.mach.toFixed(3)}</td>
                <td className="py-1.5 px-2 font-bold">{p.cp.toFixed(3)}</td>
                <td className="py-1.5 px-2">{Math.hypot(p.u, p.v).toFixed(1)}</td>
                <td className="py-1.5 px-2">{(p.p / 1000).toFixed(1)}</td>
                <td className="py-1.5 px-2">{p.t.toFixed(1)}</td>
                <td className="py-1.5 px-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProbe(p.id);
                    }}
                    title="Remove Probe"
                    className="p-1 hover:bg-[#FEE2E2] text-[#94A3B8] hover:text-[#EF4444] rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
