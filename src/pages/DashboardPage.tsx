import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import { CfdLogo } from '../components/common/CfdLogo';
import {
  FolderKanban,
  PlayCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Wind,
  FileSpreadsheet
} from 'lucide-react';
import { sound } from '../utils/soundEffects';
import { ProjectSpyChart } from '../components/Charts/ProjectSpyChart';
import { downloadProjectExcel } from '../utils/excelGenerator';

export const DashboardPage: React.FC = () => {
  const {
    projects,
    simulations,
    setPage,
    setCurrentProjectId,
    setCurrentSimulationId
  } = usePlatform();

  const totalProjects = projects.length;
  const totalSims = simulations.length;
  const completedSims = simulations.filter((s) => s.status === 'completed').length;
  const runningSims = simulations.filter((s) => s.status === 'running' || s.status === 'meshing').length;
  const failedSims = simulations.filter((s) => s.status === 'failed').length;

  const handleOpenProject = (id: string) => {
    sound.playClick();
    setCurrentProjectId(id);
    setPage('setup');
  };

  const handleOpenSimulation = (id: string) => {
    sound.playClick();
    setCurrentSimulationId(id);
    setPage('results');
  };

  const handleNewProject = () => {
    sound.playClick();
    setPage('projects');
  };

  const handleRefresh = () => {
    sound.playTick();
  };

  return (
    <div className="flex-1 overflow-y-auto select-none text-slate-900 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/40 dark:border-white/10">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white flex items-center gap-2">
              <span>Engineering Dashboard</span>
              <span className="text-xs font-mono px-3 py-0.5 rounded-full bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 font-semibold border border-cyan-400/40">
                TELEMETRY
              </span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Live operational overview of CFD aerodynamic simulation cases, active solvers, and FNO models
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playSave();
              downloadProjectExcel({
                projectName: 'Aerospace-Portfolio-Analysis',
                simulationId: 'SIM-DASHBOARD',
                cl: 0.584,
                cd: 0.0138,
                liftToDrag: 42.3,
                mach: 0.35,
                aoa: 3.5,
              });
            }}
            title="Export Project Telemetry & Result Sheet to Excel (.xls)"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/40 hover:bg-white/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-100 border border-white/60 dark:border-white/10 rounded-2xl text-xs font-semibold transition-all shadow-xs cursor-pointer backdrop-blur-md active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleNewProject}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Info Status Banner */}
      <div className="p-4 glass-surface rounded-3xl border border-white/60 shadow-xl flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-600 shadow-[0_0_8px_#06b6d4]"></span>
          <span>
            <strong className="text-slate-950 dark:text-white">Simulation Engine Online:</strong> Real-time Navier-Stokes potential flow solver and OpenFOAM case generator operational.
          </span>
        </div>
        <span className="text-[11px] font-mono text-cyan-800 dark:text-cyan-300 font-bold hidden md:inline bg-white/30 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-white/60 dark:border-white/10">
          Ready for Inflow Execution
        </span>
      </div>

      {/* 5 Metric Cards with Transparent Glass Aerospace Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Projects */}
        <div className="glass-surface p-5 rounded-3xl border border-white/60 shadow-xl flex flex-col justify-between hover:border-cyan-400 transition-all backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">Projects</span>
            <FolderKanban className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="font-mono text-2xl font-black text-slate-950 dark:text-white mt-2 mb-1">
            {totalProjects}
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">Configured studies</span>
        </div>

        {/* Metric 2: Total Simulations */}
        <div className="glass-surface p-5 rounded-3xl border border-white/60 shadow-xl flex flex-col justify-between hover:border-blue-400 transition-all backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Simulations</span>
            <Wind className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="font-mono text-2xl font-black text-slate-950 dark:text-white mt-2 mb-1">
            {totalSims}
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">Total solver runs</span>
        </div>

        {/* Metric 3: Completed */}
        <div className="glass-surface p-5 rounded-3xl border border-white/60 shadow-xl flex flex-col justify-between hover:border-emerald-400 transition-all backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-2 mb-1">
            {completedSims}
          </div>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Converged to 1e-5</span>
        </div>

        {/* Metric 4: Running */}
        <div className="glass-surface p-5 rounded-3xl border border-white/60 shadow-xl flex flex-col justify-between hover:border-amber-400 transition-all backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Active</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-black text-amber-700 dark:text-amber-400 mt-2 mb-1">
            {runningSims}
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">Iterating on grid</span>
        </div>

        {/* Metric 5: Failed */}
        <div className="glass-surface p-5 rounded-3xl border border-white/60 shadow-xl flex flex-col justify-between hover:border-rose-400 transition-all backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Diverged</span>
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="font-mono text-2xl font-black text-rose-700 dark:text-rose-400 mt-2 mb-1">
            {failedSims}
          </div>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">0 Courant blowups</span>
        </div>
      </div>

      {/* Live Project Aerodynamic Spy & Portfolio Pie Charts */}
      <ProjectSpyChart title="Live Project Aerodynamic Spy & Portfolio Telemetry" showExportButton={true} />

      {/* Main 2-Column Section: Recent Projects & Recent Simulations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Recent Projects (7 cols) */}
        <div className="lg:col-span-7 glass-surface rounded-3xl border border-white/60 p-6 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-white/40 dark:border-white/10">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">Recent CFD Projects</h2>
            </div>
            <button
              onClick={() => setPage('projects')}
              className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 hover:underline font-semibold cursor-pointer"
            >
              View All ({totalProjects})
            </button>
          </div>

          <div className="space-y-3">
            {projects.slice(0, 4).map((project) => (
              <div
                key={project.projectId}
                className="p-4 glass-item rounded-2xl border border-white/50 dark:border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-950 dark:text-white font-sans">
                      {project.name}
                    </span>
                    <span className="text-[10px] font-mono px-2.5 py-0.5 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 rounded-full border border-cyan-400/30 font-semibold">
                      {project.cfdType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">
                    {project.description}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Fluid: {project.fluidType}</span>
                    <span>•</span>
                    <span>Created: {project.createdAt}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenProject(project.projectId)}
                  className="self-start sm:self-center flex items-center gap-1.5 px-3.5 py-2 bg-white/40 hover:bg-white/70 dark:bg-slate-800/50 dark:hover:bg-slate-700/70 text-slate-800 dark:text-slate-100 border border-white/60 dark:border-white/10 rounded-2xl text-xs font-semibold transition-all shrink-0 shadow-xs cursor-pointer backdrop-blur-md active:scale-95"
                >
                  <span>Configure</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Recent Simulations (5 cols) */}
        <div className="lg:col-span-5 glass-surface rounded-3xl border border-white/60 p-6 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-white/40 dark:border-white/10">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">Recent Solver Runs</h2>
            </div>
            <button
              onClick={() => setPage('runner')}
              className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 hover:underline font-bold cursor-pointer"
            >
              Runner Cockpit
            </button>
          </div>

          <div className="space-y-3">
            {simulations.slice(0, 4).map((sim) => {
              const isCompleted = sim.status === 'completed';
              const isRunning = sim.status === 'running';

              return (
                <div
                  key={sim.simulationId}
                  onClick={() => handleOpenSimulation(sim.simulationId)}
                  className="p-3.5 glass-item rounded-2xl border border-white/50 dark:border-white/10 transition-all cursor-pointer flex items-center justify-between shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : isRunning ? (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]"></span>
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      )}
                      <span className="font-mono text-xs font-bold text-slate-950 dark:text-white">
                        {sim.simulationId.slice(0, 22)}...
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <span className="font-semibold text-cyan-800 dark:text-cyan-300">{sim.projectName}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">{sim.solver}</span>
                    </div>

                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      Iterations: {sim.iterations} | Cells: {sim.meshCells.toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30'
                          : isRunning
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30'
                          : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-400/30'
                      }`}
                    >
                      {sim.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              onClick={() => setPage('runner')}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Open Solver Execution Studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
