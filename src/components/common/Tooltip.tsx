import React, { useState, useRef, useEffect } from 'react';
import { Info, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface TooltipProps {
  content: React.ReactNode;
  title?: string;
  tip?: string; // Optional practical rule-of-thumb
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  title,
  tip,
  children,
  position = 'top',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[#0F172A] border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#0F172A] border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[#0F172A] border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[#0F172A] border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      {children ? (
        <div
          onClick={(e) => {
            if (!content) return;
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={`${content ? 'cursor-help' : ''} ${className.includes('w-full') ? 'w-full' : ''}`}
        >
          {children}
        </div>
      ) : (
        <button
          type="button"
          aria-label={title || 'More information'}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="text-[#0284C7] hover:text-[#0369A1] p-0.5 rounded-full hover:bg-[#E0F2FE] transition-colors cursor-pointer inline-flex items-center justify-center"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && Boolean(content) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 w-64 sm:w-72 p-3 bg-[#0F172A] text-white text-left rounded-xl shadow-2xl border border-sky-400/30 text-xs pointer-events-auto select-text ${positionClasses[position]}`}
          >
            {title && (
              <div className="font-bold text-sky-300 text-xs pb-1 mb-1 border-b border-white/10 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>{title}</span>
              </div>
            )}
            <div className="text-slate-200 text-[11px] leading-relaxed font-normal">
              {content}
            </div>
            {tip && (
              <div className="mt-2 pt-1.5 border-t border-white/10 flex items-start gap-1 text-[10px] text-amber-300 font-mono">
                <span className="font-bold uppercase tracking-wider text-amber-400 shrink-0">Rule:</span>
                <span>{tip}</span>
              </div>
            )}
            {/* Pointer arrow */}
            <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
