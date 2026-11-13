import React, { useState, useRef, useEffect } from 'react';
import { ConsoleLogMessage } from '../../types';
import { Terminal, Trash2, Filter, Download } from 'lucide-react';

interface SolverConsoleProps {
  logs: ConsoleLogMessage[];
  onClearLogs: () => void;
}

export const SolverConsole: React.FC<SolverConsoleProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<'all' | 'warn' | 'metric'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'warn') return log.level === 'warn';
    if (filter === 'metric') return log.level === 'metric';
    return true;
  });

  return (
    <div className="flex flex-col h-full select-none font-mono text-[11px] bg-[#0B1C30] text-[#EAF1FF] p-2.5">
      {/* Console Top Toolbar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#213145] mb-1.5 text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span className="font-semibold text-white font-sans text-[11px]">
            SOLVER RUNTIME LOG (STDOUT)
          </span>
          <span className="text-[10px] text-[#737686] bg-[#132238] px-1.5 py-0.2 rounded border border-[#213145]">
            SU2 / OpenFOAM Core
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#132238] rounded border border-[#213145] p-0.5 text-[10px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === 'all' ? 'bg-[#2563EB] text-white' : 'text-[#737686] hover:text-white'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              onClick={() => setFilter('metric')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === 'metric' ? 'bg-[#2563EB] text-white' : 'text-[#737686] hover:text-white'
              }`}
            >
              Metrics
            </button>
            <button
              onClick={() => setFilter('warn')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                filter === 'warn' ? 'bg-[#EF4444] text-white' : 'text-[#737686] hover:text-white'
              }`}
            >
              Alerts
            </button>
          </div>

          <button
            onClick={onClearLogs}
            title="Clear Console Output"
            className="p-1 hover:bg-[#132238] text-[#737686] hover:text-white rounded border border-[#213145]"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Log Output Stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-0.5 pr-2 font-mono text-[10px] leading-relaxed scrollbar-thin"
      >
        {filteredLogs.map((log) => {
          let badgeColor = 'text-[#06B6D4]';
          if (log.level === 'warn') badgeColor = 'text-[#EF4444] font-bold';
          if (log.level === 'success') badgeColor = 'text-[#10B981]';
          if (log.level === 'metric') badgeColor = 'text-[#F59E0B]';

          return (
            <div key={log.id} className="flex items-start gap-2 hover:bg-[#132238]/60 py-0.5 px-1 rounded">
              <span className="text-[#556987] shrink-0">{log.timestamp}</span>
              <span className="text-[#38BDF8] shrink-0">[{log.iteration.toString().padStart(4, '0')}]</span>
              <span className={`shrink-0 ${badgeColor}`}>
                {log.level.toUpperCase().padEnd(6, ' ')}
              </span>
              <span className="text-[#CBD5E1] break-all">{log.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
