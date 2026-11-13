import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { CfdType, FluidType, SimulationType } from '../types';
import { CfdLogo } from '../components/common/CfdLogo';
import {
  FolderKanban,
  Plus,
  ArrowRight,
  Trash2,
  Settings,
  CheckCircle2,
  Wind,
  Layers,
  Sparkles,
  Search
} from 'lucide-react';
import { sound } from '../utils/soundEffects';

export const ProjectsPage: React.FC = () => {
  const {
    projects,
    createProject,
    deleteProject,
    setCurrentProjectId,
    setPage
  } = usePlatform();

  const [activeTab, setActiveTab] = useState<'all' | 'create'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [cfdType, setCfdType] = useState<CfdType>('External Aerodynamics');
  const [fluidType, setFluidType] = useState<FluidType>('Air');
  const [simulationType, setSimulationType] = useState<SimulationType>('Steady State');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Project name is required.');
      return;
    }
    if (name.trim().length < 3) {
      setErrorMsg('Project name must be at least 3 characters.');
      return;
    }

    const created = createProject({
      name: name.trim(),
      description: description.trim() || 'Custom CFD project configuration.',
      cfdType,
      fluidType,
      simulationType,
    });

    setSuccessMsg(`Project "${created.name}" created successfully!`);
    setName('');
    setDescription('');
    setTimeout(() => {
      setActiveTab('all');
    }, 1200);
  };

  const handleOpen = (id: string) => {
    sound.playClick();
    setCurrentProjectId(id);
    setPage('setup');
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cfdType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.fluidType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto select-none text-[#0F172A] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
              <span>CFD Projects</span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Define, organize, and manage aerodynamic and fluid dynamic project cases
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#E2E8F0]/60 p-1 rounded-lg border border-[#CBD5E1]">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('all');
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-[#0F172A] shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>All Projects ({projects.length})</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('create');
            }}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'create'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ALL PROJECTS */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-[#CBD5E1] shadow-2xs max-w-md">
            <Search className="w-4 h-4 text-[#94A3B8]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by project name, CFD type, fluid..."
              className="bg-transparent border-none text-xs text-[#0F172A] focus:outline-none w-full"
            />
          </div>

          {/* Project List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.projectId}
                className="glass-surface rounded-2xl border border-white/60 p-5 shadow-md hover:border-cyan-400 transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-[#0F172A] font-sans">
                      {project.name}
                    </h3>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold border border-[#DBEAFE] shrink-0">
                      {project.cfdType}
                    </span>
                  </div>

                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {project.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-[#64748B]">
                    <span className="px-2 py-0.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                      Fluid: <strong>{project.fluidType}</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                      Type: <strong>{project.simulationType}</strong>
                    </span>
                    <span className="text-[10px] text-[#94A3B8]">
                      ID: {project.projectId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
                  <span className="text-[10px] text-[#94A3B8] font-mono">
                    {project.createdAt}
                  </span>

                  <div className="flex items-center gap-2">
                    {projects.length > 1 && (
                      <button
                        onClick={() => handleDelete(project.projectId)}
                        title="Delete Project"
                        className="p-1.5 text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleOpen(project.projectId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EFF6FF] hover:bg-[#2563EB] text-[#2563EB] hover:text-white rounded-md text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Setup & Run</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-[#CBD5E1] space-y-2">
              <FolderKanban className="w-8 h-8 text-[#94A3B8] mx-auto" />
              <h3 className="text-sm font-semibold text-[#0F172A]">No projects match your filter</h3>
              <p className="text-xs text-[#64748B]">Try adjusting your search keywords or create a new CFD project.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CREATE PROJECT */}
      {activeTab === 'create' && (
        <div className="max-w-2xl glass-surface rounded-2xl border border-white/60 p-6 shadow-md space-y-5">
          <div className="pb-3 border-b border-[#E2E8F0]">
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>Define New CFD Project</span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Specify problem kinematics, fluid medium, and simulation objectives
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs rounded-lg font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs rounded-lg font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-[#0F172A]">
                  Project Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Drone Rotor Wake Interaction, Subsonic Diffuser"
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              {/* CFD Type */}
              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">
                  CFD Regime Type <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={cfdType}
                  onChange={(e) => setCfdType(e.target.value as CfdType)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="External Aerodynamics">External Aerodynamics</option>
                  <option value="Internal Flow">Internal Flow</option>
                  <option value="Pipe Flow">Pipe Flow</option>
                  <option value="Airflow">Airflow</option>
                  <option value="Heat Transfer">Heat Transfer</option>
                  <option value="Compressible High-Speed">Compressible High-Speed</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              {/* Fluid Type */}
              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">
                  Fluid Medium <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  value={fluidType}
                  onChange={(e) => setFluidType(e.target.value as FluidType)}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="Air">Air (ρ = 1.225 kg/m³)</option>
                  <option value="Water">Water (ρ = 998.2 kg/m³)</option>
                  <option value="Kerosene">Kerosene (ρ = 810.0 kg/m³)</option>
                  <option value="Custom">Custom Equation of State</option>
                </select>
              </div>

              {/* Simulation Type */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-[#0F172A]">
                  Temporal Integration <span className="text-[#EF4444]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSimulationType('Steady State')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-colors cursor-pointer ${
                      simulationType === 'Steady State'
                        ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                        : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]'
                    }`}
                  >
                    Steady State (RANS / SIMPLE)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulationType('Transient')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition-colors cursor-pointer ${
                      simulationType === 'Transient'
                        ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                        : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]'
                    }`}
                  >
                    Transient (URANS / PIMPLE)
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-[#0F172A]">
                  Problem Description & Goals
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your design intentions, boundary constraints, target lift-to-drag, or heat transfer parameters..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="px-4 py-2 bg-white hover:bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
