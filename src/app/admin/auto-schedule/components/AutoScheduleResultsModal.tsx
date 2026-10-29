"use client";

import React from 'react';

interface UnplacedSubject {
  id: number;
  course_code: string;
  course_name: string;
  section: string;
  professor: string;
  has_lab: boolean;
  credits: number;
}

interface AutoScheduleResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: {
    scheduled_slots_created: number;
    failed_operations: number;
    unplaced_subjects?: UnplacedSubject[];
  } | null;
  targetTermName?: string;
  targetDepartmentName?: string;
  onGoToCalendar: () => void;
}

export default function AutoScheduleResultsModal({
  isOpen,
  onClose,
  results,
  targetTermName,
  targetDepartmentName,
  onGoToCalendar,
}: AutoScheduleResultsModalProps) {
  if (!isOpen || !results) return null;

  const isCompleteSuccess = results.failed_operations === 0;
  const unplacedList = results.unplaced_subjects || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                isCompleteSuccess
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isCompleteSuccess ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {isCompleteSuccess
                  ? 'Master Schedule Generated Successfully'
                  : 'Auto-Schedule Generated with Warnings'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target: {targetTermName || 'Active Term'} • {targetDepartmentName || 'All Departments'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5">
                Schedule Slots Created
              </span>
              <span className="text-2xl font-black text-emerald-700">
                {results.scheduled_slots_created}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                Classroom periods placed
              </span>
            </div>

            <div
              className={`border rounded-xl p-3.5 flex flex-col items-center justify-center text-center ${
                isCompleteSuccess
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                  isCompleteSuccess ? 'text-slate-500' : 'text-rose-800'
                }`}
              >
                Unplaced Subjects
              </span>
              <span
                className={`text-2xl font-black ${
                  isCompleteSuccess ? 'text-slate-700' : 'text-rose-700'
                }`}
              >
                {results.failed_operations}
              </span>
              <span
                className={`text-[10px] font-medium mt-0.5 ${
                  isCompleteSuccess ? 'text-slate-500' : 'text-rose-600'
                }`}
              >
                {isCompleteSuccess ? 'Zero bottlenecks' : 'Need manual placement'}
              </span>
            </div>
          </div>

          {/* Diagnostic List if any subjects could not be scheduled */}
          {unplacedList.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Unplaced Curriculum Subjects ({unplacedList.length})
                </h4>
                <span className="text-[10px] text-slate-500">
                  Visible in Master Calendar Unscheduled Pool
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                {unplacedList.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        {item.course_code} - {item.course_name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                        <span className="font-semibold text-slate-700">{item.section}</span>
                        <span>&bull;</span>
                        <span>Prof: {item.professor}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        item.has_lab
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {item.has_lab ? 'Lab (5h)' : `${item.credits} Units`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Troubleshooting Hint */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-start space-x-2">
                <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  <strong>Tip:</strong> These subjects may have failed due to room capacity limits, overlapping instructor availability, or restricted operating hours. You can easily drag and place them manually in the <strong>Master Calendar</strong>.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-300 hover:bg-white transition cursor-pointer"
          >
            Adjust Constraints & Re-run
          </button>

          <button
            type="button"
            onClick={onGoToCalendar}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer flex items-center space-x-1.5"
          >
            <span>View in Master Calendar</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

