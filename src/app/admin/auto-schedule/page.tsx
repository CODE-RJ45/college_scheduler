"use client";

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import AutoScheduleResultsModal from './components/AutoScheduleResultsModal';
import Footer from '../../components/Footer';

export default function AutoScheduleSettings() {
  const router = useRouter();

  // Data Loading State
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionSubjects, setSectionSubjects] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);

  // Target Scope State
  const [selectedTermId, setSelectedTermId] = useState<number | ''>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | ''>('');

  // Execution & Progress State
  const [scheduling, setScheduling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [scheduleResults, setScheduleResults] = useState<any | null>(null);

  // Active Policy Preset tracker
  const [activePreset, setActivePreset] = useState<'standard' | 'hybrid' | 'compact'>('standard');

  // Constraints state
  const [constraints, setConstraints] = useState({
    operatingHours: { start: '07:30', end: '17:00' },
    universalBreak: { enabled: true, start: '12:00', end: '13:00' },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    strictCapacity: true,
    instructorMaxHours: 6,
    maxClassesPerDay: 5,
    maxConsecutiveHours: 4,
    schedulingStrategy: 'COMPACT',
    strictRoomType: true,
    asyncDays: ['FRI'] as string[],
    enforceFacultyAvailability: true,
  });

  // Fetch initial master data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/dashboard-data/');
        const data = res.data;
        setTerms(data.terms || []);
        setDepartments(data.departments || []);
        setSections(data.sections || []);
        setSectionSubjects(data.sectionSubjects || []);
        setRooms(data.rooms || []);
        setInstructors(data.instructors || []);

        // Default to active term
        const active = (data.terms || []).find((t: any) => t.is_active);
        if (active) {
          setSelectedTermId(active.id);
        } else if (data.terms && data.terms.length > 0) {
          setSelectedTermId(data.terms[0].id);
        }
      } catch (err) {
        console.error('Failed to load auto-schedule data', err);
        toast.error('Failed to load master configuration data.');
      } finally {
        setLoading(false);
      }
    };
    fetchMasterData();
  }, []);

  // Progress bar animation during scheduling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scheduling) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          const increment = (95 - prev) * 0.12;
          return prev + increment > 95 ? 95 : prev + increment;
        });
      }, 400);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [scheduling]);

  // Active Term reference
  const currentTerm = useMemo(() => {
    return terms.find((t) => t.id === selectedTermId) || null;
  }, [terms, selectedTermId]);

  // Current Department reference
  const currentDepartment = useMemo(() => {
    if (!selectedDepartmentId) return null;
    return departments.find((d) => d.id === selectedDepartmentId) || null;
  }, [departments, selectedDepartmentId]);

  // Pre-flight Scoped Subjects & Metrics
  const scopedSectionSubjects = useMemo(() => {
    return sectionSubjects.filter((ss) => {
      if (selectedTermId && ss.section?.term?.id !== selectedTermId) return false;
      if (selectedDepartmentId && ss.section?.department?.id !== selectedDepartmentId) return false;
      return true;
    });
  }, [sectionSubjects, selectedTermId, selectedDepartmentId]);

  const assignedInstructorsCount = useMemo(() => {
    return scopedSectionSubjects.filter((ss) => ss.professor != null).length;
  }, [scopedSectionSubjects]);

  const lectureRoomsCount = useMemo(() => {
    return rooms.filter((r) => (r.room_type || 'LECTURE').toUpperCase() === 'LECTURE').length;
  }, [rooms]);

  const labRoomsCount = useMemo(() => {
    return rooms.filter((r) => (r.room_type || '').toUpperCase() === 'LABORATORY').length;
  }, [rooms]);

  const toggleDay = (day: string) => {
    setConstraints((prev) => {
      const activeDays = prev.activeDays.includes(day)
        ? prev.activeDays.filter((d) => d !== day)
        : [...prev.activeDays, day];
      return { ...prev, activeDays };
    });
  };

  const toggleAsyncDay = (day: string) => {
    setConstraints((prev) => {
      const asyncDays = prev.asyncDays.includes(day)
        ? prev.asyncDays.filter((d) => d !== day)
        : [...prev.asyncDays, day];
      return { ...prev, asyncDays };
    });
  };

  // Preset Configurations
  const applyPreset = (preset: 'standard' | 'hybrid' | 'compact') => {
    setActivePreset(preset);
    if (preset === 'standard') {
      setConstraints((prev) => ({
        ...prev,
        operatingHours: { start: '07:30', end: '17:00' },
        universalBreak: { enabled: true, start: '12:00', end: '13:00' },
        activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        asyncDays: ['FRI'],
        instructorMaxHours: 6,
        maxClassesPerDay: 5,
        maxConsecutiveHours: 4,
        schedulingStrategy: 'BALANCED',
        strictCapacity: true,
        strictRoomType: true,
      }));
      toast.success('Applied Standard Collegiate policy preset (Friday Async).');
    } else if (preset === 'hybrid') {
      setConstraints((prev) => ({
        ...prev,
        operatingHours: { start: '07:30', end: '17:30' },
        universalBreak: { enabled: true, start: '12:00', end: '13:00' },
        activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
        asyncDays: ['FRI'],
        instructorMaxHours: 6,
        maxClassesPerDay: 5,
        maxConsecutiveHours: 4,
        schedulingStrategy: 'BALANCED',
        strictCapacity: true,
        strictRoomType: true,
      }));
      toast.success('Applied Hybrid Async Day policy preset (Friday Async).');
    } else if (preset === 'compact') {
      setConstraints((prev) => ({
        ...prev,
        operatingHours: { start: '07:30', end: '18:00' },
        universalBreak: { enabled: true, start: '12:00', end: '13:00' },
        activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        asyncDays: ['FRI'],
        instructorMaxHours: 7,
        maxClassesPerDay: 6,
        maxConsecutiveHours: 5,
        schedulingStrategy: 'COMPACT',
        strictCapacity: true,
        strictRoomType: true,
      }));
      toast.success('Applied Commuter Compact policy preset (Friday Async).');
    }
  };

  // Run Auto-Schedule Handler
  const handleAutoSchedule = async () => {
    if (!selectedTermId) {
      toast.error('Please select an Academic Term to target.');
      return;
    }
    if (scopedSectionSubjects.length === 0) {
      toast.error('No curriculum subject sections found in the selected target scope.');
      return;
    }

    setScheduling(true);
    try {
      const payload = {
        term_id: Number(selectedTermId),
        department_id: selectedDepartmentId ? Number(selectedDepartmentId) : null,
        constraints,
      };

      const res = await axios.post('http://localhost:8000/api/auto-schedule/', payload);
      setProgress(100);
      setScheduleResults(res.data);
      setResultsModalOpen(true);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error || err.message || 'Auto-scheduling engine failed.';
      toast.error(`Scheduling error: ${errorMsg}`);
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs font-semibold">
        Loading scheduler configuration...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 mb-1">
              <Link
                href="/admin/dashboard"
                className="hover:text-indigo-600 transition-colors flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Dashboard</span>
              </Link>
              <span>/</span>
              <span className="text-slate-700">Auto-Schedule Engine</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Auto-Schedule Configuration
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure parameters, constraints, and scope before triggering master schedule placement.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            Cancel & Return
          </Link>
        </div>

        {/* Target Scope Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Target Scope</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Schedules will only be created for subjects within this scope
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Academic Semester / Term <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_active ? '(Active Semester)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                College Department Scope
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) =>
                  setSelectedDepartmentId(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">-- All College Departments --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pre-Flight Readiness Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Target Subjects
            </span>
            <div className="text-2xl font-bold text-slate-900 leading-none">
              {scopedSectionSubjects.length}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Sections in scope</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Faculty Coverage
            </span>
            <div className="text-2xl font-bold text-indigo-700 leading-none">
              {scopedSectionSubjects.length > 0
                ? `${Math.round((assignedInstructorsCount / scopedSectionSubjects.length) * 100)}%`
                : '100%'}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {assignedInstructorsCount}/{scopedSectionSubjects.length} Assigned
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Available Facilities
            </span>
            <div className="text-2xl font-bold text-slate-900 leading-none">{rooms.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              {lectureRoomsCount} Lec &bull; {labRoomsCount} Lab
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Sunday Policy
            </span>
            <div className="text-sm font-bold text-emerald-700 leading-none flex items-center space-x-1.5 mt-1">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Off-Duty Default</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Faculty protected</p>
          </div>
        </div>

        {/* Policy Presets Strip */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Quick Policy Presets
            </h4>
            <p className="text-xs text-slate-500">Apply standard collegiate scheduling guidelines with 1-click</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => applyPreset('standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                activePreset === 'standard'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Standard Collegiate
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hybrid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                activePreset === 'hybrid'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Hybrid Async Day
            </button>
            <button
              type="button"
              onClick={() => applyPreset('compact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                activePreset === 'compact'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Commuter Compact
            </button>
          </div>
        </div>

        {/* Constraints Form Card */}
        <div className="bg-white rounded-xl shadow-2xs border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Left Column: Time & Calendar Days */}
            <div className="p-6 space-y-6">
              {/* Operating Hours */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  1. Operating Hours & Active Days
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Campus Daily Time Window
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Earliest Class</span>
                        <input
                          type="time"
                          value={constraints.operatingHours.start}
                          onChange={(e) =>
                            setConstraints({
                              ...constraints,
                              operatingHours: {
                                ...constraints.operatingHours,
                                start: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">Latest Dismissal</span>
                        <input
                          type="time"
                          value={constraints.operatingHours.end}
                          onChange={(e) =>
                            setConstraints({
                              ...constraints,
                              operatingHours: {
                                ...constraints.operatingHours,
                                end: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Active Days */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                      Active Teaching Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => {
                        const isActive = constraints.activeDays.includes(day);
                        const isSunday = day === 'SUN';

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              isActive
                                ? isSunday
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    {constraints.activeDays.includes('SUN') && (
                      <p className="text-[11px] text-amber-700 font-semibold mt-1.5 flex items-center space-x-1">
                        <span>⚠️ Note: Faculty are off-duty on Sundays by default.</span>
                      </p>
                    )}
                  </div>

                  {/* Universal Lunch Break */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Universal Protected Break
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Ensures students and professors have protected lunch time
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={constraints.universalBreak.enabled}
                        onChange={(e) =>
                          setConstraints({
                            ...constraints,
                            universalBreak: {
                              ...constraints.universalBreak,
                              enabled: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>

                    {constraints.universalBreak.enabled && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Break Start</span>
                          <input
                            type="time"
                            value={constraints.universalBreak.start}
                            onChange={(e) =>
                              setConstraints({
                                ...constraints,
                                universalBreak: {
                                  ...constraints.universalBreak,
                                  start: e.target.value,
                                },
                              })
                            }
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Break End</span>
                          <input
                            type="time"
                            value={constraints.universalBreak.end}
                            onChange={(e) =>
                              setConstraints({
                                ...constraints,
                                universalBreak: {
                                  ...constraints.universalBreak,
                                  end: e.target.value,
                                },
                              })
                            }
                            className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Asynchronous Days */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Designated Asynchronous Online Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => {
                        const isAsync = constraints.asyncDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleAsyncDay(day)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                              isAsync
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Classes placed on asynchronous days will not consume physical rooms.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Workload & Strict Constraints */}
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  2. Workload & Classroom Guardrails
                </h3>

                {/* Placement Strategy */}
                <div className="space-y-3 mb-5">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">
                    Timetable Placement Strategy
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() =>
                        setConstraints({ ...constraints, schedulingStrategy: 'COMPACT' })
                      }
                      className={`p-3 rounded-xl cursor-pointer transition border ${
                        constraints.schedulingStrategy === 'COMPACT'
                          ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          checked={constraints.schedulingStrategy === 'COMPACT'}
                          readOnly
                          className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-900">Compact</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 ml-5">
                        Concentrate classes to minimize commute days for students.
                      </p>
                    </div>

                    <div
                      onClick={() =>
                        setConstraints({ ...constraints, schedulingStrategy: 'BALANCED' })
                      }
                      className={`p-3 rounded-xl cursor-pointer transition border ${
                        constraints.schedulingStrategy === 'BALANCED'
                          ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          checked={constraints.schedulingStrategy === 'BALANCED'}
                          readOnly
                          className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-900">Balanced</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 ml-5">
                        Spread teaching loads evenly across Monday through Friday.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sliders */}
                <div className="space-y-4 mb-5">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Max Teaching Hours / Day (per Instructor)
                      </span>
                      <span className="text-xs font-bold text-indigo-700">
                        {constraints.instructorMaxHours}h
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={constraints.instructorMaxHours}
                      onChange={(e) =>
                        setConstraints({
                          ...constraints,
                          instructorMaxHours: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Max Subjects / Day (per Section)
                      </span>
                      <span className="text-xs font-bold text-indigo-700">
                        {constraints.maxClassesPerDay} classes
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="8"
                      step="1"
                      value={constraints.maxClassesPerDay}
                      onChange={(e) =>
                        setConstraints({
                          ...constraints,
                          maxClassesPerDay: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-700">
                        Max Consecutive Hours (before forced break)
                      </span>
                      <span className="text-xs font-bold text-indigo-700">
                        {constraints.maxConsecutiveHours}h
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="6"
                      step="1"
                      value={constraints.maxConsecutiveHours}
                      onChange={(e) =>
                        setConstraints({
                          ...constraints,
                          maxConsecutiveHours: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                </div>

                {/* Strict Rules */}
                <div className="space-y-2.5">
                  <label className="flex items-start p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={constraints.strictCapacity}
                      onChange={(e) =>
                        setConstraints({ ...constraints, strictCapacity: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                    />
                    <div className="ml-2.5">
                      <span className="text-xs font-bold text-slate-900 block">
                        Strict Classroom Capacity Enforcement
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Never place a section into a room whose seating capacity is smaller than the section size.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={constraints.strictRoomType}
                      onChange={(e) =>
                        setConstraints({ ...constraints, strictRoomType: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                    />
                    <div className="ml-2.5">
                      <span className="text-xs font-bold text-slate-900 block">
                        Strict Facility Type Matching
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Laboratories are strictly assigned to Laboratory rooms; Lectures to Lecture halls.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Target Scope:{' '}
              <span className="font-bold text-slate-800">
                {currentTerm?.name || 'Active Semester'}
              </span>
              {' &bull; '}
              <span className="font-bold text-slate-800">
                {currentDepartment ? currentDepartment.name : 'All Departments'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAutoSchedule}
              disabled={scheduling}
              className="relative overflow-hidden inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-xs disabled:opacity-50 min-w-[220px]"
            >
              {scheduling && (
                <div
                  className="absolute left-0 top-0 bottom-0 bg-indigo-800 transition-all duration-300 ease-out z-0"
                  style={{ width: `${progress}%` }}
                />
              )}
              <div className="relative z-10 flex items-center space-x-2">
                {scheduling ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating Schedule... {Math.round(progress)}%</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Run Auto-Schedule Engine</span>
                  </>
                )}
              </div>
            </button>
          </div>

          <Footer variant="light" />
        </div>
      </div>

      {/* Results Diagnostics Modal */}
      <AutoScheduleResultsModal
        isOpen={resultsModalOpen}
        onClose={() => setResultsModalOpen(false)}
        results={scheduleResults}
        targetTermName={currentTerm?.name}
        targetDepartmentName={currentDepartment?.name}
        onGoToCalendar={() => {
          setResultsModalOpen(false);
          router.push('/admin/dashboard?tab=calendar');
        }}
      />

      <Toaster position="bottom-right" />
    </div>
  );
}
