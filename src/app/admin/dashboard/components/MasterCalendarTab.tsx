"use client";

import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import toast from 'react-hot-toast';
import ScheduleDetailModal from './ScheduleDetailModal';
import CustomSlotModal from './CustomSlotModal';
import PendingDropModal from './PendingDropModal';
import { suggestFacultySlots, SlotSuggestion } from '../utils/slotSuggester';
import { exportTimetableToExcel } from '../utils/timetableExporter';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const DnDCalendar = withDragAndDrop(Calendar);

moment.updateLocale('en', {
  week: {
    dow: 1, // First day of week is Monday
  },
});

const localizer = momentLocalizer(moment);

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

interface MasterCalendarTabProps {
  rooms: any[];
  instructors: any[];
  sections: any[];
  sectionSubjects: any[];
  scheduleSlots: any[];
  departments: Department[];
  terms: Term[];
  fetchData: () => void;
  setScheduleSlots: React.Dispatch<React.SetStateAction<any[]>>;
  onClearAll: () => void;
  onExportCSV: () => void;
  onExportICS: () => void;
  calendarViewType?: 'room' | 'instructor' | 'section' | 'all_rooms_daily';
  setCalendarViewType?: (type: 'room' | 'instructor' | 'section' | 'all_rooms_daily') => void;
  selectedCalendarId?: string;
  setSelectedCalendarId?: (id: string) => void;
}

// Map database DAY codes to calendar dates in August 2026 (Mon Aug 24 - Sun Aug 30)
const dayMap: { [key: string]: number } = {
  MON: 24,
  TUE: 25,
  WED: 26,
  THU: 27,
  FRI: 28,
  SAT: 29,
  SUN: 30,
};

const dayMapRev: { [key: number]: string } = {
  24: 'MON',
  25: 'TUE',
  26: 'WED',
  27: 'THU',
  28: 'FRI',
  29: 'SAT',
  30: 'SUN',
};

// Calculate hours between two "HH:mm" strings
const calculateHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  return (endH * 60 + endM - (startH * 60 + startM)) / 60;
};

// Format HH:mm or Date into 12-hour AM/PM format
const formatTime12 = (timeStr?: string, dateObj?: Date) => {
  if (timeStr) {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    }
  }
  if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
    const h = dateObj.getHours();
    const m = dateObj.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  }
  return '';
};

// Custom Event component inside Calendar grid
const CalendarCustomEvent = ({ event }: any) => {
  const slot = event.resource;

  if (event.is_blackout) {
    return (
      <div className="flex flex-col h-full justify-center items-center text-center p-1 text-[11px] font-bold text-slate-400 select-none bg-slate-100/90 border border-dashed border-slate-300 rounded">
        <span>⛔ Unavailable</span>
        <span className="text-[9px] font-normal text-slate-400">Declared Off Hours</span>
      </div>
    );
  }

  if (slot?.is_recommendation_preview) {
    return (
      <div className="flex flex-col h-full justify-between p-1.5 text-xs select-none bg-emerald-50 text-emerald-950 rounded border-2 border-dashed border-emerald-500 shadow-md">
        <div className="flex items-center justify-between font-black">
          <span className="truncate flex items-center gap-1 text-[11px] text-emerald-900">
            <span className="text-amber-500">⚡</span>
            <span>Recommended Slot</span>
          </span>
          <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded shadow-2xs">
            Click to Place
          </span>
        </div>
        <div className="text-[11px] font-extrabold text-emerald-900 truncate my-0.5">
          {slot.subject?.course?.code} ({slot.subject?.blockInfo?.type})
        </div>
        <div className="flex items-center justify-between text-[10px] text-emerald-800 font-bold border-t border-emerald-300/80 pt-0.5 mt-auto">
          <span>Sec {slot.subject?.section?.name || 'A'}</span>
          <span>{slot.suggestion?.room ? `Rm ${slot.suggestion.room.room_number}` : 'Online / Async'}</span>
        </div>
      </div>
    );
  }

  if (!slot || !slot.id) {
    return (
      <div className="flex flex-col h-full p-1 text-xs overflow-hidden opacity-70">
        <div className="font-bold text-white truncate drop-shadow-xs">
          {event.title || 'Scheduling...'}
        </div>
      </div>
    );
  }

  const isCustom = slot.is_custom;
  const course = slot.section_subject?.course;
  const section = slot.section_subject?.section;
  const professor = slot.section_subject?.professor || slot.professor;
  const room = slot.room;

  const durationHours = slot.end_time && slot.start_time
    ? (new Date(`2000-01-01T${slot.end_time}`).getTime() - new Date(`2000-01-01T${slot.start_time}`).getTime()) / (1000 * 60 * 60)
    : 1.5;
  const isShort = durationHours <= 1;

  // Accurate Slot Type Classification (Lab, F2F Lecture, Asynchronous)
  const isAsync = !isCustom && (!room || room === null || slot.is_async);
  const isLab = !isCustom && !isAsync && (room?.room_type === 'LABORATORY' || (durationHours >= 2.5 && course?.has_lab));
  const isLec = !isCustom && !isAsync && !isLab;

  const slotTypeLabel = isCustom ? 'Custom Slot' : isAsync ? 'Asynchronous' : isLab ? 'Laboratory' : 'Lecture';
  const slotTypeBadge = isCustom ? 'Custom' : isAsync ? 'Async' : isLab ? 'Lab' : 'Lec';

  const courseCode = isCustom ? (slot.custom_title || 'Custom Slot') : (course?.code || event.title || 'TBA');
  const sectionText = section ? `Sec ${section.name || 'A'}` : 'Sec A';
  const secShort = section?.name || 'A';

  const roomText = isCustom 
    ? (room ? `Rm ${room.room_number}` : 'Custom')
    : isAsync 
    ? 'Online / Async' 
    : (room ? `Rm ${room.room_number}` : 'TBA');

  const rmShort = isCustom 
    ? (room ? room.room_number : 'Evt')
    : isAsync 
    ? 'Async' 
    : (room?.room_number || 'TBA');

  const professorText = professor ? `${professor.first_name || ''} ${professor.last_name || ''}`.trim() : 'TBA';
  const profShort = professor ? (professor.last_name || 'TBA') : 'TBA';

  const formattedStartTime = formatTime12(slot.start_time, event.start);
  const formattedEndTime = formatTime12(slot.end_time, event.end);
  const timeRangeText = formattedStartTime && formattedEndTime ? `${formattedStartTime} – ${formattedEndTime}` : '';

  const tooltipText = isCustom 
    ? `${courseCode}${timeRangeText ? ` | ${timeRangeText}` : ''} | ${roomText}`
    : `${courseCode}${course?.name ? ` - ${course.name}` : ''} (${slotTypeBadge})${timeRangeText ? ` | ${timeRangeText}` : ''} | ${sectionText} | ${roomText}${professorText !== 'TBA' ? ` | Prof: ${professorText}` : ''}`;

  // Smart Tooltip Direction: slots starting before 9:00 AM (e.g. 7:30 AM) render downward to prevent collision with weekday headers
  const [startH] = (slot.start_time || '08:00').split(':').map(Number);
  const isEarlySlot = startH < 9;
  const vertAlignClass = isEarlySlot ? "top-[calc(100%+6px)]" : "bottom-[calc(100%+6px)]";
  const caretVertClass = isEarlySlot ? "bottom-full border-b-slate-900/95 border-b-4 border-t-0" : "top-full border-t-slate-900/95 border-t-4 border-b-0";

  // Prevent horizontal tooltip overflow on edge columns (Monday & Weekend)
  const day = slot.day_of_week;
  const horizAlignClass = day === 'MON' ? "left-0 translate-x-0" : (day === 'SUN' || day === 'SAT') ? "right-0 translate-x-0" : "left-1/2 -translate-x-1/2";
  const caretHorizClass = day === 'MON' ? "left-4 translate-x-0" : (day === 'SUN' || day === 'SAT') ? "right-4 translate-x-0" : "left-1/2 -translate-x-1/2";

  return (
    <div 
      className="group relative flex flex-col justify-between h-full p-0.5 sm:p-1 text-[10px] overflow-visible leading-tight select-none"
      title={tooltipText}
    >
      {/* Top: Course Code & Lab/Lec/Async Badge */}
      <div className="flex items-center justify-between gap-0.5 sm:gap-1 w-full min-w-0 leading-none">
        <span className="font-black text-slate-900 tracking-tight truncate text-[9.5px] sm:text-[10.5px]">
          {courseCode}
        </span>
        {isCustom ? (
          <span className="text-[7px] sm:text-[7.5px] bg-emerald-200/90 text-emerald-950 font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Custom
          </span>
        ) : isAsync ? (
          <span className="text-[7px] sm:text-[7.5px] bg-purple-200 text-purple-950 font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Async
          </span>
        ) : isLab ? (
          <span className="text-[7px] sm:text-[7.5px] bg-amber-200 text-amber-950 font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Lab
          </span>
        ) : (
          <span className="text-[7px] sm:text-[7.5px] bg-indigo-200/90 text-indigo-950 font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Lec
          </span>
        )}
      </div>

      {isShort ? (
        /* Compact Responsive Layout for 1-hour slots: Course, Sec/Room, and Faculty all visible */
        <div className="flex items-center justify-between gap-0.5 text-[8.5px] sm:text-[9px] font-bold text-slate-700 leading-none mt-auto pt-0.5 border-t border-slate-300/40 w-full min-w-0">
          <span className="truncate bg-white/80 px-0.5 py-0.5 rounded text-slate-900 font-bold shrink-0">
            {isCustom ? 'Event' : `S-${secShort} • ${rmShort}`}
          </span>
          <span className="truncate text-right font-bold text-indigo-950 bg-white/80 px-0.5 py-0.5 rounded min-w-0" title={professorText}>
            {isCustom ? roomText : profShort}
          </span>
        </div>
      ) : (
        /* Multi-row Layout for standard and longer slots */
        <>
          <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[9.5px] font-bold text-slate-800 my-auto py-0.5 leading-none w-full min-w-0">
            <span className="truncate bg-white/75 px-1 py-0.5 rounded text-slate-900 font-bold">
              {isCustom ? 'Custom Event' : sectionText}
            </span>
            <span className={`truncate text-right font-black bg-white/75 px-1 py-0.5 rounded shrink-0 ${isAsync ? 'text-purple-950' : 'text-indigo-950'}`}>
              {roomText}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-[8.5px] sm:text-[9px] font-semibold text-slate-700 mt-auto pt-0.5 border-t border-slate-300/40 w-full min-w-0 leading-none">
            <span className="truncate text-slate-500 font-medium">Faculty:</span>
            <span className="truncate text-right font-bold text-slate-800" title={professorText}>
              {profShort}
            </span>
          </div>
        </>
      )}

      {/* Floating Hover Tooltip: prominent, direction-aware & collision-safe */}
      <div className={`absolute ${horizAlignClass} ${vertAlignClass} hidden group-hover:flex flex-col bg-slate-900/95 backdrop-blur-md text-white rounded-lg p-2.5 shadow-xl border border-slate-700/80 z-[100] pointer-events-none min-w-[200px] max-w-[300px] transition-all duration-150 transform scale-95 group-hover:scale-100`}>
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700">
          <span className="font-black text-xs text-indigo-300 tracking-wide">{courseCode}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
            isCustom ? 'bg-slate-800 text-slate-300 border-slate-700' :
            isAsync ? 'bg-purple-900/80 text-purple-200 border-purple-700' :
            isLab ? 'bg-amber-900/80 text-amber-200 border-amber-700' :
            'bg-indigo-900/80 text-indigo-200 border-indigo-700'
          }`}>
            {slotTypeLabel}
          </span>
        </div>
        {!isCustom && course?.name && (
          <div className="text-[10px] text-slate-300 font-medium py-1 line-clamp-2">
            {course.name}
          </div>
        )}

        {/* Start & End Time Badge */}
        {timeRangeText && (
          <div className="flex items-center gap-1.5 text-[10.5px] text-cyan-300 font-bold py-1 border-t border-slate-800/80">
            <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="tracking-tight">{timeRangeText}</span>
            {durationHours > 0 && (
              <span className="text-[9px] text-slate-400 font-normal">({durationHours}h)</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-1.5 text-[10px] border-t border-slate-800 text-slate-300">
          <span className="font-bold text-amber-300">{isCustom ? 'Custom Event' : sectionText}</span>
          <span className={`font-bold ${isAsync ? 'text-purple-300' : 'text-emerald-300'}`}>{roomText}</span>
        </div>
        {professor && (
          <div className="text-[9px] text-slate-400 mt-1 truncate">
            Prof: <span className="text-slate-200 font-semibold">{professorText}</span>
          </div>
        )}
        {/* Tooltip caret */}
        <div className={`absolute ${caretHorizClass} ${caretVertClass} w-0 h-0 border-x-4 border-x-transparent`}></div>
      </div>
    </div>
  );
};

export default function MasterCalendarTab({
  rooms,
  instructors,
  sections,
  sectionSubjects,
  scheduleSlots,
  departments,
  terms,
  fetchData,
  setScheduleSlots,
  onClearAll,
  onExportCSV,
  onExportICS,
  calendarViewType: propCalendarViewType,
  setCalendarViewType: propSetCalendarViewType,
  selectedCalendarId: propSelectedCalendarId,
  setSelectedCalendarId: propSetSelectedCalendarId,
}: MasterCalendarTabProps) {
  // Find active term
  const activeTerm = useMemo(() => terms.find((t) => t.is_active) || null, [terms]);
  const [termFilter, setTermFilter] = useState<'ACTIVE' | number | 'ALL'>('ACTIVE');

  // Controlled or uncontrolled Calendar View Type & Selected ID
  const [internalViewType, setInternalViewType] = useState<
    'room' | 'instructor' | 'section' | 'all_rooms_daily'
  >('room');
  const [internalSelectedId, setInternalSelectedId] = useState<string>('');

  const calendarViewType = propCalendarViewType ?? internalViewType;
  const setCalendarViewType = propSetCalendarViewType ?? setInternalViewType;

  const selectedCalendarId = propSelectedCalendarId ?? internalSelectedId;
  const setSelectedCalendarId = propSetSelectedCalendarId ?? setInternalSelectedId;

  // Daily Matrix Day Picker
  const [dailyMatrixDay, setDailyMatrixDay] = useState<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'>('MON');

  // Entity search filter inside combobox
  const [entitySearch, setEntitySearch] = useState('');

  // Unscheduled Drawer State
  const [isUnscheduledDrawerOpen, setIsUnscheduledDrawerOpen] = useState(true);
  const [unscheduledSearch, setUnscheduledSearch] = useState('');
  const [unscheduledTypeFilter, setUnscheduledTypeFilter] = useState<'ALL' | 'LEC' | 'LAB' | 'ASYNC'>('ALL');
  const [matchCurrentSelectionOnly, setMatchCurrentSelectionOnly] = useState(false);
  const [expandedSuggestionsSubjectId, setExpandedSuggestionsSubjectId] = useState<string | null>(null);
  const [previewSuggestedSlot, setPreviewSuggestedSlot] = useState<{
    subject: any;
    suggestion: SlotSuggestion;
  } | null>(null);
  const [isInsertingSuggestedSlot, setIsInsertingSuggestedSlot] = useState(false);

  // Dragging & Hover state
  const [draggedEvent, setDraggedEvent] = useState<any>(null);

  // Modals state
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Custom Slot Modal State
  const [isCustomSlotModalOpen, setIsCustomSlotModalOpen] = useState(false);
  const [isEditCustomSlot, setIsEditCustomSlot] = useState(false);
  const [editingCustomSlotId, setEditingCustomSlotId] = useState<number | null>(null);
  const [customSlotDetails, setCustomSlotDetails] = useState({
    title: '',
    countsTowardsHours: true,
    countsTowardsUnits: false,
    unitsValue: '0',
    start: null as Date | null,
    end: null as Date | null,
  });

  // Pending Drop Modal State
  const [pendingDrop, setPendingDrop] = useState<{
    subject: any;
    day: string;
    start_time: string;
    end_time: string;
    targetProfessorId?: number;
    targetSectionId?: number;
  } | null>(null);

  // Filter terms
  const currentTermId = useMemo(() => {
    if (termFilter === 'ACTIVE') return activeTerm?.id || null;
    if (termFilter === 'ALL') return null;
    return termFilter;
  }, [termFilter, activeTerm]);

  // Filtered entity list for current view type
  const availableEntities = useMemo(() => {
    const q = entitySearch.toLowerCase().trim();
    if (calendarViewType === 'room') {
      return rooms.filter((r) => {
        const text = `${r.building} ${r.room_number} ${r.room_type}`.toLowerCase();
        return !q || text.includes(q);
      });
    }
    if (calendarViewType === 'instructor') {
      return instructors.filter((inst) => {
        const text = `${inst.first_name} ${inst.last_name} ${inst.email}`.toLowerCase();
        return !q || text.includes(q);
      });
    }
    if (calendarViewType === 'section') {
      return sections.filter((s) => {
        if (currentTermId && s.term?.id !== currentTermId) return false;
        const text = `${s.department?.code || ''} ${s.name} Year ${s.year_level}`.toLowerCase();
        return !q || text.includes(q);
      });
    }
    return [];
  }, [calendarViewType, entitySearch, rooms, instructors, sections, currentTermId]);

  // Set default selection when switching view type
  const handleViewTypeChange = (type: 'room' | 'instructor' | 'section' | 'all_rooms_daily') => {
    setCalendarViewType(type);
    setEntitySearch('');
    if (type === 'all_rooms_daily') {
      setSelectedCalendarId('');
      return;
    }
    // Auto-select first entity if none selected
    let firstId = '';
    if (type === 'room' && rooms.length > 0) firstId = rooms[0].id.toString();
    if (type === 'instructor' && instructors.length > 0) firstId = instructors[0].id.toString();
    if (type === 'section' && sections.length > 0) firstId = sections[0].id.toString();
    setSelectedCalendarId(firstId);
  };

  // Quick Prev / Next cycling
  const handleCycleEntity = (direction: 'prev' | 'next') => {
    if (availableEntities.length === 0) return;
    const currentIndex = availableEntities.findIndex((e) => e.id.toString() === selectedCalendarId);
    let nextIndex = 0;
    if (currentIndex === -1) {
      nextIndex = 0;
    } else if (direction === 'prev') {
      nextIndex = (currentIndex - 1 + availableEntities.length) % availableEntities.length;
    } else {
      nextIndex = (currentIndex + 1) % availableEntities.length;
    }
    setSelectedCalendarId(availableEntities[nextIndex].id.toString());
  };

  // Current entity object
  const currentEntity = useMemo(() => {
    if (!selectedCalendarId) return null;
    if (calendarViewType === 'room') return rooms.find((r) => r.id.toString() === selectedCalendarId);
    if (calendarViewType === 'instructor')
      return instructors.find((i) => i.id.toString() === selectedCalendarId);
    if (calendarViewType === 'section')
      return sections.find((s) => s.id.toString() === selectedCalendarId);
    return null;
  }, [calendarViewType, selectedCalendarId, rooms, instructors, sections]);

  // Compute Unscheduled Subjects list
  const unscheduledSubjects = useMemo(() => {
    return sectionSubjects.flatMap((ss: any) => {
      // Term filter
      if (currentTermId && ss.section?.term?.id !== currentTermId) return [];

      // Contextual "Match Current Selection" filter
      if (matchCurrentSelectionOnly) {
        if (calendarViewType === 'instructor' && selectedCalendarId) {
          if (ss.professor?.id?.toString() !== selectedCalendarId) return [];
        }
        if (calendarViewType === 'section' && selectedCalendarId) {
          if (ss.section?.id?.toString() !== selectedCalendarId) return [];
        }
      }

      // Search filter
      if (unscheduledSearch) {
        const q = unscheduledSearch.toLowerCase().trim();
        const code = ss.course?.code?.toLowerCase() || '';
        const name = ss.course?.name?.toLowerCase() || '';
        const sec = ss.section?.name?.toLowerCase() || '';
        const prof = `${ss.professor?.first_name || ''} ${ss.professor?.last_name || ''}`.toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !sec.includes(q) && !prof.includes(q)) {
          return [];
        }
      }

      const ssSlots = scheduleSlots.filter((slot: any) => slot.section_subject?.id === ss.id);
      const scheduledHours = ssSlots.reduce(
        (acc: number, slot: any) => acc + calculateHours(slot.start_time, slot.end_time),
        0
      );
      const targetHours = ss.course?.has_lab ? 5 : ss.course?.credits || 3;

      if (scheduledHours >= targetHours) return [];

      const remainingHours = targetHours - scheduledHours;
      const blocks: any[] = [];

      if (ss.course?.has_lab) {
        // Institutional Curriculum: 3h Lab (Lab Room) + 1h F2F Lecture (Lecture Room) + 1h Asynchronous (Total 5h)
        const hasLabScheduled = ssSlots.some(
          (s: any) => s.room?.room_type === 'LABORATORY' || calculateHours(s.start_time, s.end_time) >= 2.5
        );
        const hasAsyncScheduled = ssSlots.some(
          (s: any) => !s.room || s.room === null || s.is_async
        );
        const hasF2FLecScheduled = ssSlots.some(
          (s: any) => s.room && s.room.room_type !== 'LABORATORY' && calculateHours(s.start_time, s.end_time) < 2.5
        );

        // 1. Laboratory block (3 hours)
        if (
          !hasLabScheduled &&
          (unscheduledTypeFilter === 'ALL' || unscheduledTypeFilter === 'LAB')
        ) {
          blocks.push({
            ...ss,
            blockInfo: { type: 'Laboratory', hours: 3, roomType: 'LABORATORY' },
            _renderId: `${ss.id}-lab`,
          });
        }

        // 2. Synchronous F2F Lecture block (1 hour)
        if (
          !hasF2FLecScheduled &&
          (unscheduledTypeFilter === 'ALL' || unscheduledTypeFilter === 'LEC')
        ) {
          blocks.push({
            ...ss,
            blockInfo: { type: 'Lecture', hours: 1, roomType: 'LECTURE' },
            _renderId: `${ss.id}-lec-f2f`,
          });
        }

        // 3. Asynchronous Online Lecture block (1 hour)
        if (
          !hasAsyncScheduled &&
          (unscheduledTypeFilter === 'ALL' || unscheduledTypeFilter === 'ASYNC')
        ) {
          blocks.push({
            ...ss,
            blockInfo: { type: 'Async', hours: 1, roomType: null },
            _renderId: `${ss.id}-lec-async`,
          });
        }
      } else {
        // Institutional Curriculum: 2h F2F Lecture (Lecture Room) + 1h Asynchronous (Total 3h)
        const hasAsyncScheduled = ssSlots.some(
          (s: any) => !s.room || s.room === null || s.is_async
        );
        const f2fHoursScheduled = ssSlots
          .filter((s: any) => s.room && !s.is_async)
          .reduce((acc: number, s: any) => acc + calculateHours(s.start_time, s.end_time), 0);

        const targetF2FHours = 2;
        const remainingF2F = targetF2FHours - f2fHoursScheduled;

        // Synchronous F2F Lecture block (2 hours)
        if (
          remainingF2F > 0 &&
          (unscheduledTypeFilter === 'ALL' || unscheduledTypeFilter === 'LEC')
        ) {
          blocks.push({
            ...ss,
            blockInfo: {
              type: 'Lecture',
              hours: remainingF2F,
              roomType: 'LECTURE',
            },
            _renderId: `${ss.id}-lec-f2f`,
          });
        }

        // Asynchronous Online Lecture block (1 hour)
        if (
          !hasAsyncScheduled &&
          (unscheduledTypeFilter === 'ALL' || unscheduledTypeFilter === 'ASYNC')
        ) {
          blocks.push({
            ...ss,
            blockInfo: { type: 'Async', hours: 1, roomType: null },
            _renderId: `${ss.id}-lec-async`,
          });
        }
      }

      return blocks;
    });
  }, [
    sectionSubjects,
    scheduleSlots,
    currentTermId,
    matchCurrentSelectionOnly,
    calendarViewType,
    selectedCalendarId,
    unscheduledSearch,
    unscheduledTypeFilter,
  ]);

  // Compute Calendar Events for Weekly View
  const calendarEvents = useMemo(() => {
    let filtered = scheduleSlots;

    if (calendarViewType === 'room') {
      if (!selectedCalendarId) return [];
      filtered = scheduleSlots.filter(
        (slot) => slot.room && slot.room.id.toString() === selectedCalendarId
      );
    } else if (calendarViewType === 'instructor') {
      if (!selectedCalendarId) return [];
      filtered = scheduleSlots.filter((slot) => {
        if (slot.is_custom) return slot.professor?.id?.toString() === selectedCalendarId;
        return (
          slot.section_subject?.professor &&
          slot.section_subject.professor.id.toString() === selectedCalendarId
        );
      });
    } else if (calendarViewType === 'section') {
      if (!selectedCalendarId) return [];
      filtered = scheduleSlots.filter(
        (slot) =>
          slot.section_subject?.section &&
          slot.section_subject.section.id.toString() === selectedCalendarId
      );
    } else {
      return [];
    }

    const events = filtered.map((slot) => {
      const dayNum = dayMap[slot.day_of_week];
      const [startH, startM] = (slot.start_time || '08:00').split(':').map(Number);
      const [endH, endM] = (slot.end_time || '09:00').split(':').map(Number);

      const title = slot.is_custom
        ? slot.custom_title || 'Custom Activity'
        : slot.section_subject?.course?.code || 'Subject';

      return {
        id: slot.id,
        title,
        start: new Date(2026, 7, dayNum, startH, startM),
        end: new Date(2026, 7, dayNum, endH, endM),
        resource: slot,
      };
    });

    // Faculty Blackout Availability Overlays
    if (calendarViewType === 'instructor' && selectedCalendarId) {
      const prof = instructors.find((i) => i.id.toString() === selectedCalendarId);
      if (prof) {
        const availDays = (prof.available_days || 'MON,TUE,WED,THU,FRI,SAT').split(',');
        const [availStartH, availStartM] = (prof.available_start_time || '07:30').split(':').map(Number);
        const [availEndH, availEndM] = (prof.available_end_time || '19:00').split(':').map(Number);

        // Iterate Monday to Sunday
        Object.entries(dayMap).forEach(([dayCode, dayNum]) => {
          if (!availDays.includes(dayCode)) {
            // Full day blackout
            events.push({
              id: `blackout-full-${dayCode}`,
              title: 'Unavailable',
              start: new Date(2026, 7, dayNum, 7, 30),
              end: new Date(2026, 7, dayNum, 19, 0),
              resource: { id: null },
              is_blackout: true,
            } as any);
          } else {
            // Early morning blackout if available_start_time > 07:30
            if (availStartH > 7 || (availStartH === 7 && availStartM > 30)) {
              events.push({
                id: `blackout-morning-${dayCode}`,
                title: 'Unavailable',
                start: new Date(2026, 7, dayNum, 7, 30),
                end: new Date(2026, 7, dayNum, availStartH, availStartM),
                resource: { id: null },
                is_blackout: true,
              } as any);
            }
            // Evening blackout if available_end_time < 19:00
            if (availEndH < 19) {
              events.push({
                id: `blackout-evening-${dayCode}`,
                title: 'Unavailable',
                start: new Date(2026, 7, dayNum, availEndH, availEndM),
                end: new Date(2026, 7, dayNum, 19, 0),
                resource: { id: null },
                is_blackout: true,
              } as any);
            }
          }
        });
      }
    }

    // Ghost slot overlay for smart suggestion preview
    if (previewSuggestedSlot) {
      const { subject, suggestion } = previewSuggestedSlot;
      const dayNum = dayMap[suggestion.day];
      const [startH, startM] = suggestion.startTime.split(':').map(Number);
      const [endH, endM] = suggestion.endTime.split(':').map(Number);

      events.push({
        id: `preview-suggestion-${subject.id}`,
        title: `⚡ Place: ${subject.course?.code || 'Subject'}`,
        start: new Date(2026, 7, dayNum, startH, startM),
        end: new Date(2026, 7, dayNum, endH, endM),
        resource: {
          id: -999,
          is_recommendation_preview: true,
          subject,
          suggestion,
        },
      } as any);
    }

    return events;
  }, [scheduleSlots, calendarViewType, selectedCalendarId, instructors, previewSuggestedSlot]);

  // Instructor Weekly Load summary footer
  const instructorWeeklyStats = useMemo(() => {
    if (calendarViewType !== 'instructor' || !selectedCalendarId) return null;
    const hours: { [key: number]: number } = { 24: 0, 25: 0, 26: 0, 27: 0, 28: 0, 29: 0, 30: 0 };
    let total = 0;

    calendarEvents.forEach((ev: any) => {
      if (ev.is_blackout) return;
      if (ev.resource?.is_custom && !ev.resource.counts_towards_hours) return;
      const day = ev.start.getDate();
      const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
      if (hours[day] !== undefined) {
        hours[day] += duration;
      }
      total += duration;
    });

    return { hours, total: parseFloat(total.toFixed(1)) };
  }, [calendarViewType, selectedCalendarId, calendarEvents]);

  // Click on a calendar event: open ScheduleDetailModal
  const handleSelectEvent = (event: any) => {
    if (event.is_blackout) return;
    if (event.resource?.is_recommendation_preview) {
      handleInsertSuggestedSlot(event.resource.subject, event.resource.suggestion);
      return;
    }
    if (event.resource?.is_custom) {
      setEditingCustomSlotId(event.resource.id);
      setIsEditCustomSlot(true);
      setCustomSlotDetails({
        title: event.resource.custom_title || '',
        countsTowardsHours: event.resource.counts_towards_hours ?? true,
        countsTowardsUnits: event.resource.counts_towards_units ?? false,
        unitsValue: (event.resource.custom_units_value || 0).toString(),
        start: event.start,
        end: event.end,
      });
      setIsCustomSlotModalOpen(true);
      return;
    }

    setSelectedEventForDetail(event);
    setIsDetailModalOpen(true);
  };

  // 1-Click Insert for Recommended Faculty Timeslots
  const handleInsertSuggestedSlot = async (subject: any, suggestion: SlotSuggestion) => {
    setIsInsertingSuggestedSlot(true);
    try {
      const payload = {
        section_subject_id: subject.id,
        room_id: suggestion.room ? suggestion.room.id : null,
        day_of_week: suggestion.day,
        start_time: suggestion.startTime,
        end_time: suggestion.endTime,
      };

      await axios.post('http://localhost:8000/api/schedule-slots/', payload);
      const roomDesc = suggestion.room ? `in Rm ${suggestion.room.room_number}` : '(Asynchronous Online)';
      toast.success(
        `Scheduled ${subject.course?.code} on ${suggestion.day} (${suggestion.startTimeFormatted} - ${suggestion.endTimeFormatted}) ${roomDesc}!`,
        { icon: '⚡' }
      );
      setPreviewSuggestedSlot(null);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to place suggested slot:', err);
      const detail = err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to place slot.';
      toast.error(`Placement failed: ${detail}`);
    } finally {
      setIsInsertingSuggestedSlot(false);
    }
  };

  // Click on empty calendar slot
  const handleSelectSlot = ({ start, end }: any) => {
    if (calendarViewType !== 'instructor' || !selectedCalendarId) {
      toast.error('Select an Instructor timetable to schedule custom consultation or office hours.');
      return;
    }
    setEditingCustomSlotId(null);
    setIsEditCustomSlot(false);
    setCustomSlotDetails({
      title: '',
      countsTowardsHours: true,
      countsTowardsUnits: false,
      unitsValue: '0',
      start,
      end,
    });
    setIsCustomSlotModalOpen(true);
  };

  // Drag and drop existing event
  const onEventDrop = async ({ event, start, end }: any) => {
    if (event.is_blackout) return;

    const newStart = moment(start).format('HH:mm');
    const newEnd = moment(end).format('HH:mm');
    const day = dayMapRev[moment(start).date()];

    if (!day) {
      toast.error('Cannot move schedule to an invalid day outside the target week.');
      return;
    }

    // Instant local conflict detection
    const hasVisualConflict = calendarEvents.some((existing: any) => {
      if (existing.id === event.id || existing.is_blackout) return false;
      return Math.max(start.getTime(), existing.start.getTime()) < Math.min(end.getTime(), existing.end.getTime());
    });

    if (hasVisualConflict) {
      toast.error('Time slot overlaps with another scheduled class on this timetable.');
      return;
    }

    const originalSlots = [...scheduleSlots];
    // Optimistic UI update
    setScheduleSlots((prev) =>
      prev.map((slot) =>
        slot.id === event.resource.id
          ? { ...slot, day_of_week: day, start_time: newStart, end_time: newEnd }
          : slot
      )
    );

    try {
      await axios.patch(`http://localhost:8000/api/schedule-slots/${event.resource.id}/`, {
        day_of_week: day,
        start_time: newStart,
        end_time: newEnd,
      });
      toast.success('Period rescheduled successfully.');
      fetchData();
    } catch (err: any) {
      setScheduleSlots(originalSlots);
      const errorMsg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.message ||
        'Conflict detected. Could not move period.';
      toast.error(errorMsg);
    }
  };

  // Drop unscheduled subject from outside drawer
  const onDropFromOutside = async ({ start }: any) => {
    if (!draggedEvent || !selectedCalendarId) {
      toast.error('Please select a timetable first before placing a class.');
      return;
    }

    const durationHours = draggedEvent.blockInfo?.hours || 1;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    const newStart = moment(start).format('HH:mm');
    const newEnd = moment(end).format('HH:mm');
    const day = dayMapRev[moment(start).date()];

    if (!day) {
      toast.error('Cannot schedule outside the active week.');
      return;
    }

    // Visual conflict check
    const hasVisualConflict = calendarEvents.some((existing: any) => {
      if (existing.is_blackout) return false;
      return Math.max(start.getTime(), existing.start.getTime()) < Math.min(end.getTime(), existing.end.getTime());
    });

    if (hasVisualConflict) {
      toast.error('Conflict: Time slot overlaps with an existing scheduled class.');
      return;
    }

    // Dropping on Room view
    if (calendarViewType === 'room') {
      const currentRoom = rooms.find((r) => r.id.toString() === selectedCalendarId);
      const isLab = draggedEvent.blockInfo?.type === 'Laboratory';
      // If dropping a Lab subject onto a non-lab room, redirect to smart room selection
      if (isLab && currentRoom?.room_type !== 'LABORATORY') {
        toast('This class requires a Laboratory room. Please select an available laboratory.', {
          icon: '🔬',
        });
        setPendingDrop({
          subject: draggedEvent,
          day,
          start_time: newStart,
          end_time: newEnd,
        });
        return;
      }

      try {
        await axios.post('http://localhost:8000/api/schedule-slots/', {
          section_subject_id: draggedEvent.id,
          room_id: parseInt(selectedCalendarId),
          day_of_week: day,
          start_time: newStart,
          end_time: newEnd,
        });
        toast.success('Class scheduled successfully!');
        fetchData();
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.non_field_errors?.[0] ||
          err.response?.data?.message ||
          'Failed to schedule class. Check for conflict.';
        toast.error(errorMsg);
      } finally {
        setDraggedEvent(null);
      }
      return;
    }

    // Dropping on Instructor or Section calendar: prompt smart room picker!
    setPendingDrop({
      subject: draggedEvent,
      day,
      start_time: newStart,
      end_time: newEnd,
    });
  };

  // Confirm room for pending drop
  const confirmPendingDrop = async (roomId: number | null) => {
    if (!pendingDrop) return;
    try {
      await axios.post('http://localhost:8000/api/schedule-slots/', {
        section_subject_id: pendingDrop.subject.id,
        room_id: roomId,
        day_of_week: pendingDrop.day,
        start_time: pendingDrop.start_time,
        end_time: pendingDrop.end_time,
      });
      toast.success('Class scheduled successfully!');
      setPendingDrop(null);
      fetchData();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.message ||
        'Failed to schedule class. Check for room or professor conflicts.';
      toast.error(errorMsg);
    }
  };

  // Delete scheduled slot handler
  const handleDeleteSlot = async (slotId: number) => {
    try {
      await axios.delete(`http://localhost:8000/api/schedule-slots/${slotId}/`);
      toast.success('Period removed from schedule.');
      setIsDetailModalOpen(false);
      setSelectedEventForDetail(null);
      fetchData();
    } catch {
      toast.error('Failed to remove period.');
    }
  };

  // Change room on existing slot handler
  const handleUpdateRoom = async (slotId: number, newRoomId: number) => {
    try {
      await axios.patch(`http://localhost:8000/api/schedule-slots/${slotId}/`, {
        room_id: newRoomId,
      });
      toast.success('Room updated successfully.');
      fetchData();
      setIsDetailModalOpen(false);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.message ||
        'Room is already booked during this time.';
      toast.error(errorMsg);
    }
  };

  // Custom Slot Save handler
  const handleSaveCustomSlot = async () => {
    if (!customSlotDetails.title.trim() || !customSlotDetails.start || !customSlotDetails.end) {
      toast.error('Please provide a title and valid period.');
      return;
    }

    const newStart = moment(customSlotDetails.start).format('HH:mm');
    const newEnd = moment(customSlotDetails.end).format('HH:mm');
    const day = dayMapRev[moment(customSlotDetails.start).date()];

    try {
      if (isEditCustomSlot && editingCustomSlotId) {
        await axios.patch(`http://localhost:8000/api/schedule-slots/${editingCustomSlotId}/`, {
          custom_title: customSlotDetails.title,
          counts_towards_hours: customSlotDetails.countsTowardsHours,
          counts_towards_units: customSlotDetails.countsTowardsUnits,
          custom_units_value: customSlotDetails.countsTowardsUnits
            ? parseFloat(customSlotDetails.unitsValue)
            : 0,
          start_time: newStart,
          end_time: newEnd,
          day_of_week: day,
        });
        toast.success('Custom activity updated.');
      } else {
        await axios.post('http://localhost:8000/api/schedule-slots/', {
          is_custom: true,
          custom_title: customSlotDetails.title,
          professor_id: parseInt(selectedCalendarId),
          counts_towards_hours: customSlotDetails.countsTowardsHours,
          counts_towards_units: customSlotDetails.countsTowardsUnits,
          custom_units_value: customSlotDetails.countsTowardsUnits
            ? parseFloat(customSlotDetails.unitsValue)
            : 0,
          day_of_week: day,
          start_time: newStart,
          end_time: newEnd,
        });
        toast.success('Custom block added.');
      }
      setIsCustomSlotModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save custom block.');
    }
  };

  // Delete custom slot
  const handleDeleteCustomSlot = async () => {
    if (!editingCustomSlotId) return;
    try {
      await axios.delete(`http://localhost:8000/api/schedule-slots/${editingCustomSlotId}/`);
      toast.success('Custom activity removed.');
      setIsCustomSlotModalOpen(false);
      fetchData();
    } catch {
      toast.error('Failed to delete custom activity.');
    }
  };

  // Print timetable
  const handlePrint = () => {
    window.print();
  };

  // Filtered slots for currently selected calendar entity
  const currentViewSlots = useMemo(() => {
    if (calendarViewType === 'room') {
      if (!selectedCalendarId) return [];
      return scheduleSlots.filter((slot) => slot.room && slot.room.id.toString() === selectedCalendarId);
    } else if (calendarViewType === 'instructor') {
      if (!selectedCalendarId) return [];
      return scheduleSlots.filter((slot) => {
        if (slot.is_custom) return slot.professor?.id?.toString() === selectedCalendarId;
        return slot.section_subject?.instructor && slot.section_subject.instructor.id.toString() === selectedCalendarId;
      });
    } else if (calendarViewType === 'section') {
      if (!selectedCalendarId) return [];
      return scheduleSlots.filter(
        (slot) => slot.section_subject?.section && slot.section_subject.section.id.toString() === selectedCalendarId
      );
    }
    return scheduleSlots;
  }, [calendarViewType, selectedCalendarId, scheduleSlots]);

  const currentEntityTitle = useMemo(() => {
    if (calendarViewType === 'room') {
      const r = rooms.find((x) => x.id.toString() === selectedCalendarId);
      return r ? `Room ${r.name || r.room_number}` : 'Room Timetable';
    } else if (calendarViewType === 'instructor') {
      const i = instructors.find((x) => x.id.toString() === selectedCalendarId);
      return i ? `Faculty ${i.name || `${i.first_name || ''} ${i.last_name || ''}`.trim()}` : 'Faculty Timetable';
    } else if (calendarViewType === 'section') {
      const s = sections.find((x) => x.id.toString() === selectedCalendarId);
      return s ? `Section ${s.name}` : 'Section Timetable';
    }
    return 'Master College Timetable';
  }, [calendarViewType, selectedCalendarId, rooms, instructors, sections]);

  const handleExportExcel = () => {
    if (!currentViewSlots.length) {
      toast.error('No schedule slots found in the current view to export.');
      return;
    }
    const currentTermObj = terms.find((t) => t.id === termFilter) || activeTerm;
    exportTimetableToExcel({
      slots: currentViewSlots,
      entityTitle: currentEntityTitle,
      termName: currentTermObj?.name || 'Academic Term',
      departmentName: 'College Academic Scheduling System',
    });
    toast.success(`Exported ${currentEntityTitle} timetable to Excel.`);
  };

  const handleOpenTimetablePage = () => {
    const params = new URLSearchParams();
    if (calendarViewType && calendarViewType !== 'all_rooms_daily') {
      params.set('viewType', calendarViewType);
    }
    if (selectedCalendarId) {
      params.set('id', selectedCalendarId);
    }
    if (termFilter && termFilter !== 'ALL' && termFilter !== 'ACTIVE') {
      params.set('termId', termFilter.toString());
    }
    window.open(`/timetable?${params.toString()}`, '_blank');
  };

  // Daily matrix hours list (7:30 to 19:00 in 1-hour steps)
  const dailyMatrixHours = [
    { label: '07:30 - 08:30', startH: 7.5, endH: 8.5 },
    { label: '08:30 - 09:30', startH: 8.5, endH: 9.5 },
    { label: '09:30 - 10:30', startH: 9.5, endH: 10.5 },
    { label: '10:30 - 11:30', startH: 10.5, endH: 11.5 },
    { label: '11:30 - 12:30', startH: 11.5, endH: 12.5 },
    { label: '12:30 - 01:30', startH: 12.5, endH: 13.5 },
    { label: '01:30 - 02:30', startH: 13.5, endH: 14.5 },
    { label: '02:30 - 03:30', startH: 14.5, endH: 15.5 },
    { label: '03:30 - 04:30', startH: 15.5, endH: 16.5 },
    { label: '04:30 - 05:30', startH: 16.5, endH: 17.5 },
    { label: '05:30 - 06:30', startH: 17.5, endH: 18.5 },
    { label: '06:30 - 07:00', startH: 18.5, endH: 19.0 },
  ];

  return (
    <div className="p-4 flex flex-col space-y-4 print:p-0 print:space-y-0">
      {/* Top Controls & Navigation Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3.5 print:hidden">
        {/* Row 1: Term Selector, View Mode Pills, Print & Export */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          {/* View Modes */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleViewTypeChange('room')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                calendarViewType === 'room'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>Room Timetable</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewTypeChange('instructor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                calendarViewType === 'instructor'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Faculty Schedule</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewTypeChange('section')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                calendarViewType === 'section'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Section Cohort</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewTypeChange('all_rooms_daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                calendarViewType === 'all_rooms_daily'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>All Rooms Daily Grid</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenTimetablePage}
              className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition cursor-pointer flex items-center space-x-1.5 shadow-2xs"
              title="Open full timetable matrix in a standalone printable tab"
            >
              <span>📄 View Timetable</span>
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition cursor-pointer flex items-center space-x-1 shadow-2xs"
              title="Export grid timetable as formatted Excel (.xls)"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer flex items-center space-x-1 shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onExportCSV}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={onExportICS}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              Export ICS
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Row 2: Searchable Combobox & Prev/Next Cycling (when not in daily matrix mode) */}
        {calendarViewType !== 'all_rooms_daily' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            {/* Term Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Term:</span>
              <select
                value={termFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setTermFilter(val === 'ACTIVE' || val === 'ALL' ? val : Number(val));
                }}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 cursor-pointer"
              >
                {activeTerm && <option value="ACTIVE">Active Term: {activeTerm.name}</option>}
                <option value="ALL">All Semesters</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Cycle Prev/Next */}
            <div className="flex items-center space-x-1.5 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => handleCycleEntity('prev')}
                title="Previous schedule"
                className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleCycleEntity('next')}
                title="Next schedule"
                className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-white rounded transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Searchable Combobox Input & Dropdown */}
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={`Search ${calendarViewType}s...`}
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <svg
                  className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <select
                value={selectedCalendarId}
                onChange={(e) => setSelectedCalendarId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[200px]"
              >
                <option value="">-- Choose {calendarViewType} --</option>
                {availableEntities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {calendarViewType === 'room' &&
                      `${e.building} - ${e.room_number} (${e.room_type || 'Lecture'}, Cap: ${e.capacity})`}
                    {calendarViewType === 'instructor' && `${e.first_name} ${e.last_name}`}
                    {calendarViewType === 'section' &&
                      `${e.department?.code} - Yr ${e.year_level} Sec ${e.name || 'A'}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Unscheduled Drawer Toggle Button */}
            <button
              type="button"
              onClick={() => setIsUnscheduledDrawerOpen(!isUnscheduledDrawerOpen)}
              className={`ml-auto px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer flex items-center space-x-1.5 ${
                isUnscheduledDrawerOpen
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>{isUnscheduledDrawerOpen ? 'Hide Unscheduled' : 'Show Unscheduled'}</span>
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {unscheduledSubjects.length}
              </span>
            </button>
          </div>
        )}

        {/* Daily Matrix Day Selector (when in daily matrix mode) */}
        {calendarViewType === 'all_rooms_daily' && (
          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Select Day:
            </span>
            {(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDailyMatrixDay(d)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  dailyMatrixDay === d
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {d === 'MON' && 'Monday'}
                {d === 'TUE' && 'Tuesday'}
                {d === 'WED' && 'Wednesday'}
                {d === 'THU' && 'Thursday'}
                {d === 'FRI' && 'Friday'}
                {d === 'SAT' && 'Saturday'}
                {d === 'SUN' && 'Sunday'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Workspace Layout */}
      {calendarViewType === 'all_rooms_daily' ? (
        /* All-Rooms Daily Matrix View */
        <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Daily Classroom Allocation — {dailyMatrixDay}
              </h3>
              <p className="text-xs text-slate-500">
                Bird&apos;s-eye utilization of all classrooms and laboratories across the campus.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
              {rooms.length} Total Facilities
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 w-48 border-r border-slate-200 sticky left-0 bg-slate-100 z-10">
                    Room / Facility
                  </th>
                  {dailyMatrixHours.map((h) => (
                    <th
                      key={h.label}
                      className="p-2 text-center border-r border-slate-200 min-w-[110px] text-[11px]"
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rooms.map((room) => {
                  const daySlots = scheduleSlots.filter(
                    (s) => s.room?.id === room.id && s.day_of_week === dailyMatrixDay
                  );

                  return (
                    <tr key={room.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 border-r border-slate-200 font-semibold sticky left-0 bg-white z-10 shadow-xs">
                        <div className="font-bold text-slate-900">{room.room_number}</div>
                        <div className="text-[10px] text-slate-500">
                          {room.building} • Cap: {room.capacity}
                        </div>
                      </td>
                      {dailyMatrixHours.map((h) => {
                        // Find if room is occupied during this hour
                        const occupyingSlot = daySlots.find((s) => {
                          const [sH, sM] = s.start_time.split(':').map(Number);
                          const [eH, eM] = s.end_time.split(':').map(Number);
                          const slotStart = sH + sM / 60;
                          const slotEnd = eH + eM / 60;
                          return slotStart < h.endH && slotEnd > h.startH;
                        });

                        return (
                          <td
                            key={h.label}
                            className={`p-1.5 border-r border-slate-100 text-center align-middle ${
                              occupyingSlot ? 'bg-indigo-50/70' : 'bg-white'
                            }`}
                          >
                            {occupyingSlot ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEventForDetail({
                                    title: occupyingSlot.section_subject?.course?.code || 'Slot',
                                    start: new Date(2026, 7, 24),
                                    end: new Date(2026, 7, 24),
                                    resource: occupyingSlot,
                                  });
                                  setIsDetailModalOpen(true);
                                }}
                                title={`${occupyingSlot.section_subject?.course?.code || occupyingSlot.custom_title || 'Class'} | Sec ${occupyingSlot.section_subject?.section?.name || 'A'} | Rm ${occupyingSlot.room?.room_number || room.room_number}`}
                                className="w-full p-1.5 rounded bg-indigo-600 text-white font-bold text-[10px] shadow-2xs hover:bg-indigo-700 transition cursor-pointer text-left leading-tight truncate block group relative"
                              >
                                <div className="truncate font-black">
                                  {occupyingSlot.section_subject?.course?.code || occupyingSlot.custom_title || 'Class'}
                                </div>
                                <div className="text-[9px] text-indigo-100 font-bold truncate flex items-center justify-between mt-0.5">
                                  <span>Sec {occupyingSlot.section_subject?.section?.name || 'A'}</span>
                                  <span className="text-white/90">Rm {occupyingSlot.room?.room_number || room.room_number}</span>
                                </div>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-medium">Free</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Weekly DnD Timetable Mode */
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-250px)] min-h-[700px]">
          {/* Collapsible Unscheduled Subjects Drawer */}
          {isUnscheduledDrawerOpen && (
            <div className="w-full lg:w-80 bg-white p-4 rounded-xl shadow-2xs border border-slate-200 flex flex-col h-full overflow-hidden shrink-0 animate-in fade-in duration-150 print:hidden">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Unscheduled Pool
                  </h3>
                  <p className="text-[11px] text-slate-500">Drag into timetable grid</p>
                </div>
                <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-2 py-0.5 rounded-full">
                  {unscheduledSubjects.length}
                </span>
              </div>

              {/* Drawer Filters */}
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  placeholder="Filter courses / prof..."
                  value={unscheduledSearch}
                  onChange={(e) => setUnscheduledSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                />

                <div className="flex items-center justify-between">
                  {/* Type Filter Pills */}
                  <div className="flex items-center space-x-1">
                    {(['ALL', 'LEC', 'LAB', 'ASYNC'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setUnscheduledTypeFilter(t)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                          unscheduledTypeFilter === t
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Contextual Filter Checkbox */}
                  {selectedCalendarId && (
                    <label className="flex items-center space-x-1 text-[11px] font-semibold text-indigo-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={matchCurrentSelectionOnly}
                        onChange={(e) => setMatchCurrentSelectionOnly(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 cursor-pointer w-3.5 h-3.5"
                      />
                      <span>Only current</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Draggable Cards List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {unscheduledSubjects.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-medium text-center px-4">
                    <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>All active subjects have been scheduled!</span>
                  </div>
                ) : (
                  unscheduledSubjects.map((ss: any) => (
                    <div
                      key={ss._renderId}
                      className={`p-2.5 border rounded-lg bg-slate-50 hover:bg-white transition-all shadow-2xs border-l-4 ${
                        ss.blockInfo.type === 'Laboratory'
                          ? 'border-slate-200 border-l-amber-500 hover:border-amber-400'
                          : ss.blockInfo.type === 'Async'
                          ? 'border-slate-200 border-l-purple-500 hover:border-purple-400'
                          : 'border-slate-200 border-l-indigo-500 hover:border-indigo-400'
                      }`}
                    >
                      <div className="font-bold text-slate-900 text-xs leading-tight mb-1 flex items-center justify-between">
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', ss.id.toString());
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedEvent(ss);
                          }}
                          onDragEnd={() => setDraggedEvent(null)}
                          className="cursor-grab active:cursor-grabbing hover:text-indigo-600 transition"
                          title="Drag to calendar grid or use ⚡ Suggest Times below"
                        >
                          {ss.course.code}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${
                            ss.blockInfo.type === 'Laboratory'
                              ? 'bg-amber-100 text-amber-900'
                              : ss.blockInfo.type === 'Async'
                              ? 'bg-purple-100 text-purple-900 border border-purple-200'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {ss.blockInfo.type === 'Async' ? 'Async Online' : ss.blockInfo.type} ({ss.blockInfo.hours}h)
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mb-1.5 truncate font-medium">
                        {ss.course.name}
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/80 text-[10px]">
                        <span className="font-semibold text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded">
                          Sec {ss.section?.name || 'A'} • Yr {ss.section?.year_level}
                        </span>
                        <span
                          className="font-semibold text-slate-700 truncate max-w-[100px]"
                          title={ss.professor ? `${ss.professor.first_name} ${ss.professor.last_name}` : 'No faculty assigned'}
                        >
                          {ss.professor ? `${ss.professor.first_name?.[0] || ''}. ${ss.professor.last_name}` : 'TBA'}
                        </span>
                      </div>

                      {/* Smart Faculty Slot Suggestion Action */}
                      <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedSuggestionsSubjectId(
                              expandedSuggestionsSubjectId === ss._renderId ? null : ss._renderId
                            );
                          }}
                          className={`w-full py-1 px-2 rounded text-[11px] font-bold flex items-center justify-between transition cursor-pointer ${
                            expandedSuggestionsSubjectId === ss._renderId
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/70'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <span>⚡</span>
                            <span>{expandedSuggestionsSubjectId === ss._renderId ? 'Hide Suggestions' : 'Suggest Times'}</span>
                          </span>
                          <span className="text-[10px]">
                            {expandedSuggestionsSubjectId === ss._renderId ? '▲' : '▼'}
                          </span>
                        </button>

                        {/* Suggestions Pill List */}
                        {expandedSuggestionsSubjectId === ss._renderId && (
                          <div className="mt-2 space-y-1.5">
                            {(() => {
                              const suggestions = suggestFacultySlots({
                                subject: ss,
                                scheduleSlots,
                                rooms,
                                instructors,
                              });

                              if (suggestions.length === 0) {
                                return (
                                  <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[10px] leading-tight font-medium">
                                    No direct open slots found matching {ss.professor ? `Prof. ${ss.professor.last_name}'s` : 'faculty'} hours & room capacities.
                                  </div>
                                );
                              }

                              return (
                                <>
                                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Recommended Timeslots:
                                  </div>
                                  {suggestions.map((s, idx) => (
                                    <div
                                      key={idx}
                                      onMouseEnter={() => setPreviewSuggestedSlot({ subject: ss, suggestion: s })}
                                      onMouseLeave={() => setPreviewSuggestedSlot(null)}
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-xs transition group flex items-center justify-between gap-1 text-[10px]"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-extrabold text-slate-800 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <span>{s.day}</span>
                                          <span className="text-slate-500 font-semibold">{s.startTimeFormatted} - {s.endTimeFormatted}</span>
                                        </div>
                                        <div className="text-[9px] text-slate-500 truncate mt-0.5">
                                          Rm {s.room?.room_number} ({s.room?.room_type === 'LABORATORY' ? 'Lab' : 'Lec'})
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isInsertingSuggestedSlot}
                                        onClick={() => handleInsertSuggestedSlot(ss, s)}
                                        className="shrink-0 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-0.5 disabled:opacity-50"
                                        title="Click to insert into timetable immediately"
                                      >
                                        <span>⚡ Place</span>
                                      </button>
                                    </div>
                                  ))}
                                  <p className="text-[9px] text-slate-400 italic text-center pt-0.5">
                                    Hover slot to preview on calendar • Click ⚡ Place to lock in
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Timetable Calendar Container */}
          <div className="flex-1 flex flex-col h-full min-w-0 bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
            {!selectedCalendarId ? (
              <div className="flex-grow flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6">
                <div className="text-center max-w-sm">
                  <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Select a Timetable</h4>
                  <p className="text-xs text-slate-500">
                    Choose a {calendarViewType} from the dropdown above to inspect and organize its weekly schedule.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Header title for timetable */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                      {calendarViewType === 'room' &&
                        `Facility: ${currentEntity?.building} - Room ${currentEntity?.room_number} (${currentEntity?.room_type || 'Lecture'}, Capacity: ${currentEntity?.capacity})`}
                      {calendarViewType === 'instructor' &&
                        `Faculty Timetable: ${currentEntity?.first_name} ${currentEntity?.last_name}`}
                      {calendarViewType === 'section' &&
                        `Cohort Timetable: ${currentEntity?.department?.code} - Year ${currentEntity?.year_level} Sec ${currentEntity?.name || 'A'}`}
                    </h3>
                  </div>

                  {calendarViewType === 'instructor' && (
                    <span className="text-[11px] font-semibold text-slate-500">
                      Click any empty slot to add Consultation or Office Hours
                    </span>
                  )}
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 min-h-0 p-2 pb-0 relative">
                  <DnDCalendar
                    localizer={localizer}
                    events={calendarEvents}
                    onEventDrop={onEventDrop}
                    onEventResize={onEventDrop}
                    onDropFromOutside={onDropFromOutside}
                    dragFromOutsideItem={() => {
                      if (!draggedEvent) return {} as any;
                      return {
                        title: draggedEvent.course?.code,
                        resource: draggedEvent,
                      } as any;
                    }}
                    selectable={true}
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    resizable
                    startAccessor={(event: any) => event.start}
                    endAccessor={(event: any) => event.end}
                    defaultView="week"
                    views={['week', 'day']}
                    toolbar={false}
                    formats={{
                      dayFormat: 'dddd',
                    }}
                    eventPropGetter={(event: any) => {
                      if (event.resource?.is_recommendation_preview) {
                        return {
                          className:
                            'recommendation-slot ring-2 ring-emerald-500 bg-emerald-100/90 text-emerald-950 font-bold shadow-lg cursor-pointer rounded-lg border-2 border-dashed border-emerald-600 animate-pulse z-40',
                          style: {
                            backgroundColor: '#d1fae5',
                            borderColor: '#059669',
                            color: '#064e3b',
                          },
                        };
                      }
                      if (event.is_blackout) {
                        return {
                          className: 'blackout-slot select-none opacity-80 cursor-not-allowed',
                          style: {
                            backgroundColor: '#f1f5f9',
                            border: '1px dashed #cbd5e1',
                            color: '#64748b',
                          },
                        };
                      }
                      const isLab = event.resource?.section_subject?.course?.has_lab;
                      const isCustom = event.resource?.is_custom;

                      if (isCustom) {
                        return {
                          className:
                            'rounded-md shadow-2xs border-l-4 border-l-emerald-600 bg-emerald-50 text-emerald-900 border border-emerald-200 cursor-pointer',
                        };
                      }
                      if (isLab) {
                        return {
                          className:
                            'rounded-md shadow-2xs border-l-4 border-l-amber-500 bg-amber-50 text-amber-900 border border-amber-200 cursor-pointer',
                        };
                      }
                      return {
                        className:
                          'rounded-md shadow-2xs border-l-4 border-l-indigo-600 bg-indigo-50 text-indigo-900 border border-indigo-200 cursor-pointer',
                      };
                    }}
                    defaultDate={new Date(2026, 7, 24)}
                    min={new Date(2026, 7, 24, 7, 30)}
                    max={new Date(2026, 7, 24, 19, 0)}
                    step={30}
                    timeslots={2}
                    components={{
                      event: CalendarCustomEvent,
                    }}
                    className="rounded-lg border-0 bg-white h-full"
                  />
                </div>

                {/* Faculty Load Summary Strip (when in Instructor mode) */}
                {calendarViewType === 'instructor' && instructorWeeklyStats && (
                  <div className="flex items-center bg-slate-50 border-t border-slate-200 p-3 shadow-2xs z-10 shrink-0">
                    <div className="flex-shrink-0 mr-6 w-32 border-r border-slate-200 pr-3">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Weekly Load
                      </div>
                      <div className="text-xl font-bold text-slate-900 leading-none">
                        {instructorWeeklyStats.total}
                        <span className="text-xs font-normal text-slate-500 ml-1">hrs</span>
                      </div>
                    </div>

                    <div className="flex-1 flex justify-between ml-[40px]">
                      {[
                        { label: 'Mon', day: 24 },
                        { label: 'Tue', day: 25 },
                        { label: 'Wed', day: 26 },
                        { label: 'Thu', day: 27 },
                        { label: 'Fri', day: 28 },
                        { label: 'Sat', day: 29 },
                        { label: 'Sun', day: 30 },
                      ].map((d) => (
                        <div key={d.day} className="text-center flex-1">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            {d.label}
                          </div>
                          <div
                            className={`text-sm font-bold mt-0.5 ${
                              instructorWeeklyStats.hours[d.day] > 0
                                ? 'text-slate-900'
                                : 'text-slate-300'
                            }`}
                          >
                            {instructorWeeklyStats.hours[d.day]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ScheduleDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedEventForDetail(null);
        }}
        event={selectedEventForDetail}
        rooms={rooms}
        onDeleteSlot={handleDeleteSlot}
        onUpdateRoom={handleUpdateRoom}
      />

      <CustomSlotModal
        isOpen={isCustomSlotModalOpen}
        onClose={() => setIsCustomSlotModalOpen(false)}
        isEdit={isEditCustomSlot}
        details={customSlotDetails}
        setDetails={setCustomSlotDetails}
        onSave={handleSaveCustomSlot}
        onDelete={handleDeleteCustomSlot}
      />

      <PendingDropModal
        isOpen={!!pendingDrop}
        onClose={() => setPendingDrop(null)}
        pendingDrop={pendingDrop}
        rooms={rooms}
        scheduleSlots={scheduleSlots}
        onConfirm={confirmPendingDrop}
      />
    </div>
  );
}
