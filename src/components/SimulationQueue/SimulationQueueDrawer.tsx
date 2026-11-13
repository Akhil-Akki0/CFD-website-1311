import React, { useState, useEffect, useRef } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { SimulationJob, JobStatus } from '../../types';
import { sound } from '../../utils/soundEffects';
import {
  ListOrdered,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  X,
  Terminal,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  FolderArchive,
  Filter,
  Plus,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SimulationQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOpenFoamModal?: () => void;
}

export const SimulationQueueDrawer: React.FC<SimulationQueueDrawerProps> = ({
  isOpen,
  onClose,
  onOpenOpenFoamModal,
}) => {
  const {
    queue,
    activeJobId,
    setActiveJobId,
    pauseJob,
    resumeJob,
    cancelJob,
    retryJob,
    deleteJob,
    addJobToQueue,
    clearCompletedJobs,
    geometries,
    simConfig,
    themeMode,
  } = usePlatform();

  const [statusFilter, setStatusFilter] = useState<'ALL' | JobStatus>('ALL');
  const [selectedJobId, setSelectedJobId] = useState<string>(activeJobId || (queue[0]?.id ?? ''));
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);

  // New Job form state
  const [newJobName, setNewJobName] = useState('Subsonic Airfoil AoA 6°');
  const [newJobAoA, setNewJobAoA] = useState(6.0);
  const [newJobVel, setNewJobVel] = useState(35.0);
  const [newJobSolver, setNewJobSolver] = useState('simpleFoam');

  const logEndRef = useRef<HTMLDivElement>(null);

  const activeJob = queue.find((j) => j.id === (selectedJobId || activeJobId)) || queue[0];

  useEffect(() => {
    if (activeJobId && !selectedJobId) {
      setSelectedJobId(activeJobId);
    }
  }, [activeJobId, selectedJobId]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeJob?.logs]);

  if (!isOpen) return null;

  const filteredJobs = queue.filter((j) => {
    if (statusFilter === 'ALL') return true;
    return j.status === statusFilter;
  });

  const handleCopyLogs = () => {
    if (!activeJob) return;
    navigator.clipboard.writeText(activeJob.logs.join('\n'));
    setCopiedLogs(true);
    sound.playClick();
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playSave();
    addJobToQueue({
      name: newJobName,
      geometryName: geometries[0]?.name || 'NACA 0012 Airfoil',
      solver: newJobSolver,
      aoa: Number(newJobAoA),
      velocity: Number(newJobVel),
    });
    setShowAddJobModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm select-none">
      <div className="w-full max-w-5xl h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/60 glass-surface backdrop-blur-md text-slate-900 dark:text-slate-100 transition-colors">
        {/* Drawer Header */}
        <div className="p-4 sm:px-6 border-b border-white/50 dark:border-white/10 flex items-center justify-between bg-white/30 dark:bg-slate-900/40 backdrop-blur-md transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-400/30 flex items-center justify-center shadow-xs">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Simulation Queue Manager & Live Terminal
                </h2>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-400/30">
                  {queue.filter((j) => j.status === 'running').length} RUNNING • {queue.length} JOBS
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Real-time OpenFOAM daemon scheduler, live residual streaming, and automatic topology failover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddJobModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-2xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enqueue Job</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-slate-800/40 border border-transparent hover:border-white/40 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body (Two Columns: Queue List & Terminal Logs) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left Column: Job Queue List */}
          <div className={`w-full lg:w-96 border-r flex flex-col overflow-hidden max-h-[38vh] lg:max-h-none shrink-0 ${
            themeMode === 'dark' ? 'bg-[#131D31] border-slate-700' : 'bg-[#F8FAFC] border-[#E2E8F0]'
          }`}>
            {/* Filter Tabs & Queue Controls */}
            <div className="p-3 border-b border-inherit flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                {(['ALL', 'running', 'queued', 'completed', 'failed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      sound.playClick();
                      setStatusFilter(filter);
                    }}
                    className={`px-2 py-1 rounded-md capitalize font-medium transition-colors cursor-pointer ${
                      statusFilter === filter
                        ? 'bg-[#0284C7] text-white font-bold'
                        : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {queue.some((j) => j.status === 'completed') && (
                <button
                  onClick={clearCompletedJobs}
                  title="Clear completed jobs"
                  className="text-[10px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded hover:bg-slate-200/50 cursor-pointer"
                >
                  Clear Done
                </button>
              )}
            </div>

            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredJobs.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#94A3B8]">
                  No jobs match filter <span className="font-semibold">{statusFilter}</span>
                </div>
              ) : (
                filteredJobs.map((job) => {
                  const isSelected = activeJob?.id === job.id;
                  const isRunning = job.status === 'running';

                  return (
                    <div
                      key={job.id}
                      onClick={() => {
                        sound.playClick();
                        setSelectedJobId(job.id);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'border-[#0284C7] bg-[#E0F2FE]/40 dark:bg-blue-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white/70 dark:bg-slate-900/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              job.status === 'running'
                                ? 'bg-[#0284C7] shadow-[0_0_8px_#0284c7]'
                                : job.status === 'completed'
                                ? 'bg-[#10B981]'
                                : job.status === 'failed'
                                ? 'bg-[#EF4444]'
                                : 'bg-[#F59E0B]'
                            }`}
                          />
                          <span className="font-bold text-xs truncate">{job.name}</span>
                        </div>

                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            job.status === 'running'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : job.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                              : job.status === 'failed'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>

                      {/* Info & Progress */}
                      <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-2 font-mono">
                        <span>{job.solver} • α = {job.aoa}° • {job.velocity} m/s</span>
                        <span>{job.progress}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all duration-300 ${
                            job.status === 'completed'
                              ? 'bg-[#10B981]'
                              : job.status === 'failed'
                              ? 'bg-[#EF4444]'
                              : 'bg-[#0284C7]'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>

                      {/* Topology & Solver Fallback Badge */}
                      {job.syntheticWakeActive && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900 mb-2 font-mono">
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          <span>checkMesh Fallback: Synthetic Wake Active</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] text-[#94A3B8] font-mono">
                          {job.status === 'completed' && `CL: ${job.cL.toFixed(2)} | CD: ${job.cD.toFixed(4)}`}
                          {job.status === 'running' && `Iter: ${job.iteration}/${job.maxIterations}`}
                          {job.status === 'queued' && 'Pending queue worker'}
                          {job.status === 'failed' && (job.errorMessage || 'Solver Diverged')}
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {job.status === 'running' ? (
                            <button
                              onClick={() => pauseJob(job.id)}
                              title="Pause Job"
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : job.status === 'paused' ? (
                            <button
                              onClick={() => resumeJob(job.id)}
                              title="Resume Job"
                              className="p-1 hover:bg-blue-100 rounded text-blue-600"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          ) : null}

                          {(job.status === 'failed' || job.status === 'completed') && (
                            <button
                              onClick={() => retryJob(job.id)}
                              title="Retry Job"
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {job.status === 'running' && (
                            <button
                              onClick={() => cancelJob(job.id)}
                              title="Cancel Job"
                              className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 rounded text-rose-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => deleteJob(job.id)}
                            title="Delete from Queue"
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Live Terminal Output */}
          <div className="flex-1 flex flex-col bg-[#090D16] text-[#F8FAFC] font-mono overflow-hidden">
            {/* Terminal Header */}
            <div className="px-4 py-2.5 bg-[#111827] border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#0284C7]" />
                <span className="font-bold text-slate-200">{activeJob?.name || 'Solver Console'}</span>
                <span className="text-[11px] text-slate-500">[{activeJob?.solver || 'simpleFoam'}]</span>
              </div>

              <div className="flex items-center gap-2">
                {onOpenOpenFoamModal && (
                  <button
                    onClick={onOpenOpenFoamModal}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-sans font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>Export OpenFOAM Case</span>
                  </button>
                )}

                <button
                  onClick={handleCopyLogs}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-sans font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Live Terminal Log Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-1 text-xs leading-relaxed font-mono">
              {activeJob?.logs && activeJob.logs.length > 0 ? (
                activeJob.logs.map((line, idx) => {
                  const isResidual = line.includes('residual') || line.includes('Residual');
                  const isSuccess = line.includes('CONVERGED') || line.includes('success');
                  const isWarning = line.includes('WARNING') || line.includes('Fallback');
                  const isError = line.includes('ERROR') || line.includes('Diverged');

                  let textColor = 'text-slate-300';
                  if (isSuccess) textColor = 'text-emerald-400 font-bold';
                  else if (isWarning) textColor = 'text-amber-400';
                  else if (isError) textColor = 'text-rose-400 font-bold';
                  else if (isResidual) textColor = 'text-cyan-300';

                  return (
                    <div key={idx} className={`${textColor} hover:bg-slate-900/80 px-1 rounded transition-colors break-all whitespace-pre-wrap`}>
                      <span className="text-slate-600 mr-2 text-[10px] select-none">
                        {String(idx + 1).padStart(3, '0')}
                      </span>
                      {line}
                    </div>
                  );
                })
              ) : (
                <div className="text-slate-500 italic py-8 text-center">
                  Select a simulation job from the queue to view its live execution stream.
                </div>
              )}
              <div ref={logEndRef} />
            </div>

            {/* Live Telemetry Footer */}
            {activeJob && (
              <div className="px-4 py-2 bg-[#111827] border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10px] sm:text-[11px] text-slate-400">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <span>Cont: <strong className="text-cyan-400">{activeJob.residuals.continuity.toExponential(2)}</strong></span>
                  <span>Ux: <strong className="text-cyan-400">{activeJob.residuals.xMomentum.toExponential(2)}</strong></span>
                  <span>k: <strong className="text-cyan-400">{activeJob.residuals.kTurbulence.toExponential(2)}</strong></span>
                  <span>ω: <strong className="text-cyan-400">{activeJob.residuals.omegaDissipation.toExponential(2)}</strong></span>
                </div>
                <div>
                  Elapsed: <strong className="text-slate-200">{activeJob.executionTimeSeconds.toFixed(1)}s</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enqueue Modal */}
      {showAddJobModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${
            themeMode === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-black mb-3">Add Simulation to Execution Queue</h3>
            <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Job Name</label>
                <input
                  type="text"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Angle of Attack (AoA °)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newJobAoA}
                    onChange={(e) => setNewJobAoA(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Inlet Velocity (m/s)</label>
                  <input
                    type="number"
                    value={newJobVel}
                    onChange={(e) => setNewJobVel(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">OpenFOAM Solver</label>
                <select
                  value={newJobSolver}
                  onChange={(e) => setNewJobSolver(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                >
                  <option value="simpleFoam">simpleFoam (Incompressible Steady RANS)</option>
                  <option value="rhoSimpleFoam">rhoSimpleFoam (Compressible Transonic)</option>
                  <option value="pisoFoam">pisoFoam (Transient Vortex Shedding)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddJobModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold"
                >
                  Enqueue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
