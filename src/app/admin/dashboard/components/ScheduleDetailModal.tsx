"use client";

import React, { useState } from 'react';
import toast from 'react-hot-toast';

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any | null;
  rooms: any[];
  onDeleteSlot: (slotId: number) => Promise<void>;
  onUpdateRoom: (slotId: number, newRoomId: number) => Promise<void>;
}

export default function ScheduleDetailModal({
  isOpen,
  onClose,
  event,
  rooms,
  onDeleteSlot,
  onUpdateRoom,
}: ScheduleDetailModalProps) {
  const [isChangingRoom, setIsChangingRoom] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | ''>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  if (!isOpen || !event) return null;

  const resource = event.resource || {};
  const isCustom = resource.is_custom;
  const course = resource.section_subject?.course || resource.course;
  const section = resource.section_subject?.section || resource.section;
  const professor = resource.section_subject?.professor || resource.professor;
  const currentRoom = resource.room;

  // Format Time Display
  const formatTime = (dateObj: Date) => {
    if (!dateObj) return '';
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const dayNames: { [key: string]: string } = {
    MON: 'Monday',
    TUE: 'Tuesday',
    WED: 'Wednesday',
    THU: 'Thursday',
    FRI: 'Friday',
    SAT: 'Saturday',
    SUN: 'Sunday',
  };

  const dayDisplay = resource.day_of_week
    ? dayNames[resource.day_of_week] || resource.day_of_week
    : '';

  const handleRoomSave = async () => {
    if (!selectedRoomId || !resource.id) return;
    setIsUpdating(true);
    try {
      await onUpdateRoom(resource.id, Number(selectedRoomId));
      setIsChangingRoom(false);
    } catch {
      // Toast handled by parent
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!resource.id) return;
    setIsUpdating(true);
    try {
      await onDeleteSlot(resource.id);
      setIsConfirmingDelete(false);
      onClose();
    } catch {
      // Toast handled by parent
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                isCustom
                  ? 'bg-emerald-500'
                  : course?.has_lab
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
            />
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {isCustom
                ? resource.custom_title || 'Custom Faculty Block'
                : `${course?.code || 'Subject'} - ${course?.name || ''}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Confirmation Warning if confirming delete */}
          {isConfirmingDelete ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Remove from Timetable?</h4>
                  <p className="text-slate-600 text-xs mt-0.5">
                    This will unschedule this subject period. It will return to the Unscheduled Pool so you can place it again.
                  </p>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isUpdating}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isUpdating}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isUpdating ? 'Removing...' : 'Confirm Remove'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Timing & Schedule Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Day & Period
                  </span>
                  <p className="text-xs font-bold text-slate-900">
                    {dayDisplay || 'Weekly Slot'}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    {formatTime(event.start)} – {formatTime(event.end)}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Component & Type
                  </span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isCustom
                          ? 'bg-emerald-100 text-emerald-800'
                          : course?.has_lab
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {isCustom ? 'Faculty Task' : course?.has_lab ? 'Laboratory' : 'Lecture'}
                    </span>
                    {!isCustom && course?.credits && (
                      <span className="text-[11px] text-slate-600 font-semibold">
                        {course.credits} Units
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section & Faculty Details */}
              <div className="space-y-3">
                {!isCustom && section && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Assigned Section Cohort
                      </span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        {section.department?.code || 'DEPT'} – Year {section.year_level} Sec {section.name || 'A'}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      Term: {section.term?.name || 'Active Term'}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Assigned Instructor
                    </span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {professor ? `${professor.first_name} ${professor.last_name}` : 'To Be Announced (TBA)'}
                    </p>
                    {professor?.email && (
                      <p className="text-[10px] text-slate-500">{professor.email}</p>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    {professor ? professor.first_name?.[0] : '?'}
                  </div>
                </div>

                {/* Assigned Room with Instant Change Option */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Classroom / Laboratory Room
                      </span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">
                        {currentRoom
                          ? `${currentRoom.building} - Room ${currentRoom.room_number} (${currentRoom.room_type || 'Lecture'}, Cap: ${currentRoom.capacity})`
                          : 'No Room Assigned'}
                      </p>
                    </div>
                    {!isChangingRoom && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoomId(currentRoom?.id || '');
                          setIsChangingRoom(true);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer underline"
                      >
                        Change Room
                      </button>
                    )}
                  </div>

                  {isChangingRoom && (
                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center space-x-2">
                      <select
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(Number(e.target.value))}
                        className="flex-1 bg-white border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Choose New Room --</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.building} - {r.room_number} ({r.room_type}, Cap: {r.capacity})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleRoomSave}
                        disabled={isUpdating || !selectedRoomId}
                        className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsChangingRoom(false)}
                        className="text-slate-600 hover:text-slate-800 px-2 py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isConfirmingDelete && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Remove Slot</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

