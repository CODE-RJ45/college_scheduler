"use client";

import React, { useState, useMemo, useEffect } from 'react';

interface PendingDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingDrop: {
    subject: any;
    day: string;
    start_time: string;
    end_time: string;
    targetProfessorId?: number;
    targetSectionId?: number;
  } | null;
  rooms: any[];
  scheduleSlots?: any[];
  onConfirm: (roomId: number | null) => Promise<void>;
}

// Convert "HH:mm" or "HH:mm:ss" to total minutes
const toMinutes = (timeStr?: string) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

// Check if two time intervals overlap
const isTimeOverlap = (s1Start: string, s1End: string, s2Start: string, s2End: string) => {
  return Math.max(toMinutes(s1Start), toMinutes(s2Start)) < Math.min(toMinutes(s1End), toMinutes(s2End));
};

const formatTime12 = (timeStr: string) => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export default function PendingDropModal({
  isOpen,
  onClose,
  pendingDrop,
  rooms,
  scheduleSlots = [],
  onConfirm,
}: PendingDropModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomFilterTab, setRoomFilterTab] = useState<'MATCHING' | 'AVAILABLE' | 'ALL'>('MATCHING');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subject & Block Details
  const blockType = pendingDrop?.subject?.blockInfo?.type;
  const isLab = blockType === 'Laboratory' || (pendingDrop?.subject?.course?.has_lab && (pendingDrop?.subject?.blockInfo?.hours || 0) >= 2.5);
  const isAsync = blockType === 'Async';
  const targetRoomType = isLab ? 'LABORATORY' : 'LECTURE';
  const sectionCapacity = Number(pendingDrop?.subject?.section?.capacity) || 0;

  // Compute real-time availability for each room at the pending drop time
  const evaluatedRooms = useMemo(() => {
    if (!pendingDrop) return [];

    return rooms.map((room) => {
      // Find any slot that overlaps with the pending drop time on the same day
      const conflictSlot = scheduleSlots.find((slot: any) => {
        if (!slot.room || slot.room.id !== room.id) return false;
        if (slot.day_of_week !== pendingDrop.day) return false;
        return isTimeOverlap(slot.start_time, slot.end_time, pendingDrop.start_time, pendingDrop.end_time);
      });

      const isOccupied = Boolean(conflictSlot);
      const isTypeMatch = (room.room_type || 'LECTURE').toUpperCase() === targetRoomType;
      const meetsCapacity = sectionCapacity > 0 ? room.capacity >= sectionCapacity : true;

      let occupantName = '';
      if (conflictSlot) {
        const courseCode = conflictSlot.section_subject?.course?.code || conflictSlot.custom_title || 'Booked';
        const sec = conflictSlot.section_subject?.section?.name ? `(${conflictSlot.section_subject.section.name})` : '';
        occupantName = `${courseCode} ${sec}`.trim();
      }

      return {
        ...room,
        isOccupied,
        occupantName,
        isTypeMatch,
        meetsCapacity,
      };
    });
  }, [rooms, scheduleSlots, pendingDrop, targetRoomType, sectionCapacity]);

  // Filtered rooms based on current active tab & search query
  const displayedRooms = useMemo(() => {
    return evaluatedRooms.filter((r) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = `${r.building || ''} ${r.room_number || ''}`.toLowerCase().includes(q);
        const matchesType = (r.room_type || '').toLowerCase().includes(q);
        if (!matchesName && !matchesType) return false;
      }

      // Tab filter
      if (roomFilterTab === 'MATCHING') {
        return r.isTypeMatch;
      }
      if (roomFilterTab === 'AVAILABLE') {
        return !r.isOccupied;
      }
      return true;
    });
  }, [evaluatedRooms, roomFilterTab, searchQuery]);

  // Auto-select the first available matching room on initial open
  useEffect(() => {
    if (!isOpen || !pendingDrop) {
      setSelectedRoomId(null);
      setSearchQuery('');
      setRoomFilterTab('MATCHING');
      return;
    }

    if (isAsync) {
      setSelectedRoomId(null);
      return;
    }

    // Find first available matching room that meets capacity
    const bestMatch = evaluatedRooms.find(
      (r) => r.isTypeMatch && !r.isOccupied && r.meetsCapacity
    ) || evaluatedRooms.find(
      (r) => r.isTypeMatch && !r.isOccupied
    ) || evaluatedRooms.find(
      (r) => !r.isOccupied
    );

    if (bestMatch) {
      setSelectedRoomId(bestMatch.id);
    } else {
      setSelectedRoomId(null);
    }
  }, [isOpen, pendingDrop, evaluatedRooms, isAsync]);

  if (!isOpen || !pendingDrop) return null;

  const handleConfirm = async () => {
    if (!isAsync && !selectedRoomId) return;
    setIsSubmitting(true);
    try {
      await onConfirm(isAsync ? null : selectedRoomId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header Strip */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Classroom Selection
              </span>
              <span className="text-slate-500">&bull;</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                  isLab
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                    : isAsync
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                }`}
              >
                {isLab ? 'Laboratory Session' : isAsync ? 'Online Asynchronous' : 'Lecture Session'}
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              {pendingDrop.subject?.course?.code} &mdash; {pendingDrop.subject?.course?.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {pendingDrop.day} &bull; {formatTime12(pendingDrop.start_time)} &ndash; {formatTime12(pendingDrop.end_time)}{' '}
              ({pendingDrop.subject?.blockInfo?.hours || 1} hrs)
              {pendingDrop.subject?.section && (
                <span className="ml-1 text-slate-300">
                  &bull; Section {pendingDrop.subject.section.name || 'A'} (Cap: {sectionCapacity})
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {isAsync ? (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  No Classroom Required
                </span>
              </div>
              <p className="text-xs text-purple-800 leading-relaxed">
                This is an Asynchronous Online session (1 hour). It does not require a physical room booking and will be recorded directly on the student and faculty timetable.
              </p>
            </div>
          ) : (
            <>
              {/* Filter Tabs & Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setRoomFilterTab('MATCHING')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        roomFilterTab === 'MATCHING'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {isLab ? 'Laboratories' : 'Lecture Rooms'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoomFilterTab('AVAILABLE')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        roomFilterTab === 'AVAILABLE'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Available Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoomFilterTab('ALL')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        roomFilterTab === 'ALL'
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Rooms
                    </button>
                  </div>

                  <span className="text-[11px] font-semibold text-slate-500">
                    {displayedRooms.filter((r) => !r.isOccupied).length} Available
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by building, room number..."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                  />
                  <svg
                    className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Rooms List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {displayedRooms.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No classrooms found matching criteria.
                  </div>
                ) : (
                  displayedRooms.map((room) => {
                    const isSelected = selectedRoomId === room.id;
                    const isOccupied = room.isOccupied;

                    return (
                      <div
                        key={room.id}
                        onClick={() => {
                          if (!isOccupied) setSelectedRoomId(room.id);
                        }}
                        className={`p-3 rounded-lg border transition-all text-xs flex items-center justify-between ${
                          isOccupied
                            ? 'bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500 cursor-pointer shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="selectedRoom"
                            checked={isSelected}
                            disabled={isOccupied}
                            onChange={() => {
                              if (!isOccupied) setSelectedRoomId(room.id);
                            }}
                            className="text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">
                                {room.building} &mdash; Room {room.room_number}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider ${
                                  (room.room_type || '').toUpperCase() === 'LABORATORY'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {room.room_type || 'Lecture'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1.5">
                              <span>Capacity: {room.capacity}</span>
                              {sectionCapacity > 0 && (
                                <>
                                  <span>&bull;</span>
                                  <span
                                    className={
                                      room.capacity >= sectionCapacity
                                        ? 'text-emerald-700 font-medium'
                                        : 'text-amber-700 font-medium'
                                    }
                                  >
                                    {room.capacity >= sectionCapacity
                                      ? `Fits cohort (${sectionCapacity})`
                                      : `Under capacity (${sectionCapacity} needed)`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isOccupied ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                              <span>In Use: {room.occupantName}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Available
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {!isAsync && selectedRoomId ? (
              <span>
                Selected:{' '}
                <strong className="text-slate-800">
                  {rooms.find((r) => r.id === selectedRoomId)?.building} - Room{' '}
                  {rooms.find((r) => r.id === selectedRoomId)?.room_number}
                </strong>
              </span>
            ) : isAsync ? (
              <span className="text-purple-700 font-semibold">Online Asynchronous (No Room)</span>
            ) : (
              <span className="text-amber-700">Please select an available room</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-white text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || (!isAsync && !selectedRoomId)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
