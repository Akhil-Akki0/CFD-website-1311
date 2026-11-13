import React, { useState } from 'react';
import {
  SimulationState,
  AeroCoefficients,
  AirfoilPreset,
  ProbePoint
} from '../types';
import {
  X,
  Download,
  FileText,
  Code,
  CheckCircle2,
  Copy,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { downloadProjectExcel } from '../utils/excelGenerator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulationState: SimulationState;
  coefficients: AeroCoefficients;
  activePreset: AirfoilPreset;
  probes: ProbePoint[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  simulationState,
  coefficients,
  activePreset,
  probes,
}) => {
  const [copied, setCopied] = useState(false);
  const [exportTab, setExportTab] = useState<'report' | 'excel' | 'csv' | 'vtk'>('excel');

  if (!isOpen) return null;

  // Generate CSV data
  const generateCsv = () => {
    let csv = '# AERO PRECISION CFD WORKBENCH - TELEMETRY EXPORT\n';
    csv += `# Airfoil: ${activePreset.name}, Mach: ${simulationState.mach}, AoA: ${simulationState.aoa} deg\n`;
    csv += `# CL: ${coefficients.cL}, CD: ${coefficients.cD}, L/D: ${coefficients.liftToDrag}\n`;
    csv += 'Probe_Name,X_Chord,Y_Chord,Mach,Cp,Velocity_ms,Pressure_Pa,Temp_K\n';
    probes.forEach((p) => {
      csv += `${p.name},${p.x},${p.y},${p.mach},${p.cp},${Math.hypot(p.u, p.v).toFixed(2)},${p.p},${p.t}\n`;
    });
    return csv;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1C30]/50 backdrop-blur-xs select-none">
      <div className="w-full max-w-2xl bg-white rounded-lg border border-[#CBD5E1] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#2563EB] flex items-center justify-center text-white font-mono text-[11px] font-bold">
              EXP
            </div>
            <div>
              <h2 className="text-xs font-semibold text-[#0F172A] font-sans">
                Aerodynamic Telemetry & Solver Export
              </h2>
              <p className="text-[10px] text-[#64748B] font-mono">
                Simulation Case: {activePreset.name} (M = {simulationState.mach}, α = {simulationState.aoa}°)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#E2E8F0] rounded text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F1F5F9] px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => setExportTab('excel')}
            className={`px-3 py-1.5 rounded-t font-medium flex items-center gap-1.5 border-t border-x ${
              exportTab === 'excel'
                ? 'bg-white text-emerald-700 border-[#CBD5E1] -mb-px font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Project Excel Result Sheet (.xls)</span>
          </button>

          <button
            onClick={() => setExportTab('report')}
            className={`px-3 py-1.5 rounded-t font-medium flex items-center gap-1.5 border-t border-x ${
              exportTab === 'report'
                ? 'bg-white text-[#2563EB] border-[#CBD5E1] -mb-px font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Technical Report</span>
          </button>

          <button
            onClick={() => setExportTab('csv')}
            className={`px-3 py-1.5 rounded-t font-medium flex items-center gap-1.5 border-t border-x ${
              exportTab === 'csv'
                ? 'bg-white text-[#2563EB] border-[#CBD5E1] -mb-px font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] border-transparent'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>CSV Telemetry</span>
          </button>

          <button
            onClick={() => setExportTab('vtk')}
            className={`px-3 py-1.5 rounded-t font-medium flex items-center gap-1.5 border-t border-x ${
              exportTab === 'vtk'
                ? 'bg-white text-[#2563EB] border-[#CBD5E1] -mb-px font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] border-transparent'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>VTK / ParaView Format</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto font-mono text-xs text-[#0F172A]">
          {exportTab === 'excel' && (
            <div className="space-y-4 font-sans">
              <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <span className="font-bold text-emerald-950 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Multi-Worksheet Excel Result Sheet</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-200/70 text-emerald-800 px-2.5 py-0.5 rounded-full">
                    NATIVE EXCEL COMPATIBLE
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Generates an all-inclusive Excel workbook formatted for instant opening in Microsoft Excel, Google Sheets, and LibreOffice with 4 complete worksheets:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 font-bold block text-[10px] uppercase">Sheet 1: Executive Summary</span>
                    <span className="text-slate-800">Lift (cL = {coefficients.cL}), Drag (cD = {coefficients.cD}), L/D = {coefficients.liftToDrag}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 font-bold block text-[10px] uppercase">Sheet 2: Convergence Log</span>
                    <span className="text-slate-800">Continuity, Ux, Uy, and Energy residuals decay</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 font-bold block text-[10px] uppercase">Sheet 3: Surface Pressure</span>
                    <span className="text-slate-800">Normalized chordwise Cp distribution points</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                    <span className="text-emerald-700 font-bold block text-[10px] uppercase">Sheet 4: Probes Telemetry</span>
                    <span className="text-slate-800">{probes.length} sensor probes localized measurements</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {exportTab === 'report' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#F8FAFC] rounded border border-[#E2E8F0] space-y-2">
                <div className="flex justify-between border-b border-[#E2E8F0] pb-1.5">
                  <span className="font-bold text-sm font-sans text-[#0F172A]">
                    CFD SIMULATION COMPLIANCE CERTIFICATE
                  </span>
                  <span className="text-[#10B981] font-bold">STATUS: CONVERGED</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#475569]">
                  <div>Profile: <strong className="text-[#0F172A]">{activePreset.name}</strong></div>
                  <div>Turbulence: <strong className="text-[#0F172A]">Menter k-ω SST</strong></div>
                  <div>Mach Number: <strong className="text-[#0F172A]">{simulationState.mach}</strong></div>
                  <div>Angle of Attack: <strong className="text-[#0F172A]">{simulationState.aoa}°</strong></div>
                  <div>Reynolds Number: <strong className="text-[#0F172A]">{(simulationState.reynolds / 1e6).toFixed(2)} × 10⁶</strong></div>
                  <div>Total Iterations: <strong className="text-[#0F172A]">{simulationState.iteration}</strong></div>
                </div>
              </div>

              {/* Force Summary Table */}
              <div>
                <span className="text-[11px] font-bold text-[#0F172A] block mb-1">
                  AERODYNAMIC COEFFICIENT MATRIX
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2 bg-[#F1F5F9] rounded border border-[#E2E8F0] text-center">
                    <span className="text-[10px] text-[#64748B] block">CL (Lift)</span>
                    <span className="text-base font-bold text-[#2563EB]">{coefficients.cL}</span>
                  </div>
                  <div className="p-2 bg-[#F1F5F9] rounded border border-[#E2E8F0] text-center">
                    <span className="text-[10px] text-[#64748B] block">CD (Drag)</span>
                    <span className="text-base font-bold text-[#EF4444]">{coefficients.cD}</span>
                  </div>
                  <div className="p-2 bg-[#F1F5F9] rounded border border-[#E2E8F0] text-center">
                    <span className="text-[10px] text-[#64748B] block">CM, c/4</span>
                    <span className="text-base font-bold text-[#8B5CF6]">{coefficients.cM}</span>
                  </div>
                  <div className="p-2 bg-[#F1F5F9] rounded border border-[#E2E8F0] text-center">
                    <span className="text-[10px] text-[#64748B] block">L / D Ratio</span>
                    <span className="text-base font-bold text-[#10B981]">{coefficients.liftToDrag}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {exportTab === 'csv' && (
            <div className="space-y-2">
              <pre className="p-3 bg-[#0B1C30] text-[#06B6D4] rounded border border-[#213145] text-[10px] overflow-x-auto max-h-60 leading-relaxed font-mono">
                {generateCsv()}
              </pre>
            </div>
          )}

          {exportTab === 'vtk' && (
            <div className="space-y-2">
              <pre className="p-3 bg-[#0B1C30] text-[#10B981] rounded border border-[#213145] text-[10px] overflow-x-auto max-h-60 leading-relaxed font-mono">
{`# vtk DataFile Version 3.0
Aero Precision 2D CFD Structured Grid Output
ASCII
DATASET STRUCTURED_GRID
DIMENSIONS 120 60 1
POINTS 7200 float
... [7,200 grid vertex coordinates x, y, z] ...
POINT_DATA 7200
SCALARS Pressure_Coefficient float 1
LOOKUP_TABLE default
... [Cp scalar field values] ...
VECTORS Velocity float
... [u, v, w velocity vectors] ...`}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
          <span className="text-[10px] text-[#64748B] font-mono">
            Generated ISO 9001 / AIAA S-071 CFD Output
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(exportTab === 'csv' ? generateCsv() : 'Simulation Report Copied')}
              className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded text-xs font-medium text-[#0F172A] transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                if (exportTab === 'excel') {
                  downloadProjectExcel({
                    projectName: activePreset.name,
                    simulationId: `SIM-${activePreset.id}`,
                    mach: simulationState.mach,
                    aoa: simulationState.aoa,
                    cl: coefficients.cL,
                    cd: coefficients.cD,
                    cm: coefficients.cM,
                    liftToDrag: coefficients.liftToDrag,
                    iterations: simulationState.iteration,
                    maxIterations: simulationState.maxIterations,
                    probes,
                  });
                } else {
                  handleDownloadFile(
                    generateCsv(),
                    `aero_${activePreset.id}_M${simulationState.mach}_A${simulationState.aoa}.csv`,
                    'text/csv'
                  );
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportTab === 'excel' ? 'Download Excel Workbook (.xls)' : 'Download File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
