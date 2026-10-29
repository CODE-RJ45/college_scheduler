"use client";

import React, { useEffect } from 'react';

interface FacultyDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  instructor: any | null;
  sectionSubjects: any[];
  scheduleSlots: any[];
  onViewCalendar: (instructorId: number) => void;
  onEditAvailability: (instructor: any) => void;
  onEditProfile: (instructor: any) => void;
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

export default function FacultyDetailDrawer({
  isOpen,
  onClose,
  instructor,
  sectionSubjects,
  scheduleSlots,
  onViewCalendar,
  onEditAvailability,
  onEditProfile,
}: FacultyDetailDrawerProps) {
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

  if (!isOpen || !instructor) return null;

  // Filter assigned subjects for this instructor
  const assignedSubjects = sectionSubjects.filter(
    (ss) => ss.professor && ss.professor.id === instructor.id
  );

  // Filter schedule slots taught by this instructor (either via assigned section_subject or custom slots)
  const instructorSlots = scheduleSlots.filter(
    (slot) =>
      (slot.section_subject?.professor?.id === instructor.id) ||
      (slot.professor?.id === instructor.id)
  );

  // Compute total credits / units & assigned workload hours
  const totalUnits = assignedSubjects.reduce(
    (sum, ss) => sum + (Number(ss.course?.credits) || 0),
    0
  );

  const assignedWorkloadHours = assignedSubjects.reduce(
    (sum, ss) => sum + (ss.course?.has_lab ? 5 : Number(ss.course?.credits) || 3),
    0
  );

  const maxHours = instructor.max_hours_per_week || 30;

  // Compute total weekly scheduled hours in timetable
  const totalScheduledHours = instructorSlots.reduce((sum, slot) => {
    if (!slot.start_time || !slot.end_time) return sum;
    const [startH, startM] = slot.start_time.split(':').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const hours = (endH * 60 + endM - (startH * 60 + startM)) / 60;
    return sum + (hours > 0 ? hours : 0);
  }, 0);

  // Workload status
  let loadBadge = { label: 'Optimal Load', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (assignedSubjects.length === 0) {
    loadBadge = { label: 'Unassigned', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  } else if (assignedWorkloadHours > maxHours || totalUnits > 21) {
    loadBadge = { label: 'Overloaded', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  } else if (assignedWorkloadHours >= Math.min(18, maxHours) || (totalUnits >= 15 && totalUnits <= 21)) {
    loadBadge = { label: 'Optimal Load', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  } else {
    loadBadge = { label: 'Underloaded', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  }

  // Active days list
  const activeDays = instructor.available_days
    ? instructor.available_days.split(',').map((d: string) => d.trim().toUpperCase())
    : ['MON', 'TUE', 'WED', 'THU', 'FRI'];

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
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-md">
                {instructor.first_name?.[0] || 'P'}
                {instructor.last_name?.[0] || 'R'}
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {instructor.first_name} {instructor.last_name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${loadBadge.color}`}
                  >
                    {loadBadge.label}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  @{instructor.username} &bull; {instructor.email}
                </p>
              </div>
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
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewCalendar(instructor.id);
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>View Weekly Schedule on Calendar</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => onEditAvailability(instructor)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                Set Availability
              </button>
              <button
                type="button"
                onClick={() => onEditProfile(instructor)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Teaching Load Metrics Strip */}
          <div className="grid grid-cols-4 gap-3 p-6 border-b border-slate-200 bg-white">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Assigned Courses</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">{assignedSubjects.length}</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Load Units</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-xl font-bold text-slate-900">{totalUnits}</span>
                <span className="text-xs text-slate-400">/ 21 Max</span>
              </div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Assigned Workload</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-xl font-bold text-slate-900">{assignedWorkloadHours.toFixed(1)} hrs</span>
                <span className="text-xs text-slate-400">/ {maxHours} Max</span>
              </div>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Timetable Placed</span>
              <div className="flex items-baseline space-x-1 mt-1">
                <span className="text-xl font-bold text-slate-900">{totalScheduledHours.toFixed(1)} hrs</span>
                <span className="text-xs text-slate-400">({instructorSlots.length} slots)</span>
              </div>
            </div>
          </div>

          {/* Declared Availability Summary Strip */}
          <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Declared Availability Constraints
              </span>
              <button
                type="button"
                onClick={() => onEditAvailability(instructor)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Edit &rarr;
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1">
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                  <span
                    key={d}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      activeDays.includes(d)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <span className="text-slate-300">&bull;</span>
              <div className="text-xs font-medium text-slate-700">
                {instructor.available_start_time && instructor.available_end_time ? (
                  <span>
                    Window: {formatTime(instructor.available_start_time)} &ndash; {formatTime(instructor.available_end_time)}
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                    Unrestricted Daily Hours
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Assigned Classes List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Assigned Subject Sections ({assignedSubjects.length})
              </h4>
            </div>

            {assignedSubjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50">
                <p className="text-sm font-medium text-slate-700">No teaching assignments yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Assign subjects to this professor in the Course Assignments tab or Sections manager.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedSubjects.map((ss) => {
                  const slots = scheduleSlots.filter(
                    (slot) => slot.section_subject?.id === ss.id
                  );
                  const isScheduled = slots.length > 0;

                  return (
                    <div
                      key={ss.id}
                      className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {ss.course?.code || 'COURSE'}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {ss.course?.title || ss.course?.name || 'Subject Title'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2.5 text-xs text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700">
                              Cohort: {ss.section?.department?.code} {ss.section?.year_level}{ss.section?.name || 'A'}
                            </span>
                            <span>&bull;</span>
                            <span>{ss.course?.credits || 3} Units</span>
                            <span>&bull;</span>
                            <span>{ss.section?.term?.name || 'Term'}</span>
                          </div>
                        </div>

                        {isScheduled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Scheduled ({slots.length})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Unscheduled
                          </span>
                        )}
                      </div>

                      {/* Scheduled Slots */}
                      {isScheduled && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Assigned Class Periods:
                          </span>
                          <div className="grid grid-cols-1 gap-1">
                            {slots.map((slot) => (
                              <div
                                key={slot.id}
                                className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                              >
                                <div className="flex items-center space-x-2 font-medium">
                                  <span className="font-bold text-slate-800 w-10">
                                    {DAY_MAP[slot.day_of_week] || slot.day_of_week}
                                  </span>
                                  <span className="text-slate-600">
                                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                  </span>
                                </div>
                                <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                                  {slot.room ? `Room ${slot.room.room_number}` : 'Asynch / TBA'}
                                </span>
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
