import React, { useState, useEffect, useRef } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { PageId } from '../../types';
import { CfdLogo } from '../common/CfdLogo';
import { Tooltip } from '../common/Tooltip';
import { motion, AnimatePresence } from 'motion/react';
import { animate, stagger } from 'animejs';
import {
  Globe,
  LayoutDashboard,
  FolderKanban,
  Shapes,
  Settings,
  PlayCircle,
  Wind,
  BarChart3,
  Brain,
  FileSpreadsheet,
  TrendingUp,
  BookOpen,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Activity,
  Cpu,
  Volume2,
  VolumeX,
  Sparkles,
  GitCompareArrows,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';

export const Navbar: React.FC = () => {
  const {
    page,
    setPage,
    activeThemeConfig,
  } = usePlatform();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [optimisticPage, setOptimisticPage] = useState<PageId | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(!sound.isEnabled());

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOptimisticPage(null);
  }, [page]);

  // Initial mount smooth slide-in animation for all left-side elements
  useEffect(() => {
    try {
      if (document.querySelectorAll('.nav-item-slide').length > 0) {
        animate('.nav-item-slide', {
          x: [-32, 0],
          opacity: [0, 1],
          scale: [0.96, 1],
          duration: 480,
          delay: stagger(26),
          ease: 'outExpo',
        });
      }
      if (document.querySelectorAll('.sidebar-bottom-slide').length > 0) {
        animate('.sidebar-bottom-slide', {
          x: [-28, 0],
          opacity: [0, 1],
          scale: [0.96, 1],
          duration: 440,
          delay: stagger(32, { start: 120 }),
          ease: 'outExpo',
        });
      }
    } catch {}
  }, []);

  const navItems: { id: PageId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'landing', label: 'Landing', icon: Globe },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'geometry', label: 'Geometry', icon: Shapes },
    { id: 'setup', label: 'Setup', icon: Settings },
    { id: 'runner', label: 'Run', icon: PlayCircle },
    { id: 'live-sim', label: 'Live Simulation', icon: Wind },
    { id: 'sweeps', label: 'Sweeps & Polars', icon: TrendingUp },
    { id: 'results', label: 'Results', icon: BarChart3 },
    { id: 'history', label: 'History & Compare', icon: GitCompareArrows },
    { id: 'ai', label: 'AI Analysis', icon: Brain },
    { id: 'reporting', label: 'Reports', icon: FileSpreadsheet },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
  ];

  const handleNavClick = (id: PageId) => {
    sound.playClick();
    setOptimisticPage(id);
    setPage(id);
    setMobileMenuOpen(false);

    try {
      animate(`.nav-item-${id}`, {
        scale: [0.97, 1.02, 1],
        duration: 340,
        ease: 'outExpo',
      });
    } catch {}
  };

  // Bidirectional smooth animation IN (expand) and OUT (collapse) when slide button is pressed
  const handleSlideToggle = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);

    try {
      if (document.querySelector('#css-selector-id')) {
        animate('#css-selector-id', {
          scale: [0.9, 1.18, 1],
          x: [0, 4, 0],
          duration: 340,
          ease: 'outExpo',
        });
      }

      if (nextCollapsed) {
        // Animating OUT to compact icon rail
        if (document.querySelectorAll('.nav-item-slide').length > 0) {
          animate('.nav-item-slide', {
            x: [12, 0],
            scale: [0.94, 1],
            opacity: [0.7, 1],
            duration: 360,
            delay: stagger(16, { from: 'last' }),
            ease: 'outCubic',
          });
        }
        if (document.querySelectorAll('.sidebar-bottom-slide').length > 0) {
          animate('.sidebar-bottom-slide', {
            x: [10, 0],
            scale: [0.94, 1],
            opacity: [0.7, 1],
            duration: 340,
            delay: stagger(20, { from: 'last' }),
            ease: 'outCubic',
          });
        }
      } else {
        // Animating IN to full expanded navigation rail
        if (document.querySelectorAll('.nav-item-slide').length > 0) {
          animate('.nav-item-slide', {
            x: [-32, 0],
            scale: [0.96, 1],
            opacity: [0.3, 1],
            duration: 440,
            delay: stagger(24),
            ease: 'outExpo',
          });
        }
        if (document.querySelectorAll('.sidebar-bottom-slide').length > 0) {
          animate('.sidebar-bottom-slide', {
            x: [-26, 0],
            scale: [0.96, 1],
            opacity: [0.3, 1],
            duration: 400,
            delay: stagger(28, { start: 70 }),
            ease: 'outExpo',
          });
        }
      }
    } catch {}
  };

  const activePage = optimisticPage || page;

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Shared uniform button height & alignment classes with cylindrical capsule styling
  const uniformButtonBase = `w-full h-[38px] min-h-[38px] max-h-[38px] rounded-full text-xs font-semibold whitespace-nowrap relative cursor-pointer select-none flex items-center transition-all ${
    isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
  }`;

  return (
    <>
      {/* 
        LEFT-SIDE NAVIGATION WORKBENCH BAR: FLOATING CYLINDRICAL BOX
        Curved corners, floating margin gaps on left, top, and bottom
      */}
      <motion.header
        initial={{ opacity: 0, x: -36, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{
          duration: 0.45,
          ease: [0.22, 1, 0.36, 1],
        }}
        whileHover={{
          boxShadow: '0 24px 48px -12px rgba(2, 132, 199, 0.22), inset 0 1px 2px 0 rgba(255, 255, 255, 0.95)',
          transition: { duration: 0.28 },
        }}
        className={`glass-sidebar ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } lg:flex-col lg:justify-between z-40 shrink-0 sticky top-0 m-2.5 sm:m-3 lg:m-0 lg:my-3 lg:ml-3.5 lg:mr-2 w-[calc(100%-1.25rem)] sm:w-[calc(100%-1.5rem)] lg:w-auto h-14 lg:h-[calc(100dvh-1.5rem)] flex items-center justify-between lg:items-stretch select-none px-3 py-2 sm:px-4 lg:px-0 overflow-hidden rounded-[1.75rem] lg:rounded-[2.25rem] border border-white/60 dark:border-white/20 shadow-xl lg:shadow-2xl transition-all duration-300`}
      >
        {/* Top: Brand Logo & Title with Smooth Slide In/Out Button (Curved container) */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'lg:flex-col lg:items-center lg:gap-2.5 lg:px-2' : 'justify-between lg:px-3.5'
          } p-2 lg:py-3.5 lg:border-b border-white/20 dark:border-white/10 bg-transparent shrink-0 w-full lg:w-auto justify-between rounded-t-[1.75rem] lg:rounded-t-[2.25rem]`}
        >
          {/* Logo: Always visible on mobile; on desktop shows full text when expanded, icon when collapsed */}
          <button
            onClick={() => handleNavClick('landing')}
            className="group text-left transition-transform active:scale-95 flex items-center min-h-[38px] cursor-pointer"
            title="RIMZ — Home"
            aria-label="RIMZ Home"
          >
            <div className="lg:hidden">
              <CfdLogo size="sm" showText={true} />
            </div>
            <div className="hidden lg:block">
              <CfdLogo size="sm" showText={!isCollapsed} />
            </div>
          </button>

          {/* Desktop Slide In / Out Toggle Button (Greater-than when minimized, Lesser-than when maximized) */}
          <div className="hidden lg:flex items-center shrink-0">
            <Tooltip
              content={isCollapsed ? 'Extend / Maximize options' : 'Minimize options'}
              position="right"
            >
              <button
                onClick={handleSlideToggle}
                aria-label={isCollapsed ? 'Extend options' : 'Minimize options'}
                title={isCollapsed ? 'Extend options' : 'Minimize options'}
                className="glass-item w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs hover:bg-white/40 transition-colors"
              >
                <div id="css-selector-id" className="flex items-center justify-center">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-800 dark:text-slate-100" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-slate-800 dark:text-slate-100" />
                  )}
                </div>
              </button>
            </Tooltip>
          </div>

          {/* Mobile Hamburger Toggle Button (lg:hidden) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Navigation Menu'}
            className="glass-item flex lg:hidden items-center justify-center p-2 min-h-[38px] min-w-[38px] rounded-full text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Center: Navigation items arranged ONE BY ONE vertically — 100% Even in Size */}
        <div className="hidden lg:flex flex-1 flex-col overflow-hidden min-h-0">
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="nav-header-label"
                initial={{ opacity: 0, x: -10, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: -10, height: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 overflow-hidden whitespace-nowrap"
              >
                Workbench Navigation
              </motion.div>
            )}
          </AnimatePresence>

          <motion.nav
            ref={navRef}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.035,
                  delayChildren: 0.05,
                },
              },
            }}
            className="flex-1 flex flex-col gap-1.5 px-3 py-1.5 overflow-y-auto scrollbar-none"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <motion.button
                  key={item.id}
                  variants={{
                    hidden: { opacity: 0, x: -18, scale: 0.95 },
                    visible: {
                      opacity: 1,
                      x: 0,
                      scale: 1,
                      transition: { type: 'spring', stiffness: 360, damping: 26 },
                    },
                  }}
                  whileHover={{
                    scale: 1.035,
                    x: isCollapsed ? 0 : 4,
                    transition: { duration: 0.16, ease: 'easeOut' },
                  }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`nav-item-slide nav-item-${item.id} ${uniformButtonBase} ${
                    isActive
                      ? 'glass-item-active font-bold shadow-md'
                      : 'glass-item text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
                  }`}
                  style={
                    isActive
                      ? {
                          color: activeThemeConfig.accentColor,
                          borderColor: activeThemeConfig.accentColor,
                          boxShadow: `0 0 20px ${activeThemeConfig.accentColor}75, 0 0 38px ${activeThemeConfig.accentColor}35, inset 0 0 14px ${activeThemeConfig.accentColor}30`,
                        }
                      : {}
                  }
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1'}`}>
                    <motion.span
                      whileHover={{
                        rotate: [0, -10, 10, -5, 0],
                        scale: 1.2,
                        transition: { duration: 0.35 },
                      }}
                      animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                      className="w-5 h-5 flex items-center justify-center shrink-0 relative"
                    >
                      {isActive && (
                        <span
                          className="absolute inset-0 rounded-full blur-xs opacity-50 pointer-events-none"
                          style={{ backgroundColor: activeThemeConfig.accentColor }}
                        />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-all duration-200 relative z-10 ${
                          isActive ? 'scale-110 drop-shadow-md' : 'text-slate-700 dark:text-slate-300'
                        }`}
                        style={
                          isActive
                            ? {
                                color: activeThemeConfig.accentColor,
                                filter: `drop-shadow(0 0 6px ${activeThemeConfig.accentColor})`,
                              }
                            : {}
                        }
                      />
                    </motion.span>
                    <AnimatePresence mode="wait" initial={false}>
                      {!isCollapsed && (
                        <motion.span
                          key={`label-${item.id}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className={`truncate text-left flex-1 ${isActive ? 'font-bold tracking-wide' : ''}`}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {isActive && !isCollapsed && (
                    <motion.span
                      layoutId="activeNavIndicatorVertical"
                      className="w-2 h-4 rounded-full shrink-0 ml-2 shadow-[0_0_10px_currentColor]"
                      style={{
                        backgroundColor: activeThemeConfig.accentColor,
                        boxShadow: `0 0 10px ${activeThemeConfig.accentColor}`,
                      }}
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </motion.nav>

          {/* Bottom Telemetry & Multi-Physics Status Widget — Fills empty space with rich, purposeful UI */}
          <div className="sidebar-bottom-slide shrink-0 p-2.5 border-t border-white/20 dark:border-white/10 mt-auto bg-gradient-to-t from-white/30 to-transparent dark:from-slate-950/40">
            {!isCollapsed ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-2.5 rounded-2xl bg-white/40 dark:bg-slate-900/50 border border-white/50 dark:border-white/10 shadow-xs backdrop-blur-md flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                    </span>
                    <span className="text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-600 bg-clip-text text-transparent">
                      RIMZ ENGINE
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-400/20 font-bold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-sky-400 animate-spin" style={{ animationDuration: '6s' }} />
                    v2.4 FNO
                  </span>
                </div>

                {/* Dynamic live telemetry stats */}
                <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-950/40 px-1.5 py-1 rounded-lg border border-white/30 dark:border-slate-800">
                    <Cpu className="w-3 h-3 text-sky-500 shrink-0" />
                    <span className="truncate font-semibold">64 Threads</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/50 dark:bg-slate-950/40 px-1.5 py-1 rounded-lg border border-white/30 dark:border-slate-800">
                    <Activity className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="truncate font-semibold">Live: 4ms</span>
                  </div>
                </div>

                {/* Audio Toggle & Dynamic Soundwave Bars */}
                <div className="flex items-center justify-between pt-1 border-t border-white/20 dark:border-slate-800/50">
                  <button
                    onClick={() => {
                      const enabled = sound.toggle();
                      setIsAudioMuted(!enabled);
                    }}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors"
                    title={isAudioMuted ? 'Unmute scientific audio' : 'Mute audio'}
                  >
                    {isAudioMuted ? (
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                    )}
                    <span>{isAudioMuted ? 'Audio Off' : 'Sound FX'}</span>
                  </button>

                  {/* Equalizer animation */}
                  <div className="flex items-center gap-0.5 h-3 px-1">
                    {[0.5, 0.9, 0.4, 1.0, 0.6].map((h, i) => (
                      <span
                        key={i}
                        className={`w-0.5 rounded-full transition-all duration-300 ${
                          isAudioMuted ? 'h-1 bg-slate-300 dark:bg-slate-700' : 'bg-sky-500'
                        }`}
                        style={{
                          height: isAudioMuted ? '3px' : `${h * 12}px`,
                          animationDelay: `${i * 140}ms`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Compact circular telemetry pod when collapsed */
              <div className="flex flex-col items-center gap-2 py-1">
                <Tooltip content="RIMZ FNO Solver: Online (64 Threads)" position="right">
                  <div className="w-9 h-9 rounded-full bg-white/40 dark:bg-slate-900/50 border border-sky-400/40 flex items-center justify-center relative cursor-pointer shadow-xs hover:shadow-[0_0_12px_rgba(56,189,248,0.5)] transition-all">
                    <Activity className="w-4 h-4 text-sky-500" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                    </span>
                  </div>
                </Tooltip>

                <Tooltip content={isAudioMuted ? 'Unmute audio' : 'Audio FX on'} position="right">
                  <button
                    onClick={() => {
                      const enabled = sound.toggle();
                      setIsAudioMuted(!enabled);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-sky-500 transition-colors cursor-pointer"
                  >
                    {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-sky-500" />}
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Mobile Slide-in Navigation Drawer (arranged one by one on the left with glassmorphism) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeInOut' }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 lg:hidden"
            />

            <motion.div
              initial={{ x: '-100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="glass-sidebar fixed inset-y-0 left-0 w-[82vw] max-w-xs shadow-2xl z-50 flex flex-col lg:hidden pt-safe pb-safe"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/40 dark:border-slate-800/60 flex items-center justify-between bg-white/30 dark:bg-slate-950/40 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <CfdLogo size="sm" showText={true} />
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation drawer"
                  className="glass-item p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links Scrollable List arranged one by one — Uniform Size */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-1">
                  Workbench Navigation
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full h-11 min-h-[44px] max-h-[44px] flex items-center justify-between px-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'glass-item-active font-bold shadow-md'
                          : 'glass-item text-slate-800 dark:text-slate-200'
                      }`}
                      style={
                        isActive
                          ? {
                              color: activeThemeConfig.accentColor,
                              borderColor: activeThemeConfig.accentColor,
                              boxShadow: `0 0 20px ${activeThemeConfig.accentColor}70, inset 0 0 12px ${activeThemeConfig.accentColor}25`,
                            }
                          : {}
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-5 h-5 flex items-center justify-center shrink-0">
                          <Icon
                            className="w-4 h-4"
                            style={
                              isActive
                                ? {
                                    filter: `drop-shadow(0 0 6px ${activeThemeConfig.accentColor})`,
                                  }
                                : {}
                            }
                          />
                        </span>
                        <span className={`truncate ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
