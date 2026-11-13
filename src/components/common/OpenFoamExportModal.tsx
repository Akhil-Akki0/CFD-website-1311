import React, { useState } from 'react';
import { GeometryRecord, SimulationConfig } from '../../types';
import { generateOpenFoamCaseFiles, downloadOpenFoamCaseZip, OpenFoamFileEntry } from '../../utils/openfoamCaseGenerator';
import {
  FolderArchive,
  Download,
  FileCode,
  Check,
  Copy,
  X,
  Layers,
  Terminal,
  FolderOpen
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';

interface OpenFoamExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: GeometryRecord;
  simConfig: SimulationConfig;
  projectName?: string;
}

export const OpenFoamExportModal: React.FC<OpenFoamExportModalProps> = ({
  isOpen,
  onClose,
  geometry,
  simConfig,
  projectName = 'CFD_Simulation'
}) => {
  const [selectedPath, setSelectedPath] = useState<string>('system/controlDict');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const files = generateOpenFoamCaseFiles(geometry, simConfig, projectName);
  const selectedFile = files.find((f) => f.path === selectedPath) || files[0];

  const handleDownload = async () => {
    sound.playSave();
    setIsExporting(true);
    try {
      await downloadOpenFoamCaseZip(geometry, simConfig, projectName);
    } catch (err) {
      console.error('Failed to export ZIP:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = () => {
    sound.playClick();
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none">
      <div className="glass-surface rounded-3xl border border-white/60 shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/50 dark:border-white/10 flex items-center justify-between bg-white/30 dark:bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-400/30 flex items-center justify-center shadow-xs">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-950 dark:text-white">
                  OpenFOAM Case Generator & Exporter
                </h2>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                  v11 / v2312 COMPLIANT
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Production-ready case package for local execution, HPC clusters, or Docker container runs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="px-4.5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Packaging ZIP...' : 'Download Full Case (.ZIP)'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded-2xl hover:bg-white/40 dark:hover:bg-slate-800/40 border border-transparent hover:border-white/40 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* File Tree Explorer (Left Column) */}
          <div className="w-full md:w-64 bg-[#F8FAFC] border-r border-[#E2E8F0] p-3 overflow-y-auto flex flex-col space-y-1">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider px-2 py-1">
              Case Directory Structure ({files.length} files)
            </span>

            {files.map((file) => {
              const isSelected = file.path === selectedPath;
              const isFolder = file.path.includes('/');
              const folderName = isFolder ? file.path.split('/')[0] : '';
              const fileName = isFolder ? file.path.split('/')[1] : file.path;

              return (
                <button
                  key={file.path}
                  onClick={() => {
                    sound.playClick();
                    setSelectedPath(file.path);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#E0F2FE] text-[#0284C7] font-bold border border-[#BAE6FD]'
                      : 'text-[#475569] hover:bg-white hover:text-[#0F172A]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{file.path}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* File Viewer (Right Column) */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-3 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-2 font-mono text-xs text-[#0F172A] font-bold">
                <span>{selectedFile.path}</span>
                <span className="text-[10px] text-[#64748B] font-normal">
                  ({selectedFile.content.split('\n').length} lines)
                </span>
              </div>

              <button
                onClick={handleCopy}
                className="px-2.5 py-1 bg-white hover:bg-[#F1F5F9] text-[#0F172A] rounded border border-[#CBD5E1] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-[#10B981]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 p-4 overflow-auto bg-[#0F172A] text-[#F8FAFC] font-mono text-xs leading-relaxed">
              <pre className="whitespace-pre">{selectedFile.content}</pre>
            </div>
          </div>
        </div>

        {/* Footer Quick Instructions */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between text-xs text-[#64748B] px-5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#0284C7]" />
            <span>To run: extract archive and execute <code className="bg-[#E2E8F0] text-[#0F172A] px-1.5 py-0.5 rounded font-mono">./Allrun</code> or run in Docker</span>
          </div>
          <div className="text-[11px] font-mono text-[#475569]">
            Solvers: simpleFoam • rhoSimpleFoam • snappyHexMesh
          </div>
        </div>
      </div>
    </div>
  );
};
