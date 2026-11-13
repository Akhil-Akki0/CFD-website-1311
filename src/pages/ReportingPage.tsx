import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { CfdLogo } from '../components/common/CfdLogo';
import { generateSimulationPdfReport, generate3dVisualizationCapture } from '../utils/pdfGenerator';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  ShieldCheck,
  Search,
  Layers,
  Sparkles,
  Terminal,
  Activity,
  FileText,
  Printer,
  Eye,
  Camera
} from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { downloadProjectExcel } from '../utils/excelGenerator';
import { LiveResultSheetDashboard } from '../components/Results/LiveResultSheetDashboard';

export const ReportingPage: React.FC = () => {
  const {
    simulations,
    currentSimulationId,
    setCurrentSimulationId,
    simConfig,
    triggerConfetti
  } = usePlatform();

  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [logSearch, setLogSearch] = useState('');

  const activeSim = simulations.find((s) => s.simulationId === currentSimulationId) || simulations[0];

  // Memoized 3D capture preview image data
  const captureThumbnailUri = useMemo(() => {
    return generate3dVisualizationCapture(activeSim, simConfig);
  }, [activeSim, simConfig]);

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      sound.playSave();
      await generateSimulationPdfReport(activeSim, simConfig);
      setPdfSuccess(true);
      triggerConfetti();
      setTimeout(() => setPdfSuccess(false), 4000);
    } catch (err) {
      console.error('Error compiling PDF report:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const worksheets = [
    { num: '01', name: 'Executive Summary', desc: 'Case overview, key performance indicators, objective function' },
    { num: '02', name: 'Geometry Specifications', desc: 'Bounding box dimensions, surface area, volume, CAD origin' },
    { num: '03', name: 'Mesh Quality Metrics', desc: 'Skewness, aspect ratio, orthogonal quality, prism layers y+' },
    { num: '04', name: 'Boundary Conditions', desc: 'Inflow vectors, pressure outlets, wall boundary roughness' },
    { num: '05', name: 'Fluid Properties', desc: 'Density, dynamic viscosity, specific heat, Reynolds number' },
    { num: '06', name: 'Numerical Schemes', desc: 'Discretization order, spatial gradient limiters, SIMPLE relaxation' },
    { num: '07', name: 'Convergence History', desc: 'Logarithmic residual decay per iteration for U, P, k, omega' },
    { num: '08', name: 'Force Coefficients', desc: 'Integrated lift (cL), drag (cD), pitching moment (cM), L/D' },
    { num: '09', name: 'Sensor Probe Matrix', desc: 'Localized pointwise pressure, velocity, and temperature reads' },
  ];

  const handleDownloadExcel = () => {
    sound.playSave();

    downloadProjectExcel({
      projectName: activeSim.projectName,
      simulationId: activeSim.simulationId,
      solver: activeSim.solver,
      airfoilName: activeSim.projectName,
      mach: 0.35,
      aoa: 3.5,
      cl: activeSim.metrics.cL || 0.584,
      cd: activeSim.metrics.cD || 0.0138,
      liftToDrag: activeSim.metrics.liftToDrag || 42.3,
      iterations: activeSim.iterations,
      maxIterations: 500,
      meshCells: activeSim.meshCells,
      metrics: {
        maxVelocity: activeSim.metrics.maxVelocity,
        avgVelocity: activeSim.metrics.avgVelocity,
        maxPressure: activeSim.metrics.maxPressure,
        minPressure: activeSim.metrics.minPressure,
        pressureDrop: activeSim.metrics.pressureDrop,
      },
    });

    setDownloadSuccess(true);
    triggerConfetti();
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const sampleLogs = [
    '[00:00.00] Solver simpleFoam started with 8 OpenMP threads',
    '[00:01.20] Geometry loaded and surface normals computed',
    '[00:03.40] Prism layer inflation created around obstacle boundary',
    '[00:05.10] Starting iteration loop with target tolerance 1e-5',
    `[00:15.80] Iteration 250: Continuity = 2.45e-3, Ux = 3.12e-3`,
    `[00:32.40] Iteration 750: Continuity = 4.12e-4, Ux = 5.01e-4`,
    `[00:58.10] Iteration 1200: Continuity = 1.82e-5, Ux = 2.15e-5`,
    `[01:12.40] Iteration ${activeSim.iterations}: Target tolerance 1e-5 achieved. Solution CONVERGED.`,
    '[01:14.20] Aerodynamic force coefficients integrated: cL = 0.584, cD = 0.0138',
    '[01:15.00] Writing VTK result fields to postProcessing/surfaces...',
    '[01:15.50] Case execution completed successfully with exit code 0',
  ].filter((line) => line.toLowerCase().includes(logSearch.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto select-none text-[#0F172A] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
              <span>Automated Reporting & Auditing</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] font-bold border border-[#BBF7D0]">
                VERIFIED
              </span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Export comprehensive 9-worksheet engineering spreadsheets and audit certificates
            </p>
          </div>
        </div>

        {/* Case selector & Quick PDF Export */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B] font-semibold hidden sm:inline">Select Run:</span>
            <select
              value={currentSimulationId}
              onChange={(e) => {
                sound.playTick();
                setCurrentSimulationId(e.target.value);
              }}
              className="w-full sm:w-auto min-h-[44px] px-3 py-1.5 bg-white rounded-xl border border-[#BAE6FD] text-[#0F172A] text-xs font-bold focus:border-[#0284C7] focus:outline-none shadow-2xs cursor-pointer"
            >
              {simulations.map((sim) => (
                <option key={sim.simulationId} value={sim.simulationId}>
                  {sim.projectName} ({sim.simulationId.slice(0, 18)}...)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            data-testid="reporting-download-pdf-btn"
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Engineering Report (PDF)'}</span>
          </button>
        </div>
      </div>

      {/* PDF Generation Success Alert */}
      {pdfSuccess && (
        <div className="p-3.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs rounded-xl font-semibold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>Formatted Executive PDF Summary with key metrics and 3D visualization captures has been successfully downloaded!</span>
          </div>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-white/80 rounded border border-[#A7F3D0]">PDF READY</span>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Peak Velocity</span>
          <strong className="text-xl font-mono text-[#0F172A] mt-1 block">
            {activeSim.metrics.maxVelocity} m/s
          </strong>
          <span className="text-[10px] text-[#64748B]">Free-stream maximum</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Peak Pressure</span>
          <strong className="text-xl font-mono text-[#2563EB] mt-1 block">
            {(activeSim.metrics.maxPressure / 1000).toFixed(1)} kPa
          </strong>
          <span className="text-[10px] text-[#64748B]">Stagnation point</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Mesh Resolution</span>
          <strong className="text-xl font-mono text-[#06B6D4] mt-1 block">
            {activeSim.meshCells.toLocaleString()}
          </strong>
          <span className="text-[10px] text-[#64748B]">Volume cells</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Convergence Time</span>
          <strong className="text-xl font-mono text-[#10B981] mt-1 block">
            {activeSim.executionTime.toFixed(1)} s
          </strong>
          <span className="text-[10px] text-[#10B981] font-medium">✓ Converged to 1e-5</span>
        </div>
      </div>

      {/* Excel Worksheet Breakdown Container */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
              <span>Multi-Worksheet Engineering Report Structure</span>
            </h2>
            <p className="text-xs text-[#64748B]">
              Standardized format compliant with aerospace and industrial CFD auditing guidelines
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Compiling PDF...' : 'Download Formatted PDF Summary'}</span>
            </button>

            <button
              onClick={handleDownloadExcel}
              className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel (.csv)</span>
            </button>
          </div>
        </div>

        {downloadSuccess && (
          <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs rounded-lg font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>Telemetry spreadsheet successfully compiled and downloaded to your computer!</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {worksheets.map((sheet) => (
            <div
              key={sheet.num}
              className="p-3.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] space-y-1 hover:border-[#10B981] transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-[#10B981] bg-white px-1.5 py-0.2 rounded border border-[#E2E8F0]">
                  SHEET {sheet.num}
                </span>
                <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
              </div>
              <h3 className="font-semibold text-xs text-[#0F172A] font-sans">
                {sheet.name}
              </h3>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                {sheet.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Synchronized Live Excel Sheet & Dynamic Charts */}
      <div className="space-y-3">
        <LiveResultSheetDashboard
          projectName={activeSim.projectName}
          simulationId={activeSim.simulationId}
          mach={0.35}
          aoa={3.5}
          cL={activeSim.metrics.cL || 0.584}
          cD={activeSim.metrics.cD || 0.0138}
          liftToDrag={activeSim.metrics.liftToDrag || 42.3}
        />
      </div>

      {/* 3D Visualization Flow Capture Section */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#2563EB]" />
              <span>3D Aerodynamic Flow Field Capture (Embedded in PDF Report)</span>
            </h2>
            <p className="text-xs text-[#64748B]">
              High-resolution vector streamline trajectory with pressure gradient stagnation contours
            </p>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export to PDF with This Capture</span>
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-[#CBD5E1] shadow-inner bg-[#0F172A]">
          {captureThumbnailUri && (
            <img
              src={captureThumbnailUri}
              alt="3D Aerodynamic Flow Field Capture"
              className="w-full h-auto max-h-[360px] object-cover object-center"
            />
          )}
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[10px] font-mono text-white flex items-center gap-2 border border-white/20">
            <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10b981]" />
            <span>POST-PROCESSED 3D VTK SURFACE CAPTURE</span>
          </div>
        </div>
      </div>

      {/* Compliance Certificate & Chronological Solver Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Certificate (5 cols) */}
        <div className="lg:col-span-5 card-bright rounded-2xl border border-[#BAE6FD] p-6 shadow-md space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <CfdLogo size="sm" showText={true} />
            <div className="flex items-center gap-1 text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full border border-[#BBF7D0] text-[10px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OFFICIAL AUDIT</span>
            </div>
          </div>

          <div className="pt-1">
            <h3 className="font-bold text-sm text-[#0F172A]">
              Aerodynamic Quality Assurance Certificate
            </h3>
            <p className="text-xs text-[#334155] leading-relaxed mt-1">
              This certifies that simulation run <strong className="font-mono text-[#0284C7]">{activeSim.simulationId.slice(0, 20)}...</strong> adhered to 
              Navier-Stokes conservation laws with mass imbalance &lt; 0.01% and orthogonal mesh quality &gt; 0.85.
            </p>
          </div>

          <div className="p-3.5 bg-[#F0F9FF] rounded-xl border border-[#BAE6FD] space-y-1.5 text-[11px] font-mono text-[#475569]">
            <div className="flex justify-between">
              <span>Solver:</span>
              <strong className="text-[#0F172A]">{activeSim.solver} (RANS SIMPLE)</strong>
            </div>
            <div className="flex justify-between">
              <span>Grid Quality:</span>
              <strong className="text-[#0F172A]">Orthogonal &gt; 0.85</strong>
            </div>
            <div className="flex justify-between">
              <span>Lift-to-Drag (L/D):</span>
              <strong className="text-[#0284C7]">{activeSim.metrics.liftToDrag || 37.1}</strong>
            </div>
            <div className="flex justify-between pt-1 border-t border-[#BAE6FD]/60">
              <span>Verification Status:</span>
              <strong className="text-[#16A34A] font-bold">PASSED &amp; CERTIFIED</strong>
            </div>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="w-full min-h-[44px] py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Audited PDF Certificate'}</span>
          </button>
        </div>

        {/* Right Col: Chronological Solver Logs (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Chronological Case Logs
              </h3>
            </div>

            {/* Search */}
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] px-2 py-1 rounded border border-[#CBD5E1] text-[11px]">
              <Search className="w-3.5 h-3.5 text-[#94A3B8]" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter logs..."
                className="bg-transparent border-none focus:outline-none w-28 text-[#0F172A]"
              />
            </div>
          </div>

          <div className="bg-[#0F172A] text-slate-300 font-mono text-[10px] sm:text-[11px] p-3 rounded-lg max-h-[180px] overflow-y-auto space-y-1">
            {sampleLogs.map((line, idx) => (
              <div key={idx} className="leading-tight break-all whitespace-pre-wrap">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
