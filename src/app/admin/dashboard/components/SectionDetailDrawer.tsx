"use client";

import React, { useEffect } from 'react';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Term {
  id: number;
  name: string;
  is_active: boolean;
}

interface Section {
  id: number;
  name: string | null;
  year_level: number;
  capacity: number;
  department: Department;
  term: Term;
}

interface SectionDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  section: Section | null;
  sectionSubjects: any[];
  scheduleSlots: any[];
  onEdit: (section: Section) => void;
  onDelete: (section: Section) => void;
  onViewCalendar: (sectionId: number) => void;
}

const DAY_MAP: Record<string, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export default function SectionDetailDrawer({
  isOpen,
  onClose,
  section,
  sectionSubjects,
  scheduleSlots,
  onEdit,
  onDelete,
  onViewCalendar,
}: SectionDetailDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !section) return null;

  // Filter subjects for this section
  const assignedSubjects = sectionSubjects.filter(
    (ss) => ss.section?.id === section.id
  );

  // Calculate schedule stats
  const scheduledSubjectsCount = assignedSubjects.filter((ss) =>
    scheduleSlots.some((slot) => slot.section_subject?.id === ss.id)
  ).length;

  const totalSubjectsCount = assignedSubjects.length;
  const progressPercent =
    totalSubjectsCount > 0
      ? Math.round((scheduledSubjectsCount / totalSubjectsCount) * 100)
      : 0;

  const totalUnits = assignedSubjects.reduce(
    (sum, ss) => sum + (Number(ss.course?.credits) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-5 text-white flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Year {section.year_level}
                </span>
                <span className="text-xl font-bold tracking-tight">
                  {section.department?.code || 'DEP'} {section.year_level}
                  {section.name || 'A'}
                </span>
                {section.term?.is_active && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Active Term
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                {section.department?.name || 'Department'} &bull; {section.term?.name || 'Academic Term'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              title="Close drawer"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewCalendar(section.id);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>View on Master Calendar</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onEdit(section)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
              >
                Edit Section
              </button>
              <button
                type="button"
                onClick={() => onDelete(section)}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-4 gap-3 p-6 border-b border-slate-200 bg-white">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Assigned Subjects</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">{totalSubjectsCount}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Scheduled</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-xl font-bold text-slate-900">{scheduledSubjectsCount}</span>
                <span className="text-xs text-slate-500">/ {totalSubjectsCount}</span>
              </div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Units</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">{totalUnits}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Seat Capacity</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">{section.capacity}</span>
            </div>
          </div>

          {/* Progress Bar Strip */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700">Timetable Scheduling Progress</span>
              <span className="font-bold text-indigo-600">{progressPercent}% Completed</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  progressPercent === 100
                    ? 'bg-emerald-500'
                    : progressPercent > 0
                    ? 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Content Area - Assigned Curriculum & Timetable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Assigned Curriculum & Schedule Breakdown
              </h4>
              <span className="text-xs text-slate-500">
                {assignedSubjects.length} courses in curriculum
              </span>
            </div>

            {assignedSubjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
                <p className="text-sm font-medium text-slate-700">No subjects currently assigned</p>
                <p className="text-xs text-slate-500 mt-1">
                  Subjects are automatically associated when curriculum courses matching Year {section.year_level} are registered.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedSubjects.map((ss) => {
                  const subjectSlots = scheduleSlots.filter(
                    (slot) => slot.section_subject?.id === ss.id
                  );
                  const isScheduled = subjectSlots.length > 0;

                  return (
                    <div
                      key={ss.id}
                      className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {ss.course?.code || 'COURSE'}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {ss.course?.title || 'Subject Title'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-slate-500">
                            <span>{ss.course?.credits || 3} Units</span>
                            <span>&bull;</span>
                            <span>{ss.course?.component || 'LEC'}</span>
                            <span>&bull;</span>
                            <span className="flex items-center space-x-1">
                              <span className="text-slate-400">Instructor:</span>
                              {ss.professor ? (
                                <span className="font-medium text-slate-700">
                                  {ss.professor.first_name} {ss.professor.last_name}
                                </span>
                              ) : (
                                <span className="font-medium text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  TBA / Unassigned
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Scheduling Status Badge */}
                        {isScheduled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Scheduled ({subjectSlots.length})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Unscheduled
                          </span>
                        )}
                      </div>

                      {/* Scheduled Slots Listing */}
                      {isScheduled && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                            Assigned Periods:
                          </span>
                          <div className="grid grid-cols-1 gap-1.5">
                            {subjectSlots.map((slot) => (
                              <div
                                key={slot.id}
                                className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-slate-700 w-10">
                                    {DAY_MAP[slot.day_of_week] || slot.day_of_week}
                                  </span>
                                  <span className="text-slate-600">
                                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                  </span>
                                </div>
                                <div className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                                  {slot.room ? `Room ${slot.room.room_number}` : 'Asynchronous / TBA'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

