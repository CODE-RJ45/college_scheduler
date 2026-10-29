"use client";

import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import Link from 'next/link';
import axios from 'axios';
import Footer from './components/Footer';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

moment.updateLocale('en', {
  week: {
    dow: 1, // First day of week is Monday
  }
});

const mapDayToDate = (dayString: string) => {
  const days: { [key: string]: number } = {
    'MON': 24, 'TUE': 25, 'WED': 26, 'THU': 27, 'FRI': 28, 'SAT': 29, 'SUN': 30
  };
  return days[dayString] || 24;
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

const CustomEvent = ({ event }: any) => {
  const slot = event.resource;
  
  if (!slot || !slot.id) {
    return (
      <div className="flex flex-col h-full p-1 text-xs overflow-hidden relative z-10 opacity-70">
        <div className="font-bold text-sm text-white leading-tight mb-0.5 truncate drop-shadow-md">
          {event.title || 'Scheduling...'}
        </div>
      </div>
    );
  }

  const isCustom = slot.is_custom;
  const course = slot.section_subject?.course;
  const durationHours = slot.end_time && slot.start_time 
    ? (new Date(`2000-01-01T${slot.end_time}`).getTime() - new Date(`2000-01-01T${slot.start_time}`).getTime()) / (1000 * 60 * 60)
    : 1.5;
  const isShort = durationHours <= 1;

  // Accurate Slot Type Classification (Lab, F2F Lecture, Asynchronous)
  const isAsync = !isCustom && (!slot.room || slot.room === null || slot.is_async);
  const isLab = !isCustom && !isAsync && (slot.room?.room_type === 'LABORATORY' || (durationHours >= 2.5 && course?.has_lab));
  const isLec = !isCustom && !isAsync && !isLab;

  const slotTypeLabel = isCustom ? 'Custom Slot' : isAsync ? 'Asynchronous' : isLab ? 'Laboratory' : 'Lecture';
  const slotTypeBadge = isCustom ? 'Custom' : isAsync ? 'Async' : isLab ? 'Lab' : 'Lec';

  const courseCode = isCustom 
    ? (slot.custom_title || 'Custom Slot') 
    : (course?.code || event.title || 'TBA');
  const courseFullName = course?.name || '';
  const sectionName = slot.section_subject?.section?.name 
    ? `Sec ${slot.section_subject.section.name}` 
    : 'Sec A';
  const secShort = slot.section_subject?.section?.name || 'A';

  const roomNumber = isCustom 
    ? (slot.room?.room_number ? `Rm ${slot.room.room_number}` : 'Custom')
    : isAsync 
    ? 'Online / Async' 
    : (slot.room?.room_number ? `Rm ${slot.room.room_number}` : 'TBA');

  const rmShort = isCustom 
    ? (slot.room?.room_number || 'Evt')
    : isAsync 
    ? 'Async' 
    : (slot.room?.room_number || 'TBA');

  const instructorName = slot.section_subject?.professor 
    ? `${slot.section_subject.professor.first_name || ''} ${slot.section_subject.professor.last_name || ''}`.trim()
    : 'TBA';
  const profShort = slot.section_subject?.professor ? (slot.section_subject.professor.last_name || 'TBA') : 'TBA';

  const formattedStartTime = formatTime12(slot.start_time, event.start);
  const formattedEndTime = formatTime12(slot.end_time, event.end);
  const timeRangeText = formattedStartTime && formattedEndTime ? `${formattedStartTime} – ${formattedEndTime}` : '';

  const tooltipText = isCustom 
    ? `${courseCode}${timeRangeText ? ` | ${timeRangeText}` : ''} | ${roomNumber}`
    : `${courseCode}${courseFullName ? ` - ${courseFullName}` : ''} (${slotTypeBadge})${timeRangeText ? ` | ${timeRangeText}` : ''} | ${sectionName} | ${roomNumber} | Prof: ${instructorName}`;

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
      className="group relative flex flex-col justify-between h-full p-0.5 sm:p-1 text-[10px] overflow-visible select-none leading-tight"
      title={tooltipText}
    >
      {/* Top: Course Code & Badge */}
      <div className="flex items-center justify-between gap-0.5 sm:gap-1 w-full min-w-0 leading-none">
        <div className="font-black text-[9.5px] sm:text-[10.5px] text-white leading-tight truncate drop-shadow-md">
          {courseCode}
        </div>
        {isCustom ? (
          <span className="text-[7px] sm:text-[7.5px] bg-emerald-500/80 text-white font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Custom
          </span>
        ) : isAsync ? (
          <span className="text-[7px] sm:text-[7.5px] bg-purple-500 text-white font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Async
          </span>
        ) : isLab ? (
          <span className="text-[7px] sm:text-[7.5px] bg-amber-500/90 text-white font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Lab
          </span>
        ) : (
          <span className="text-[7px] sm:text-[7.5px] bg-indigo-500/80 text-white font-black px-1 py-0.5 rounded uppercase tracking-wider shrink-0 leading-none">
            Lec
          </span>
        )}
      </div>

      {isShort ? (
        /* Compact Responsive Layout for 1-hour slots: Course, Sec/Room, and Faculty all visible */
        <div className="mt-auto pt-0.5 flex items-center justify-between gap-0.5 text-[8.5px] sm:text-[9px] font-bold text-white/95 border-t border-white/20 w-full min-w-0 leading-none">
          <span className="bg-black/30 px-0.5 py-0.5 rounded backdrop-blur-xs truncate font-bold shrink-0">
            {isCustom ? 'Event' : `S-${secShort} • ${rmShort}`}
          </span>
          <span className="bg-black/30 px-0.5 py-0.5 rounded backdrop-blur-xs truncate text-right font-bold min-w-0" title={instructorName}>
            {isCustom ? roomNumber : profShort}
          </span>
        </div>
      ) : (
        /* Multi-row Layout for standard and longer slots */
        <>
          <div className="flex items-center justify-between gap-1 text-[9px] sm:text-[9.5px] font-bold text-white/95 my-auto py-0.5 leading-none w-full min-w-0">
            <span className="bg-black/30 px-1 py-0.5 rounded backdrop-blur-xs truncate font-bold">
              {isCustom ? 'Event' : sectionName}
            </span>
            <span className={`bg-black/30 px-1 py-0.5 rounded backdrop-blur-xs truncate text-right font-black shrink-0 ${isAsync ? 'text-purple-300' : ''}`}>
              {roomNumber}
            </span>
          </div>

          <div className="mt-auto pt-0.5 flex items-center justify-between gap-1 text-[8.5px] sm:text-[9px] font-semibold text-white/90 border-t border-white/20 w-full min-w-0 leading-none">
            <span className="truncate text-white/70 font-medium">Faculty:</span>
            <span className="truncate text-right font-bold text-white" title={instructorName}>
              {profShort}
            </span>
          </div>
        </>
      )}

      {/* Floating Hover Tooltip: direction-aware & boundary-safe */}
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
        {!isCustom && courseFullName && (
          <div className="text-[10px] text-slate-300 font-medium py-1 line-clamp-2">
            {courseFullName}
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
          <span className="font-bold text-amber-300">{isCustom ? 'Custom Event' : sectionName}</span>
          <span className={`font-bold ${isAsync ? 'text-purple-300' : 'text-emerald-300'}`}>{roomNumber}</span>
        </div>
        {instructorName && (
          <div className="text-[9px] text-slate-400 mt-1 truncate">
            Prof: <span className="text-slate-200 font-semibold">{instructorName}</span>
          </div>
        )}
        {/* Tooltip caret */}
        <div className={`absolute ${caretHorizClass} ${caretVertClass} w-0 h-0 border-x-4 border-x-transparent`}></div>
      </div>
    </div>
  );
};

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  
  const [filterType, setFilterType] = useState<string>('department');
  const [selectedFilterId, setSelectedFilterId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/dashboard-data/');
      setScheduleSlots(res.data.scheduleSlots || []);
      setDepartments(res.data.departments || []);
      setInstructors(res.data.instructors || []);
      setRooms(res.data.rooms || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calendarEvents = scheduleSlots
    .filter((slot: any) => {
      if (!selectedFilterId) return true; // Show all if nothing selected
      if (filterType === 'department') {
        return slot.section_subject?.section?.department?.id?.toString() === selectedFilterId || 
               slot.section_subject?.course?.department?.id?.toString() === selectedFilterId;
      }
      if (filterType === 'instructor') {
        return slot.section_subject?.professor?.id?.toString() === selectedFilterId;
      }
      if (filterType === 'room') {
        return slot.room?.id?.toString() === selectedFilterId;
      }
      return true;
    })
    .map((slot: any) => {
      const day = mapDayToDate(slot.day_of_week);
      const [startH, startM] = (slot.start_time || '08:00').split(':');
      const [endH, endM] = (slot.end_time || '09:00').split(':');
      return {
        title: slot.is_custom ? slot.custom_title : slot.section_subject?.course?.code,
        start: new Date(2026, 7, day, parseInt(startH || '8'), parseInt(startM || '0')),
        end: new Date(2026, 7, day, parseInt(endH || '9'), parseInt(endM || '0')),
        resource: slot,
      };
    });

  const scrollToCalendar = () => {
    document.getElementById('public-calendar')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToAbout = () => {
    document.getElementById('about-project')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Institutional Top Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 p-4 shadow-xs flex justify-between items-center px-6 sm:px-12">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            CS
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
              College Scheduler
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Academic Timetable System</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center space-x-6">
          <button onClick={scrollToAbout} className="text-slate-600 hover:text-indigo-600 font-semibold transition-colors text-sm cursor-pointer">
            About System
          </button>
          <button onClick={scrollToCalendar} className="text-slate-600 hover:text-indigo-600 font-semibold transition-colors text-sm cursor-pointer">
            Browse Schedules
          </button>
          <Link
            href="/timetable"
            target="_blank"
            className="text-slate-600 hover:text-indigo-600 font-semibold transition-colors text-sm flex items-center gap-1.5"
          >
            <span>Timetable</span>
            <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
              Print/Excel
            </span>
          </Link>
          <div className="h-5 w-px bg-slate-200"></div>
          <Link href="/admin/dashboard" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold shadow-xs transition-colors text-sm">
            Admin Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 mb-6">
            Institutional Timetabling & Course Scheduling
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-6 leading-tight">
            Academic Timetable & Schedule Management
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
            Automated conflict-free scheduling engine, faculty workload balancing, room facility utilization tracking, and real-time interactive calendar management for colleges and universities.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button onClick={scrollToCalendar} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-lg font-bold text-sm shadow-xs transition-colors cursor-pointer">
              Browse Public Schedules
            </button>
            <Link href="/admin/dashboard" className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-3 rounded-lg font-bold text-sm shadow-xs transition-colors cursor-pointer">
              Go to Admin Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 bg-slate-50 border-b border-slate-200 relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Automated Planning</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Algorithm-Driven Timetable Engine</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Generate conflict-free schedules across collegiate departments using constraint satisfaction algorithms accounting for room sizes, equipment, and teacher workloads.
            </p>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Interactive Control</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Visual Drag-and-Drop Calendar</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Fine-tune course allocations with real-time feedback. Live validation highlights collisions between rooms, instructors, and student section cohorts.
            </p>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Facility Optimization</div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Conflict Prevention & Auditing</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Prevent double-booking of rooms, overlapping faculty teaching periods, and student cohort clashes with automated validation rules.
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about-project" className="py-16 bg-white border-b border-slate-200 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 md:p-10">
            <div className="inline-flex items-center px-2.5 py-1 rounded bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider mb-4">
              System Overview
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mb-4">Institutional College Scheduler</h2>
            
            <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
              <p>
                An enterprise-ready academic scheduling application engineered to automate timetable coordination across colleges, faculties, and academic departments. The platform integrates constraint-solving logic, synchronized multi-view calendars, and institutional administration tools.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                <div className="bg-white p-5 rounded-lg border border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Automated Schedule Solver
                  </h3>
                  <p className="text-sm text-slate-600">Calculates class assignments based on teacher availability profiles, room capacities, laboratory specifications, and curriculum credit requirements.</p>
                </div>
                <div className="bg-white p-5 rounded-lg border border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Multi-Dimensional Master Timetable
                  </h3>
                  <p className="text-sm text-slate-600">Simultaneously inspect schedules filtered by room facilities, instructor profiles, or student cohorts with immediate conflict notifications.</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-5 border border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-white text-base font-bold">
                  AL
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Developed By</p>
                  <p className="text-lg font-bold text-slate-900">Ar-jay F. Llanera</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Public Calendar */}
      <section id="public-calendar" className="py-16 flex-grow relative bg-slate-50">
        <div className="max-w-[1400px] mx-auto px-6 w-full flex flex-col h-[900px]">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Public Master Schedule</h2>
            <p className="text-slate-500 text-sm mt-1">Published institutional timetables for the active academic period. Select filters below to inspect specific allocations.</p>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 flex-grow flex flex-col overflow-hidden">
            {/* Filters Bar */}
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Filter By</label>
                <select 
                  value={filterType} 
                  onChange={(e) => { setFilterType(e.target.value); setSelectedFilterId(''); }}
                  className="block w-48 bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs cursor-pointer"
                >
                  <option value="department">Department</option>
                  <option value="instructor">Instructor</option>
                  <option value="room">Room</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Select {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </label>
                <select 
                  value={selectedFilterId} 
                  onChange={(e) => setSelectedFilterId(e.target.value)}
                  className="block w-64 bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs cursor-pointer"
                >
                  <option value="">-- View All --</option>
                  {filterType === 'department' && departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                  {filterType === 'instructor' && instructors.map(i => (
                    <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                  ))}
                  {filterType === 'room' && rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.building} - {r.room_number}</option>
                  ))}
                </select>
              </div>

              <div className="sm:ml-auto flex items-center">
                <Link
                  href={
                    filterType === 'instructor' && selectedFilterId
                      ? `/timetable?viewType=instructor&id=${selectedFilterId}`
                      : filterType === 'room' && selectedFilterId
                      ? `/timetable?viewType=room&id=${selectedFilterId}`
                      : `/timetable`
                  }
                  target="_blank"
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Full Timetable & Print / Excel ↗</span>
                </Link>
              </div>
            </div>

            {/* Calendar Container */}
            <div className="flex-grow p-4 relative bg-white min-h-[600px]">
              {!isMounted || isLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[600px] bg-white">
                  <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="mt-3 text-xs font-bold text-slate-500">Loading Schedules...</p>
                </div>
              ) : (
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  defaultView="week"
                  views={['week', 'day']}
                  toolbar={true}
                  formats={{
                    dayFormat: 'dddd'
                  }}
                  defaultDate={new Date(2026, 7, 24)} // Start on our template week Monday (Aug 24)
                  min={new Date(2026, 7, 24, 7, 30)}
                  max={new Date(2026, 7, 24, 19, 0)}
                  step={30}
                  timeslots={2}
                  components={{
                    event: CustomEvent
                  }}
                  eventPropGetter={(event: any) => {
                    const durationHours = event.end && event.start 
                      ? (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60)
                      : 1.5;
                    if (durationHours <= 1) {
                      return { className: 'short-event' };
                    }
                    return {};
                  }}
                  className="rounded-lg bg-white border-0 h-full"
                />
              )}
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <Footer variant="dark" />
    </div>
  );
}
