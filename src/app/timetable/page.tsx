"use client";

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { exportTimetableToExcel, exportTimetableToCSV } from '../admin/dashboard/utils/timetableExporter';

interface Section {
  id: number;
  name: string;
  year_level: number;
  department?: { id: number; name: string; code: string };
  term?: { id: number; name: string };
}

interface Instructor {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface Room {
  id: number;
  room_number: string;
  building: string;
  room_type: string;
  capacity: number;
}

interface Term {
  id: number;
  name: string;
  is_active: boolean;
}

const DAYS = [
  { code: 'MON', label: 'Monday' },
  { code: 'TUE', label: 'Tuesday' },
  { code: 'WED', label: 'Wednesday' },
  { code: 'THU', label: 'Thursday' },
  { code: 'FRI', label: 'Friday' },
  { code: 'SAT', label: 'Saturday' },
];

const TIME_WINDOWS = [
  { start: '07:30', end: '08:30', label: '07:30 AM - 08:30 AM' },
  { start: '08:30', end: '09:30', label: '08:30 AM - 09:30 AM' },
  { start: '09:30', end: '10:30', label: '09:30 AM - 10:30 AM' },
  { start: '10:30', end: '11:30', label: '10:30 AM - 11:30 AM' },
  { start: '11:30', end: '12:00', label: '11:30 AM - 12:00 PM' },
  { start: '12:00', end: '13:00', label: '12:00 PM - 01:00 PM (LUNCH BREAK)', isLunch: true },
  { start: '13:00', end: '14:00', label: '01:00 PM - 02:00 PM' },
  { start: '14:00', end: '15:00', label: '02:00 PM - 03:00 PM' },
  { start: '15:00', end: '16:00', label: '03:00 PM - 04:00 PM' },
  { start: '16:00', end: '17:00', label: '04:00 PM - 05:00 PM' },
  { start: '17:00', end: '18:00', label: '05:00 PM - 06:00 PM' },
  { start: '18:00', end: '19:00', label: '06:00 PM - 07:00 PM' },
];

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function doesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return Math.max(timeToMinutes(s1), timeToMinutes(s2)) < Math.min(timeToMinutes(e1), timeToMinutes(e2));
}

export default function TimetablePage() {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<any[]>([]);

  // View Filter states
  const [viewType, setViewType] = useState<'section' | 'instructor' | 'room' | 'all'>('section');
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8000/api/dashboard-data/');
      const secData = res.data.sections || [];
      const instData = res.data.instructors || [];
      const roomData = res.data.rooms || [];
      const termData = res.data.terms || [];

      setSections(secData);
      setInstructors(instData);
      setRooms(roomData);
      setTerms(termData);
      setScheduleSlots(res.data.scheduleSlots || []);

      // Set active term by default
      const activeTerm = termData.find((t: Term) => t.is_active) || termData[0];
      if (activeTerm) setSelectedTermId(activeTerm.id.toString());

      // Parse query parameters if any (e.g. /timetable?viewType=section&id=1)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qView = params.get('viewType');
        const qId = params.get('id');
        const qTerm = params.get('termId');

        if (qView && ['section', 'instructor', 'room', 'all'].includes(qView)) {
          setViewType(qView as any);
        }
        if (qId) {
          setSelectedId(qId);
        } else if (secData.length > 0) {
          setSelectedId(secData[0].id.toString());
        }
        if (qTerm) {
          setSelectedTermId(qTerm);
        }
      } else if (secData.length > 0) {
        setSelectedId(secData[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load timetable data', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter slots by Term and Entity
  const filteredSlots = useMemo(() => {
    return scheduleSlots.filter((slot) => {
      // Term filter
      if (selectedTermId) {
        const slotTermId = slot.section_subject?.section?.term?.id || slot.section_subject?.section?.term_id;
        if (slotTermId && slotTermId.toString() !== selectedTermId) return false;
      }

      if (viewType === 'all') return true;

      if (!selectedId) return true;

      if (viewType === 'section') {
        return slot.section_subject?.section?.id?.toString() === selectedId;
      }
      if (viewType === 'instructor') {
        return (
          slot.section_subject?.professor?.id?.toString() === selectedId ||
          slot.professor?.id?.toString() === selectedId
        );
      }
      if (viewType === 'room') {
        return slot.room?.id?.toString() === selectedId;
      }
      return true;
    });
  }, [scheduleSlots, selectedTermId, viewType, selectedId]);

  // Compute Current Entity Title
  const entityTitle = useMemo(() => {
    if (viewType === 'all') return 'Master Campus Timetable (All Classes)';
    if (viewType === 'section') {
      const sec = sections.find((s) => s.id.toString() === selectedId);
      return sec
        ? `${sec.department?.code || ''} Year ${sec.year_level} - Section ${sec.name || 'A'}`
        : 'Select Section';
    }
    if (viewType === 'instructor') {
      const inst = instructors.find((i) => i.id.toString() === selectedId);
      return inst ? `Prof. ${inst.first_name} ${inst.last_name}` : 'Select Instructor';
    }
    if (viewType === 'room') {
      const r = rooms.find((rm) => rm.id.toString() === selectedId);
      return r ? `Room ${r.room_number} (${r.building} • ${r.room_type})` : 'Select Room';
    }
    return 'Timetable';
  }, [viewType, selectedId, sections, instructors, rooms]);

  const activeTermName = useMemo(() => {
    const t = terms.find((term) => term.id.toString() === selectedTermId);
    return t ? t.name : 'Current Semester';
  }, [terms, selectedTermId]);

  // Handle Export to Excel (.xls)
  const handleExportExcel = () => {
    exportTimetableToExcel({
      slots: filteredSlots,
      entityTitle,
      termName: activeTermName,
      departmentName: 'College Academic Scheduling System',
    });
  };

  // Handle Export to CSV (.csv)
  const handleExportCSV = () => {
    exportTimetableToCSV({
      slots: filteredSlots,
      entityTitle,
      termName: activeTermName,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Pre-calculate timetable grid with vertical cell spanning for multi-hour blocks (e.g. 3h Laboratory)
  const timetableGrid = useMemo(() => {
    const coveredUntil: Record<string, number> = {};
    DAYS.forEach((d) => { coveredUntil[d.code] = -1; });

    const grid: Record<number, Record<string, { skip: boolean; rowSpan: number; slots: any[] }>> = {};

    TIME_WINDOWS.forEach((win, wIdx) => {
      grid[wIdx] = {};
      if (win.isLunch) return;

      DAYS.forEach((day) => {
        // If this column is already covered by an earlier row's rowSpan (e.g. 3-hour Laboratory)
        if (coveredUntil[day.code] >= wIdx) {
          grid[wIdx][day.code] = { skip: true, rowSpan: 1, slots: [] };
          return;
        }

        // Find slots occupying this window
        const cellSlots = filteredSlots.filter(
          (s) => s.day_of_week === day.code && doesOverlap(s.start_time, s.end_time, win.start, win.end)
        );

        if (cellSlots.length === 0) {
          grid[wIdx][day.code] = { skip: false, rowSpan: 1, slots: [] };
          return;
        }

        const primarySlot = cellSlots[0];
        
        // Calculate rowSpan across consecutive non-lunch windows
        let span = 1;
        for (let nextWIdx = wIdx + 1; nextWIdx < TIME_WINDOWS.length; nextWIdx++) {
          const nextWin = TIME_WINDOWS[nextWIdx];
          if (nextWin.isLunch) break; // Do not span across lunch
          if (doesOverlap(primarySlot.start_time, primarySlot.end_time, nextWin.start, nextWin.end)) {
            span++;
          } else {
            break;
          }
        }

        if (span > 1) {
          coveredUntil[day.code] = wIdx + span - 1;
        }

        grid[wIdx][day.code] = { skip: false, rowSpan: span, slots: cellSlots };
      });
    });

    return grid;
  }, [filteredSlots]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-semibold text-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div>
          <span>Loading Timetable...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Bar - Hidden during printing */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/dashboard?tab=calendar"
            className="text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          >
            <span>&larr;</span>
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-300"></div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
              Institutional Timetable Viewer
            </h1>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Official Printable Timetable & Excel Export</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>🖨️</span>
            <span>Print Timetable</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>📥</span>
            <span>Export Excel (.xls)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>CSV</span>
          </button>
        </div>
      </header>

      {/* Filter Toolbar - Hidden during printing */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 shadow-xs print:hidden">
        <div className="max-w-[1500px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(
                [
                  { id: 'section', label: 'By Section' },
                  { id: 'instructor', label: 'By Faculty' },
                  { id: 'room', label: 'By Room' },
                  { id: 'all', label: 'All Classes' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setViewType(mode.id);
                    if (mode.id === 'section' && sections.length > 0) setSelectedId(sections[0].id.toString());
                    if (mode.id === 'instructor' && instructors.length > 0) setSelectedId(instructors[0].id.toString());
                    if (mode.id === 'room' && rooms.length > 0) setSelectedId(rooms[0].id.toString());
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                    viewType === mode.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Entity Select Dropdown */}
            {viewType !== 'all' && (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Select {viewType}:
                </span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-1.5 shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {viewType === 'section' &&
                    sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.department?.code} Yr {sec.year_level} - Sec {sec.name || 'A'}
                      </option>
                    ))}
                  {viewType === 'instructor' &&
                    instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        Prof. {inst.first_name} {inst.last_name}
                      </option>
                    ))}
                  {viewType === 'room' &&
                    rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Rm {r.room_number} ({r.building} • {r.room_type})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Academic Term Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Term:</span>
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-1.5 shadow-2xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_active ? '★ (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Showing <strong className="text-slate-800 font-bold">{filteredSlots.length}</strong> scheduled class blocks
          </div>
        </div>
      </div>

      {/* Main Timetable Document Area */}
      <main className="flex-1 max-w-[1500px] w-full mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 sm:p-8 print:border-none print:shadow-none print:p-2">
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
            <div>
              <div className="flex items-center space-x-2 text-indigo-700 font-extrabold text-xs uppercase tracking-widest mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <span>College Academic Scheduling System</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {entityTitle}
              </h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Official Weekly Timetable • {activeTermName}
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-500">
              <div>Academic Year 2026-2027</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          {/* Timetable Grid Table */}
          <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-2xs print:border-slate-800">
            <table className="w-full border-collapse text-left min-w-[900px]">
              <thead>
                <tr className="bg-slate-900 text-white text-xs uppercase font-extrabold tracking-wider">
                  <th className="p-3 border-r border-slate-700 text-center w-36">Time Slot</th>
                  {DAYS.map((d) => (
                    <th key={d.code} className="p-3 border-r border-slate-700 text-center last:border-r-0">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {TIME_WINDOWS.map((win, idx) => {
                  if (win.isLunch) {
                    return (
                      <tr key={idx} className="bg-amber-50/80 border-y border-amber-200">
                        <td className="p-2.5 font-bold text-center text-amber-900 border-r border-amber-200 text-[11px]">
                          {win.label.split(' ')[0]} - {win.label.split(' ')[2]}
                        </td>
                        <td
                          colSpan={6}
                          className="p-2.5 text-center font-extrabold text-amber-800 uppercase tracking-widest text-xs"
                        >
                          🍴 Universal Institutional Lunch Break (12:00 PM - 01:00 PM)
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      {/* Time Slot Header */}
                      <td className="p-2.5 border-r border-slate-200 bg-slate-50 font-bold text-slate-700 text-center text-[11px] whitespace-nowrap">
                        {win.label}
                      </td>

                      {/* Day Columns */}
                      {DAYS.map((day) => {
                        const cellData = timetableGrid[idx]?.[day.code];
                        if (!cellData || cellData.skip) {
                          // Covered by an earlier row's rowSpan (e.g. 3-hour Laboratory) -> skip rendering <td>
                          return null;
                        }

                        if (cellData.slots.length === 0) {
                          return (
                            <td
                              key={day.code}
                              rowSpan={cellData.rowSpan}
                              className="p-2 border-r border-slate-200 last:border-r-0 align-top bg-white"
                            />
                          );
                        }

                        const isMultiRow = cellData.rowSpan > 1;

                        return (
                          <td
                            key={day.code}
                            rowSpan={cellData.rowSpan}
                            className="p-2 border-r border-slate-200 last:border-r-0 align-top transition-colors bg-slate-50/40"
                          >
                            {cellData.slots.map((slot, sIdx) => {
                              const isCustom = slot.is_custom;
                              const courseCode = isCustom
                                ? slot.custom_title || 'Custom Activity'
                                : slot.section_subject?.course?.code || 'Course';
                              const courseName = slot.section_subject?.course?.name;
                              
                              const isAsync = !isCustom && (!slot.room || slot.is_async);
                              const isLab = !isCustom && !isAsync && (slot.room?.room_type === 'LABORATORY' || slot.section_subject?.course?.has_lab);
                              const isLec = !isCustom && !isAsync && !isLab;

                              const sec = slot.section_subject?.section?.name;
                              const rm = slot.room?.room_number;
                              const roomDisplay = isCustom
                                ? (rm ? `Rm ${rm}` : 'Custom')
                                : isAsync
                                ? 'Online / Async'
                                : (rm ? `Rm ${rm}` : 'TBA');

                              const prof = slot.section_subject?.professor
                                ? `${slot.section_subject.professor.first_name?.[0] || ''}. ${slot.section_subject.professor.last_name}`
                                : 'TBA';

                              const formattedTimeRange = `${slot.start_time?.substring(0, 5)} - ${slot.end_time?.substring(0, 5)}`;

                              return (
                                <div
                                  key={sIdx}
                                  className={`rounded-lg shadow-2xs mb-1.5 last:mb-0 transition flex flex-col justify-between ${
                                    isMultiRow ? 'p-3 h-full min-h-[110px]' : 'p-2'
                                  } ${
                                    isCustom
                                      ? 'bg-emerald-50/90 border border-emerald-300 text-emerald-950'
                                      : isAsync
                                      ? 'bg-purple-50/90 border border-purple-300 text-purple-950'
                                      : isLab
                                      ? 'bg-amber-50/90 border-2 border-amber-400 text-amber-950 shadow-xs'
                                      : 'bg-indigo-50/90 border border-indigo-200 text-indigo-950'
                                  }`}
                                >
                                  <div>
                                    {/* Code & Type */}
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="font-black text-slate-900 text-xs sm:text-sm truncate">
                                        {courseCode}
                                      </span>
                                      <span
                                        className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                          isCustom
                                            ? 'bg-emerald-200/90 text-emerald-950'
                                            : isAsync
                                            ? 'bg-purple-200 text-purple-950'
                                            : isLab
                                            ? 'bg-amber-300 text-amber-950 font-black shadow-2xs'
                                            : 'bg-indigo-200/90 text-indigo-950'
                                        }`}
                                      >
                                        {isCustom ? 'Custom' : isAsync ? 'Async' : isLab ? `Lab (${cellData.rowSpan}h)` : 'Lec'}
                                      </span>
                                    </div>

                                    {/* Time Range */}
                                    <div className="text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                                      <span>🕒</span>
                                      <span>{formattedTimeRange}</span>
                                    </div>

                                    {/* Course Name */}
                                    {!isCustom && courseName && (
                                      <div className={`text-[10.5px] font-medium truncate mb-1.5 ${isLab ? 'text-amber-900' : 'text-slate-600'}`} title={courseName}>
                                        {courseName}
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-auto pt-1 border-t border-slate-200/80 space-y-1">
                                    {/* Section & Room */}
                                    <div className="flex items-center justify-between text-[10px] font-bold bg-white/80 px-1.5 py-0.5 rounded">
                                      <span className="text-slate-800">{isCustom ? 'Activity' : `Sec ${sec || 'A'}`}</span>
                                      <span className={`font-extrabold ${isLab ? 'text-amber-900' : isAsync ? 'text-purple-800' : 'text-indigo-900'}`}>
                                        {roomDisplay}
                                      </span>
                                    </div>

                                    {/* Professor */}
                                    <div className="text-[9.5px] font-semibold text-slate-700 truncate flex items-center gap-1">
                                      <span className="text-slate-400">👤</span>
                                      <span>{prof}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Official Signature Footer - Visible on Screen & Print */}
          <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-2 sm:grid-cols-3 gap-8 text-center text-xs text-slate-700">
            <div>
              <div className="border-b border-slate-400 h-10 w-44 mx-auto mb-1"></div>
              <p className="font-bold text-slate-900">Prepared By</p>
              <p className="text-[10px] text-slate-500">Academic Timetable Coordinator</p>
            </div>
            <div>
              <div className="border-b border-slate-400 h-10 w-44 mx-auto mb-1"></div>
              <p className="font-bold text-slate-900">Verified By</p>
              <p className="text-[10px] text-slate-500">College Registrar</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="border-b border-slate-400 h-10 w-44 mx-auto mb-1"></div>
              <p className="font-bold text-slate-900">Approved By</p>
              <p className="text-[10px] text-slate-500">Dean of Academic Affairs</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
