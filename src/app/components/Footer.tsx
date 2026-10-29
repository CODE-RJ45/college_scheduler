import React from 'react';

interface FooterProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export default function Footer({ variant = 'light', className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === 'dark') {
    return (
      <footer className={`bg-slate-900 border-t border-slate-800/80 py-8 px-6 text-slate-400 ${className}`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
              CS
            </div>
            <span className="font-bold text-slate-200 text-sm tracking-tight">College Scheduler</span>
            <span className="text-slate-700 hidden sm:inline">&bull;</span>
            <span className="text-slate-400 hidden sm:inline text-xs">Academic Timetabling & Course Scheduling System</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700/80 shadow-2xs">
              <span className="text-[11px] text-slate-400 font-medium">Developed by:</span>
              <span className="text-[11px] font-bold text-indigo-300 tracking-wide">Ar-jay F. Llanera</span>
            </div>
            <span className="text-slate-500 text-[11px]">
              &copy; {currentYear} All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`mt-8 pt-5 pb-3 border-t border-slate-200/80 text-slate-500 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shadow-2xs">
            CS
          </div>
          <span className="font-bold text-slate-800 tracking-tight">College Scheduler</span>
          <span className="text-slate-300">&bull;</span>
          <span className="text-slate-400 text-[11px]">Academic Course Scheduling & Timetabling</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium">Developed by:</span>
            <span className="text-[11px] font-bold text-slate-900 tracking-wide">Ar-jay F. Llanera</span>
          </div>
          <span className="text-slate-400 text-[11px]">
            &copy; {currentYear} College Scheduler System
          </span>
        </div>
      </div>
    </footer>
  );
}
