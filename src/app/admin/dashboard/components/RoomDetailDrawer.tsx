"use client";

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Room } from './RoomModal';

interface RoomDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  scheduleSlots: any[];
  onEdit: (room: Room) => void;
  onDelete: (room: Room) => void;
  onViewCalendar: (roomId: number) => void;
}

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

const formatTime12 = (timeStr?: string) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export default function RoomDetailDrawer({
  isOpen,
  onClose,
  room,
  scheduleSlots,
  onEdit,
  onDelete,
  onViewCalendar,
}: RoomDetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const roomSlots = useMemo(() => {
    if (!room || !room.id) return [];
    return scheduleSlots.filter((slot) => slot.room && slot.room.id === room.id);
  }, [room, scheduleSlots]);

  const totalWeeklyHours = useMemo(() => {
    return roomSlots.reduce((acc, slot) => {
      if (!slot.start_time || !slot.end_time) return acc;
      const [sh, sm] = slot.start_time.split(':').map(Number);
      const [eh, em] = slot.end_time.split(':').map(Number);
      const duration = (eh * 60 + em - (sh * 60 + sm)) / 60;
      return acc + (duration > 0 ? duration : 0);
    }, 0);
  }, [roomSlots]);

  const utilizationPercent = Math.min(100, Math.round((totalWeeklyHours / 50) * 100));

  const groupedSlots = useMemo(() => {
    const map: Record<string, any[]> = {};
    DAY_ORDER.forEach((day) => {
      map[day] = [];
    });
    roomSlots.forEach((slot) => {
      const day = slot.day_of_week || 'MON';
      if (!map[day]) map[day] = [];
      map[day].push(slot);
    });
    Object.keys(map).forEach((day) => {
      map[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    });
    return map;
  }, [roomSlots]);

  if (!isOpen || !room) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight">{room.room_number}</span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    room.room_type === 'LABORATORY'
                      ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                      : 'bg-blue-900/80 text-blue-200 border border-blue-700'
                  }`}
                >
                  {room.room_type === 'LABORATORY' ? 'Laboratory' : 'Lecture Room'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {room.building}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick Action Strip */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <button
              type="button"
              disabled={!room.id}
              onClick={() => {
                if (room.id) {
                  onViewCalendar(room.id);
                  onClose();
                }
              }}
              className="flex-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Calendar</span>
            </button>

            {room.id ? (
              <Link
                href={`/timetable?view=room&id=${room.id}`}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Timetable</span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => onEdit(room)}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Edit
            </button>

            <button
              type="button"
              onClick={() => onDelete(room)}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 text-xs font-semibold transition cursor-pointer"
            >
              Delete
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* KPI Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Capacity</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">{room.capacity}</span>
                <span className="text-[10px] text-slate-400 block">seats</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Scheduled Load</span>
                <span className="text-xl font-bold text-indigo-700 mt-1 block">{totalWeeklyHours.toFixed(1)}h</span>
                <span className="text-[10px] text-slate-400 block">{roomSlots.length} periods</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Utilization</span>
                <span className={`text-xl font-bold mt-1 block ${utilizationPercent > 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {utilizationPercent}%
                </span>
                <span className="text-[10px] text-slate-400 block">50h capacity</span>
              </div>
            </div>

            {/* Utilization Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Facility Occupancy</span>
                <span>{utilizationPercent}% of weekly capacity</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    utilizationPercent > 80
                      ? 'bg-rose-500'
                      : utilizationPercent > 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${utilizationPercent}%` }}
                />
              </div>
            </div>

            {/* Technical Equipment */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Installed Features</h4>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                    room.has_projector
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  {room.has_projector ? 'Projector / Smart Display' : 'No Projector'}
                </span>

                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                    room.has_computers
                      ? 'bg-purple-50 border-purple-200 text-purple-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  {room.has_computers ? 'Computer Workstations' : 'Standard Seating'}
                </span>
              </div>
            </div>

            {/* Weekly Schedule by Day */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Weekly Timetable ({roomSlots.length})
                </h4>
              </div>

              {roomSlots.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-xs space-y-1">
                  <p className="font-semibold text-slate-700">No classes scheduled</p>
                  <p className="text-slate-400">This facility is currently available across all weekly time windows.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {DAY_ORDER.map((day) => {
                    const daySlots = groupedSlots[day] || [];
                    if (daySlots.length === 0) return null;

                    return (
                      <div key={day} className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-xs">
                        <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex justify-between items-center text-xs font-semibold text-slate-700">
                          <span>{DAY_LABELS[day]}</span>
                          <span className="text-[11px] text-slate-500">
                            {daySlots.length} period{daySlots.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {daySlots.map((slot, sIdx) => {
                            const course = slot.section_subject?.course;
                            const sec = slot.section_subject?.section?.name;
                            const prof = slot.section_subject?.professor;
                            const profName = prof ? `${prof.first_name?.[0] || ''}. ${prof.last_name}` : 'TBA';
                            const startTime = formatTime12(slot.start_time);
                            const endTime = formatTime12(slot.end_time);

                            return (
                              <div key={sIdx} className="p-3 hover:bg-slate-50/70 transition flex items-start justify-between gap-3 text-xs">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-slate-900">
                                      {slot.is_custom ? (slot.custom_title || 'Custom') : (course?.code || 'Course')}
                                    </span>
                                    {sec && (
                                      <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                                        Sec {sec}
                                      </span>
                                    )}
                                  </div>
                                  {!slot.is_custom && course?.name && (
                                    <p className="text-[11px] text-slate-500 font-medium truncate max-w-[220px]">
                                      {course.name}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Faculty: <span className="font-semibold text-slate-700">{profName}</span>
                                  </p>
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="font-semibold text-slate-700 text-xs">
                                    {startTime} – {endTime}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
