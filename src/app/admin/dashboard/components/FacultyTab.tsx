"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import axios from 'axios';
import toast from 'react-hot-toast';
import FacultyModal from './FacultyModal';
import ImportFacultyModal from './ImportFacultyModal';
import FacultyAvailabilityModal from './FacultyAvailabilityModal';
import FacultyDetailDrawer from './FacultyDetailDrawer';

interface FacultyTabProps {
  instructors: any[];
  sectionSubjects: any[];
  scheduleSlots: any[];
  terms?: any[];
  fetchData: () => void;
  setActiveTab: (tab: string) => void;
  setCalendarViewType: (view: string) => void;
  setSelectedCalendarId: (id: string) => void;
}

const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

export default function FacultyTab({
  instructors,
  sectionSubjects,
  scheduleSlots,
  terms = [],
  fetchData,
  setActiveTab,
  setCalendarViewType,
  setSelectedCalendarId,
}: FacultyTabProps) {
  // Find active term
  const activeTerm = useMemo(() => (terms || []).find((t: any) => t.is_active) || null, [terms]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [termFilter, setTermFilter] = useState<'ACTIVE' | number | 'ALL'>('ACTIVE');
  const [workloadFilter, setWorkloadFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED' | 'OPTIMAL' | 'UNDERLOAD' | 'OVERLOAD'>('ALL');

  // Modals & Drawer State
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [facultyToEdit, setFacultyToEdit] = useState<any | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [availabilityInstructor, setAvailabilityInstructor] = useState<any | null>(null);
  const [selectedFacultyForDrawer, setSelectedFacultyForDrawer] = useState<any | null>(null);
  const [facultyToDelete, setFacultyToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Term-scoped Section Subjects
  const scopedSectionSubjects = useMemo(() => {
    return (sectionSubjects || []).filter((ss) => {
      if (termFilter === 'ACTIVE') {
        return activeTerm ? ss.section?.term?.id === activeTerm.id : true;
      } else if (termFilter !== 'ALL') {
        return ss.section?.term?.id === termFilter;
      }
      return true;
    });
  }, [sectionSubjects, termFilter, activeTerm]);

  // Term-scoped Schedule Slots
  const scopedScheduleSlots = useMemo(() => {
    return (scheduleSlots || []).filter((slot) => {
      const slotTermId = slot.section_subject?.section?.term?.id;
      if (termFilter === 'ACTIVE') {
        return activeTerm ? (slotTermId ? slotTermId === activeTerm.id : true) : true;
      } else if (termFilter !== 'ALL') {
        return slotTermId ? slotTermId === termFilter : true;
      }
      return true;
    });
  }, [scheduleSlots, termFilter, activeTerm]);

  // Compute stats per instructor
  const instructorStats = useMemo(() => {
    const map = new Map<number, {
      assignedCount: number;
      totalUnits: number;
      assignedHours: number;
      scheduledHours: number;
      maxHours: number;
      status: 'UNASSIGNED' | 'UNDERLOAD' | 'OPTIMAL' | 'OVERLOAD';
    }>();

    instructors.forEach((prof) => {
      const assigned = scopedSectionSubjects.filter((ss) => ss.professor && ss.professor.id === prof.id);
      const totalUnits = assigned.reduce((sum, ss) => sum + (Number(ss.course?.credits) || 0), 0);
      const assignedHours = assigned.reduce(
        (sum, ss) => sum + (ss.course?.has_lab ? 5 : Number(ss.course?.credits) || 3),
        0
      );
      
      const slots = scopedScheduleSlots.filter(
        (slot) => (slot.section_subject?.professor?.id === prof.id) || (slot.professor?.id === prof.id)
      );
      const scheduledHours = slots.reduce((sum, slot) => {
        if (!slot.start_time || !slot.end_time) return sum;
        const [startH, startM] = slot.start_time.split(':').map(Number);
        const [endH, endM] = slot.end_time.split(':').map(Number);
        const hours = (endH * 60 + endM - (startH * 60 + startM)) / 60;
        return sum + (hours > 0 ? hours : 0);
      }, 0);

      const maxHours = prof.max_hours_per_week || 30;
      let status: 'UNASSIGNED' | 'UNDERLOAD' | 'OPTIMAL' | 'OVERLOAD' = 'OPTIMAL';
      if (assigned.length === 0) {
        status = 'UNASSIGNED';
      } else if (assignedHours > maxHours || totalUnits > 21) {
        status = 'OVERLOAD';
      } else if (assignedHours >= Math.min(18, maxHours) || (totalUnits >= 15 && totalUnits <= 21)) {
        status = 'OPTIMAL';
      } else {
        status = 'UNDERLOAD';
      }

      map.set(prof.id, {
        assignedCount: assigned.length,
        totalUnits,
        assignedHours,
        scheduledHours,
        maxHours,
        status,
      });
    });

    return map;
  }, [instructors, scopedSectionSubjects, scopedScheduleSlots]);

  // Aggregate summary metrics
  const summaryMetrics = useMemo(() => {
    let assignedCount = 0;
    let totalAssignedUnits = 0;

    instructors.forEach((prof) => {
      const stats = instructorStats.get(prof.id);
      if (stats && stats.assignedCount > 0) {
        assignedCount++;
        totalAssignedUnits += stats.totalUnits;
      }
    });

    const unassignedCount = instructors.length - assignedCount;
    const avgLoad = assignedCount > 0 ? (totalAssignedUnits / assignedCount).toFixed(1) : '0';

    return {
      total: instructors.length,
      assigned: assignedCount,
      unassigned: unassignedCount,
      avgLoad,
      totalSlots: scopedScheduleSlots.filter((s) => s.section_subject?.professor || s.professor).length,
    };
  }, [instructors, instructorStats, scopedScheduleSlots]);

  // Filtered instructors
  const filteredInstructors = useMemo(() => {
    return instructors.filter((prof) => {
      const stats = instructorStats.get(prof.id);

      // Workload filter
      if (workloadFilter === 'ASSIGNED' && (!stats || stats.assignedCount === 0)) return false;
      if (workloadFilter === 'UNASSIGNED' && stats && stats.assignedCount > 0) return false;
      if (workloadFilter === 'OPTIMAL' && stats?.status !== 'OPTIMAL') return false;
      if (workloadFilter === 'UNDERLOAD' && stats?.status !== 'UNDERLOAD') return false;
      if (workloadFilter === 'OVERLOAD' && stats?.status !== 'OVERLOAD') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${prof.first_name || ''} ${prof.last_name || ''}`.toLowerCase();
        const email = (prof.email || '').toLowerCase();
        const username = (prof.username || '').toLowerCase();
        if (!fullName.includes(q) && !email.includes(q) && !username.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [instructors, instructorStats, workloadFilter, searchQuery]);

  // Handlers
  const handleCalendarJump = (instructorId: number) => {
    setActiveTab('calendar');
    setCalendarViewType('instructor');
    setSelectedCalendarId(instructorId.toString());
  };

  const handleConfirmDelete = async () => {
    if (!facultyToDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(`http://localhost:8000/api/users/${facultyToDelete.id}/`);
      toast.success(`Faculty member ${facultyToDelete.first_name} ${facultyToDelete.last_name} deleted.`);
      if (selectedFacultyForDrawer?.id === facultyToDelete.id) {
        setSelectedFacultyForDrawer(null);
      }
      setFacultyToDelete(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || 'Failed to delete faculty member.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Tab Header & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-slate-900">Faculty & Availability</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {filteredInstructors.length} {filteredInstructors.length === 1 ? 'Instructor' : 'Instructors'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Institutional faculty directory, teaching load meters, and schedule availability windows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setFacultyToEdit(null);
              setIsFacultyModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Instructor</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition shadow-sm cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Import CSV</span>
          </button>

          <Link
            href="/admin/instructors/new"
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
          >
            <span>Batch Register &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Institutional Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Faculty Roster</span>
            <span className="text-xs font-bold text-indigo-600">Active</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.total}</span>
            <span className="text-xs text-slate-400">Total Professors</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Assignments</span>
            <span className="text-xs font-bold text-emerald-600">{summaryMetrics.assigned} Assigned</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.assigned}</span>
            <span className="text-xs text-amber-600 font-semibold">{summaryMetrics.unassigned} Unassigned</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Teaching Load</span>
            <span className="text-xs font-bold text-slate-700">Per Instructor</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.avgLoad}</span>
            <span className="text-xs text-slate-400">Credits / Faculty</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Scheduled Periods</span>
            <span className="text-xs font-bold text-indigo-600">Timetable</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.totalSlots}</span>
            <span className="text-xs text-slate-400">Class Blocks</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Term Filter Dropdown */}
          <div className="flex items-center space-x-1.5 mr-2">
            <span className="text-xs font-semibold text-slate-600">Semester:</span>
            <select
              value={termFilter}
              onChange={(e) => {
                const val = e.target.value;
                setTermFilter(val === 'ACTIVE' || val === 'ALL' ? val : Number(val));
              }}
              className="text-xs bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-2.5 py-1 font-semibold focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="ACTIVE">
                {activeTerm ? `${activeTerm.name} (Active)` : 'Active Semester'}
              </option>
              {terms.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_active ? '★' : ''}
                </option>
              ))}
              <option value="ALL">All Semesters</option>
            </select>
          </div>

          <span className="text-xs font-semibold text-slate-600 mr-1">Workload:</span>
          {(
            [
              { id: 'ALL', label: 'All Faculty' },
              { id: 'ASSIGNED', label: 'Assigned' },
              { id: 'UNASSIGNED', label: 'Unassigned' },
              { id: 'OPTIMAL', label: 'Optimal Load (15–21)' },
              { id: 'UNDERLOAD', label: 'Underloaded (<15)' },
              { id: 'OVERLOAD', label: 'Overloaded (>21)' },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setWorkloadFilter(filter.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                workloadFilter === filter.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search faculty name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-300 text-slate-800 rounded-lg pl-8 pr-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <svg
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Faculty Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Faculty Member
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Teaching Load
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Availability Window
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredInstructors.map((instructor) => {
                const stats = instructorStats.get(instructor.id);
                const activeDays = instructor.available_days
                  ? instructor.available_days.split(',').map((d: string) => d.trim().toUpperCase())
                  : ['MON', 'TUE', 'WED', 'THU', 'FRI'];

                return (
                  <tr key={instructor.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Faculty Identity */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                          {instructor.first_name?.[0] || 'P'}
                          {instructor.last_name?.[0] || 'R'}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block">
                            {instructor.first_name} {instructor.last_name}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            @{instructor.username}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email / Contact */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-700">
                      <span>{instructor.email}</span>
                    </td>

                    {/* Teaching Load */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider ${
                              stats?.status === 'OPTIMAL'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : stats?.status === 'UNDERLOAD'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : stats?.status === 'OVERLOAD'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {stats?.status === 'OVERLOAD' ? 'Overload' : stats?.status === 'UNDERLOAD' ? 'Underload' : stats?.status === 'OPTIMAL' ? 'Optimal' : 'Unassigned'}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {stats?.assignedHours ? stats.assignedHours.toFixed(1) : '0.0'} / {instructor.max_hours_per_week || 30} hrs/wk
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                          <span className="font-medium text-slate-700">{stats?.totalUnits || 0} Units</span>
                          <span>&bull;</span>
                          <span>{stats?.assignedCount || 0} {stats?.assignedCount === 1 ? 'course' : 'courses'}</span>
                          {stats && stats.scheduledHours > 0 && (
                            <>
                              <span>&bull;</span>
                              <span className="text-indigo-600 font-semibold">{stats.scheduledHours.toFixed(1)}h placed</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Availability */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1">
                          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                            <span
                              key={d}
                              className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${
                                activeDays.includes(d)
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-300'
                              }`}
                              title={d}
                            >
                              {d[0]}
                            </span>
                          ))}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {instructor.available_start_time && instructor.available_end_time ? (
                            <span>
                              {formatTime(instructor.available_start_time)} – {formatTime(instructor.available_end_time)}
                            </span>
                          ) : (
                            <span className="text-slate-400">All day (Unrestricted)</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Inspect Drawer */}
                        <button
                          type="button"
                          onClick={() => setSelectedFacultyForDrawer(instructor)}
                          className="px-2.5 py-1 font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                          title="Inspect teaching workload and assigned classes"
                        >
                          Inspect
                        </button>

                        {/* Availability Modal */}
                        <button
                          type="button"
                          onClick={() => setAvailabilityInstructor(instructor)}
                          className="px-2.5 py-1 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                          title="Configure availability constraints"
                        >
                          Availability
                        </button>

                        {/* Calendar Shortcut */}
                        <button
                          type="button"
                          onClick={() => handleCalendarJump(instructor.id)}
                          className="px-2.5 py-1 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                          title="View weekly calendar schedule"
                        >
                          Calendar
                        </button>

                        {/* Edit Profile */}
                        <button
                          type="button"
                          onClick={() => {
                            setFacultyToEdit(instructor);
                            setIsFacultyModalOpen(true);
                          }}
                          className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                          title="Edit instructor details"
                        >
                          Edit
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setFacultyToDelete(instructor)}
                          className="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Remove instructor"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredInstructors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                    No faculty members found matching current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faculty Profile & Timetable Drawer */}
      <FacultyDetailDrawer
        isOpen={Boolean(selectedFacultyForDrawer)}
        onClose={() => setSelectedFacultyForDrawer(null)}
        instructor={selectedFacultyForDrawer}
        sectionSubjects={scopedSectionSubjects}
        scheduleSlots={scopedScheduleSlots}
        onViewCalendar={handleCalendarJump}
        onEditAvailability={(inst) => {
          setSelectedFacultyForDrawer(null);
          setAvailabilityInstructor(inst);
        }}
        onEditProfile={(inst) => {
          setSelectedFacultyForDrawer(null);
          setFacultyToEdit(inst);
          setIsFacultyModalOpen(true);
        }}
      />

      {/* In-Dashboard Faculty Registration / Edit Modal */}
      <FacultyModal
        isOpen={isFacultyModalOpen}
        onClose={() => setIsFacultyModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        facultyToEdit={facultyToEdit}
      />

      {/* CSV Batch Import Modal */}
      <ImportFacultyModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
      />

      {/* Visual Weekly Availability Modal */}
      <FacultyAvailabilityModal
        isOpen={Boolean(availabilityInstructor)}
        onClose={() => setAvailabilityInstructor(null)}
        onSuccess={() => {
          fetchData();
        }}
        instructor={availabilityInstructor}
      />

      {/* Delete Confirmation Modal */}
      {facultyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-rose-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Delete Faculty Member</h3>
              <button
                type="button"
                onClick={() => setFacultyToDelete(null)}
                className="text-rose-200 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">
                Are you sure you want to permanently delete faculty member{' '}
                <span className="font-bold text-slate-900">
                  {facultyToDelete.first_name} {facultyToDelete.last_name}
                </span>{' '}
                (@{facultyToDelete.username})?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <span className="font-bold block mb-0.5">Warning:</span>
                Their assigned subject sections will revert to unassigned (TBA), and their personal schedule slots will be removed.
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFacultyToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
