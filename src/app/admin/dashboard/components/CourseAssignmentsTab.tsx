"use client";

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Link from 'next/link';
import toast from 'react-hot-toast';

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

interface CourseAssignmentsTabProps {
  instructors: any[];
  courses: any[];
  sections: any[];
  sectionSubjects: any[];
  scheduleSlots: any[];
  departments: Department[];
  terms: Term[];
  fetchData: () => void;
  isStandalone?: boolean;
}

const extractErrorMessage = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (Array.isArray(data) && data.length > 0) return String(data[0]);
  if (typeof data === 'object') {
    if (data.detail) return String(data.detail);
    if (data.error) return String(data.error);
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val) && val.length > 0) return `${firstKey}: ${val[0]}`;
      if (typeof val === 'string') return `${firstKey}: ${val}`;
    }
  }
  return fallback;
};

export default function CourseAssignmentsTab({
  instructors,
  courses,
  sections,
  sectionSubjects,
  scheduleSlots,
  departments,
  terms,
  fetchData,
  isStandalone = false,
}: CourseAssignmentsTabProps) {
  // Find active term
  const activeTerm = useMemo(() => terms.find((t) => t.is_active) || null, [terms]);

  // View Mode: 'WORKBENCH' (By Faculty) vs 'MATRIX' (Curriculum Table)
  const [viewMode, setViewMode] = useState<'WORKBENCH' | 'MATRIX'>('WORKBENCH');

  // Layout & Box Adjustment State
  const [layoutPreset, setLayoutPreset] = useState<'BALANCED' | 'FOCUS_FACULTY' | 'FOCUS_AVAILABLE' | 'FOCUS_STAGED' | 'CUSTOM'>('BALANCED');
  const [facultyRatio, setFacultyRatio] = useState<number>(33);
  const [stagedRatio, setStagedRatio] = useState<number>(33);
  const [availableRatio, setAvailableRatio] = useState<number>(34);
  const [heightMode, setHeightMode] = useState<'standard' | 'tall' | 'fit'>(isStandalone ? 'fit' : 'standard');
  const [cardDensity, setCardDensity] = useState<'normal' | 'compact'>('normal');
  const [showSliders, setShowSliders] = useState<boolean>(false);

  const applyLayoutPreset = (preset: 'BALANCED' | 'FOCUS_FACULTY' | 'FOCUS_AVAILABLE' | 'FOCUS_STAGED') => {
    setLayoutPreset(preset);
    setShowSliders(false);
    if (preset === 'BALANCED') {
      setFacultyRatio(33);
      setStagedRatio(33);
      setAvailableRatio(34);
    } else if (preset === 'FOCUS_FACULTY') {
      setFacultyRatio(45);
      setStagedRatio(28);
      setAvailableRatio(27);
    } else if (preset === 'FOCUS_STAGED') {
      setFacultyRatio(24);
      setStagedRatio(52);
      setAvailableRatio(24);
    } else if (preset === 'FOCUS_AVAILABLE') {
      setFacultyRatio(24);
      setStagedRatio(28);
      setAvailableRatio(48);
    }
  };

  const containerHeight = useMemo(() => {
    if (heightMode === 'tall') return '850px';
    if (heightMode === 'fit') return isStandalone ? 'calc(100vh - 290px)' : 'calc(100vh - 360px)';
    return '650px';
  }, [heightMode, isStandalone]);

  // Filters State
  const [termFilter, setTermFilter] = useState<'ACTIVE' | number | 'ALL'>('ACTIVE');
  const [departmentFilter, setDepartmentFilter] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [facultySearch, setFacultySearch] = useState('');

  // Workbench Selection State
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('');
  const [stagedSubjectIds, setStagedSubjectIds] = useState<number[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Matrix direct updating state
  const [updatingSubjectId, setUpdatingSubjectId] = useState<number | null>(null);

  // Sync staged subjects when selected instructor changes (scoped to currently selected term)
  useEffect(() => {
    if (selectedInstructorId) {
      const assigned = sectionSubjects
        .filter((ss) => {
          if (ss.professor?.id?.toString() !== selectedInstructorId) return false;
          if (termFilter === 'ACTIVE') {
            return activeTerm ? ss.section?.term?.id === activeTerm.id : true;
          } else if (termFilter !== 'ALL') {
            return ss.section?.term?.id === termFilter;
          }
          return true;
        })
        .map((ss) => ss.id);
      setStagedSubjectIds(assigned);
    } else {
      setStagedSubjectIds([]);
    }
  }, [selectedInstructorId, sectionSubjects, termFilter, activeTerm]);

  // Selected instructor object
  const currentInstructor = useMemo(() => {
    return instructors.find((i) => i.id.toString() === selectedInstructorId) || null;
  }, [instructors, selectedInstructorId]);

  // Calculate workloads for all instructors (scoped to active/selected term)
  const instructorLoads = useMemo(() => {
    const map = new Map<number, { units: number; count: number; hours: number }>();

    // Filter sectionSubjects to the selected term
    const termSectionSubjects = sectionSubjects.filter((ss) => {
      if (termFilter === 'ACTIVE') {
        return activeTerm ? ss.section?.term?.id === activeTerm.id : true;
      } else if (termFilter !== 'ALL') {
        return ss.section?.term?.id === termFilter;
      }
      return true;
    });

    instructors.forEach((inst) => {
      // In workbench, use staged units if this instructor is currently selected
      const isSelected = inst.id.toString() === selectedInstructorId;
      const assignedSS = isSelected
        ? termSectionSubjects.filter((ss) => stagedSubjectIds.includes(ss.id))
        : termSectionSubjects.filter((ss) => ss.professor?.id === inst.id);

      const units = assignedSS.reduce(
        (sum, ss) => sum + (Number(ss.course?.credits) || 0),
        0
      );
      const hours = assignedSS.reduce(
        (sum, ss) => sum + (ss.course?.has_lab ? 5 : Number(ss.course?.credits) || 3),
        0
      );

      map.set(inst.id, { units, count: assignedSS.length, hours });
    });
    return map;
  }, [instructors, sectionSubjects, selectedInstructorId, stagedSubjectIds, termFilter, activeTerm]);

  // Overall metrics
  const overallMetrics = useMemo(() => {
    const total = sectionSubjects.length;
    const assigned = sectionSubjects.filter((ss) => ss.professor).length;
    const unassigned = total - assigned;
    const assignedPercent = total > 0 ? Math.round((assigned / total) * 100) : 0;

    let totalLoadUnits = 0;
    let activeInstructors = 0;
    instructors.forEach((inst) => {
      const load = instructorLoads.get(inst.id);
      if (load && load.count > 0) {
        totalLoadUnits += load.units;
        activeInstructors++;
      }
    });
    const avgLoad = activeInstructors > 0 ? (totalLoadUnits / activeInstructors).toFixed(1) : '0';

    return { total, assigned, unassigned, assignedPercent, avgLoad };
  }, [sectionSubjects, instructors, instructorLoads]);

  // Filtered section subjects
  const filteredSectionSubjects = useMemo(() => {
    return sectionSubjects.filter((ss) => {
      // Term filter
      if (termFilter === 'ACTIVE') {
        if (activeTerm && ss.section?.term?.id !== activeTerm.id) return false;
      } else if (termFilter !== 'ALL') {
        if (ss.section?.term?.id !== termFilter) return false;
      }

      // Department filter
      if (departmentFilter !== 'ALL') {
        if (ss.section?.department?.id !== departmentFilter) return false;
      }

      // Status filter
      if (statusFilter === 'UNASSIGNED' && ss.professor) return false;
      if (statusFilter === 'ASSIGNED' && !ss.professor) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (ss.course?.code || '').toLowerCase();
        const title = (ss.course?.title || ss.course?.name || '').toLowerCase();
        const sectionName = `${ss.section?.department?.code || ''} ${ss.section?.year_level || ''}${ss.section?.name || ''}`.toLowerCase();
        const profName = ss.professor ? `${ss.professor.first_name} ${ss.professor.last_name}`.toLowerCase() : 'unassigned';
        if (!code.includes(q) && !title.includes(q) && !sectionName.includes(q) && !profName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [sectionSubjects, termFilter, activeTerm, departmentFilter, statusFilter, searchQuery]);

  // Filtered faculty for workbench left column
  const filteredFacultyList = useMemo(() => {
    return instructors.filter((inst) => {
      if (!facultySearch.trim()) return true;
      const q = facultySearch.toLowerCase().trim();
      const name = `${inst.first_name || ''} ${inst.last_name || ''}`.toLowerCase();
      const username = (inst.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [instructors, facultySearch]);

  // Available subjects for selected instructor (excluding already assigned to other faculty or staged)
  const availableWorkbenchSubjects = useMemo(() => {
    return filteredSectionSubjects.filter((ss) => {
      // Must not be currently in staged list for this instructor
      if (stagedSubjectIds.includes(ss.id)) return false;

      // If already assigned to another faculty member (or any faculty if none selected), do not display
      if (ss.professor) {
        if (!selectedInstructorId || ss.professor.id.toString() !== selectedInstructorId) {
          return false;
        }
      }

      return true;
    });
  }, [filteredSectionSubjects, stagedSubjectIds, selectedInstructorId]);

  // Staged subjects for selected instructor
  const stagedWorkbenchSubjects = useMemo(() => {
    return sectionSubjects.filter((ss) => stagedSubjectIds.includes(ss.id));
  }, [sectionSubjects, stagedSubjectIds]);

  // Handlers for Workbench (1-Click & Drag)
  const handleAssignOne = (ssId: number) => {
    if (!selectedInstructorId) {
      toast.error('Please select an instructor first.');
      return;
    }
    if (!stagedSubjectIds.includes(ssId)) {
      setStagedSubjectIds([...stagedSubjectIds, ssId]);
    }
  };

  const handleRemoveOne = (ssId: number) => {
    setStagedSubjectIds(stagedSubjectIds.filter((id) => id !== ssId));
  };

  const handleDragStart = (e: React.DragEvent, ssId: number) => {
    setDraggedItemId(ssId);
    e.dataTransfer.setData('text/plain', ssId.toString());
  };

  const handleDropToStaged = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemId && !stagedSubjectIds.includes(draggedItemId)) {
      setStagedSubjectIds([...stagedSubjectIds, draggedItemId]);
    }
    setDraggedItemId(null);
  };

  const handleDropToAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemId && stagedSubjectIds.includes(draggedItemId)) {
      setStagedSubjectIds(stagedSubjectIds.filter((id) => id !== draggedItemId));
    }
    setDraggedItemId(null);
  };

  // Batch Save for Workbench (scoped to current term so other terms are never modified)
  const handleSaveWorkbench = async () => {
    if (!selectedInstructorId) return;
    setIsSaving(true);
    try {
      const termSectionSubjects = sectionSubjects.filter((ss) => {
        if (termFilter === 'ACTIVE') {
          return activeTerm ? ss.section?.term?.id === activeTerm.id : true;
        } else if (termFilter !== 'ALL') {
          return ss.section?.term?.id === termFilter;
        }
        return true;
      });

      const originallyAssigned = termSectionSubjects
        .filter((ss) => ss.professor?.id?.toString() === selectedInstructorId)
        .map((ss) => ss.id);

      const toAdd = stagedSubjectIds.filter((id) => !originallyAssigned.includes(id));
      const toRemove = originallyAssigned.filter((id) => !stagedSubjectIds.includes(id));

      const requests = [
        ...toAdd.map((id) =>
          axios.patch(`http://localhost:8000/api/section-subjects/${id}/`, {
            professor_id: Number(selectedInstructorId),
          })
        ),
        ...toRemove.map((id) =>
          axios.patch(`http://localhost:8000/api/section-subjects/${id}/`, {
            professor_id: null,
          })
        ),
      ];

      await Promise.all(requests);
      toast.success('Course assignments saved successfully!');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(extractErrorMessage(err, 'Failed to save course assignments.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Direct Inline Assignment for Matrix Mode
  const handleMatrixDirectAssign = async (subjectId: number, professorIdVal: string) => {
    setUpdatingSubjectId(subjectId);
    const profId = professorIdVal ? Number(professorIdVal) : null;
    try {
      await axios.patch(`http://localhost:8000/api/section-subjects/${subjectId}/`, {
        professor_id: profId,
      });
      toast.success(
        profId
          ? 'Instructor assigned successfully!'
          : 'Instructor assignment cleared (TBA).'
      );
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(extractErrorMessage(err, 'Failed to update assignment.'));
    } finally {
      setUpdatingSubjectId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Tab Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-slate-900">Course Assignments</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {filteredSectionSubjects.length} Sections
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Allocate academic teaching staff to curriculum subject cohorts.
          </p>
        </div>

        {/* Right Action Cluster: Fullscreen Launcher & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isStandalone ? (
            <Link
              href="/admin/assignments"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition shadow-xs cursor-pointer"
              title="Open Course Assignments in full in a new browser tab"
            >
              <span>Open in New Tab</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          ) : (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Fullscreen Mode</span>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('WORKBENCH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'WORKBENCH'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Faculty Workbench</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MATRIX')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'MATRIX'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Curriculum Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* Institutional Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sections</span>
            <span className="text-xs font-bold text-indigo-600">Offered</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{overallMetrics.total}</span>
            <span className="text-xs text-slate-400">Curriculum Cohorts</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Faculty Assigned</span>
            <span className="text-xs font-bold text-emerald-600">{overallMetrics.assignedPercent}% Allocated</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{overallMetrics.assigned}</span>
            <span className="text-xs text-emerald-600 font-semibold">Ready for Schedule</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Assignment</span>
            {overallMetrics.unassigned > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Action Required
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                All Set
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${overallMetrics.unassigned > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {overallMetrics.unassigned}
            </span>
            <span className="text-xs text-slate-400">Unassigned (TBA)</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Faculty Load</span>
            <span className="text-xs font-bold text-slate-700">Credits</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{overallMetrics.avgLoad}</span>
            <span className="text-xs text-slate-400">Units / Assigned Faculty</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Term Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-600">Term:</label>
            <select
              value={termFilter}
              onChange={(e) => {
                const val = e.target.value;
                setTermFilter(val === 'ACTIVE' || val === 'ALL' ? val : Number(val));
              }}
              className="text-xs font-medium bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ACTIVE">
                Active Term {activeTerm ? `(${activeTerm.name})` : ''}
              </option>
              <option value="ALL">All Terms</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-600">Department:</label>
            <select
              value={departmentFilter}
              onChange={(e) =>
                setDepartmentFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
              }
              className="text-xs font-medium bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center space-x-1 border-l border-slate-200 pl-3">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'UNASSIGNED', label: '⚠️ Unassigned' },
                { id: 'ASSIGNED', label: 'Assigned' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Search code, subject, cohort..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-300 text-slate-800 rounded-lg pl-8 pr-3 py-1.5 focus:ring-1 focus:ring-indigo-500"
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

      {/* MODE 1: FACULTY WORKBENCH */}
      {viewMode === 'WORKBENCH' && (
        <div className="space-y-3">
          {/* Box Adjustment & Layout Toolbar */}
          <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Column Width Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mr-1">
                Box Width:
              </span>
              <button
                type="button"
                onClick={() => applyLayoutPreset('BALANCED')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  layoutPreset === 'BALANCED'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
                title="Equal 3-column split (33% / 33% / 34%)"
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => applyLayoutPreset('FOCUS_FACULTY')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  layoutPreset === 'FOCUS_FACULTY'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
                title="Wider faculty roster column (45%)"
              >
                Wide Faculty
              </button>
              <button
                type="button"
                onClick={() => applyLayoutPreset('FOCUS_STAGED')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  layoutPreset === 'FOCUS_STAGED'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
                title="Wider assigned load workbench column (52%)"
              >
                Wide Assigned
              </button>
              <button
                type="button"
                onClick={() => applyLayoutPreset('FOCUS_AVAILABLE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  layoutPreset === 'FOCUS_AVAILABLE'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
                title="Wider available curriculum subjects catalog (48%)"
              >
                Wide Available
              </button>
              <button
                type="button"
                onClick={() => setShowSliders(!showSliders)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  showSliders || layoutPreset === 'CUSTOM'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
                title="Adjust box widths with custom percentage sliders"
              >
                <span>Custom Sliders</span>
                <span className="text-[10px]">{showSliders ? '▲' : '▼'}</span>
              </button>
            </div>

            {/* View Sizing & Density */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Box Height Control */}
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-600 text-[11px]">Height:</span>
                <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setHeightMode('standard')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      heightMode === 'standard' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    650px
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeightMode('tall')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      heightMode === 'tall' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    850px
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeightMode('fit')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      heightMode === 'fit' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Fit to full viewport height"
                  >
                    Fit Screen
                  </button>
                </div>
              </div>

              {/* Card Density */}
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-600 text-[11px]">Density:</span>
                <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCardDensity('normal')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      cardDensity === 'normal' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardDensity('compact')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                      cardDensity === 'compact' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Compact cards to see more courses without scrolling"
                  >
                    Compact
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Sliders Drawer */}
          {showSliders && (
            <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Faculty Roster Width:</span>
                  <span className="text-indigo-600 font-bold">{facultyRatio}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="55"
                  value={facultyRatio}
                  onChange={(e) => {
                    setLayoutPreset('CUSTOM');
                    setFacultyRatio(Number(e.target.value));
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Assigned Load Width:</span>
                  <span className="text-indigo-600 font-bold">{stagedRatio}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="65"
                  value={stagedRatio}
                  onChange={(e) => {
                    setLayoutPreset('CUSTOM');
                    setStagedRatio(Number(e.target.value));
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Available Cohorts Width:</span>
                  <span className="text-indigo-600 font-bold">{availableRatio}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="65"
                  value={availableRatio}
                  onChange={(e) => {
                    setLayoutPreset('CUSTOM');
                    setAvailableRatio(Number(e.target.value));
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 3-Column Resizable Boxes Container */}
          <div className="flex flex-col lg:flex-row gap-4 transition-all">
            {/* Box 1: Searchable Faculty Roster with Workload Meters */}
            <div
              style={{ flex: `${facultyRatio} ${facultyRatio} 0%`, height: containerHeight }}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all min-w-[240px]"
            >
              <div className="mb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Select Faculty Member
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Inspect and balance teaching loads
                </p>
                <div className="mt-2 relative">
                  <input
                    type="text"
                    placeholder="Filter faculty..."
                    value={facultySearch}
                    onChange={(e) => setFacultySearch(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white"
                  />
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto pr-1 custom-scrollbar ${cardDensity === 'compact' ? 'space-y-1' : 'space-y-1.5'}`}>
                {filteredFacultyList.map((inst) => {
                  const isSelected = inst.id.toString() === selectedInstructorId;
                  const load = instructorLoads.get(inst.id) || { units: 0, count: 0, hours: 0 };

                  const maxHours = inst.max_hours_per_week || 30;
                  const isOverload = load.hours > maxHours || load.units > 21;
                  const isOptimal = (load.hours >= 18 && load.hours <= maxHours) || (load.units >= 15 && load.units <= 21);

                  let loadColor = 'bg-slate-100 text-slate-600 border-slate-200';
                  if (isOverload) {
                    loadColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  } else if (isOptimal) {
                    loadColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  } else if (load.hours > 0 || load.units > 0) {
                    loadColor = 'bg-amber-50 text-amber-700 border-amber-200';
                  }

                  return (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => setSelectedInstructorId(inst.id.toString())}
                      className={`w-full text-left rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        cardDensity === 'compact' ? 'p-2' : 'p-3'
                      } ${
                        isSelected
                          ? 'bg-indigo-50/60 border-indigo-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {inst.first_name} {inst.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block truncate">
                          @{inst.username}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${loadColor}`}>
                          {load.hours.toFixed(1)} / {maxHours} hrs/wk
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                          {load.units} Units &bull; {load.count} {load.count === 1 ? 'course' : 'courses'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Box 2: Staged Assigned Courses */}
            <div
              style={{ flex: `${stagedRatio} ${stagedRatio} 0%`, height: containerHeight }}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all min-w-[240px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToStaged}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Assigned Teaching Load
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {currentInstructor
                      ? `${currentInstructor.first_name} ${currentInstructor.last_name}`
                      : 'No instructor selected'}
                  </span>
                </div>

                {currentInstructor && (
                  <button
                    type="button"
                    onClick={handleSaveWorkbench}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>

              {/* Selected Faculty Context Card */}
              {currentInstructor && (() => {
                const maxH = currentInstructor.max_hours_per_week || 30;
                const stagedHours = stagedWorkbenchSubjects.reduce(
                  (sum, ss) => sum + (ss.course?.has_lab ? 5 : Number(ss.course?.credits) || 3),
                  0
                );
                const stagedUnits = stagedWorkbenchSubjects.reduce(
                  (sum, ss) => sum + (Number(ss.course?.credits) || 0),
                  0
                );
                const isOverLimit = stagedHours > maxH;

                return (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-3 text-xs space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Availability:</span>
                        <span className="font-semibold text-slate-800">
                          {currentInstructor.available_days || 'MON-SAT'} &bull;{' '}
                          {currentInstructor.available_start_time
                            ? `${currentInstructor.available_start_time.substring(0, 5)} - ${currentInstructor.available_end_time?.substring(0, 5)}`
                            : 'All Day'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Weekly Limit:</span>
                        <span className="font-bold text-indigo-700">
                          {maxH} hrs/week
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] font-medium text-slate-600">Staged Load:</span>
                      <span className={`text-xs font-bold ${isOverLimit ? 'text-rose-600' : 'text-slate-900'}`}>
                        {stagedHours.toFixed(1)} / {maxH} hrs/wk ({stagedUnits} Units)
                      </span>
                    </div>

                    {isOverLimit && (
                      <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] font-semibold">
                        Staged hours exceed configured weekly limit of {maxH} hrs/week.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Assigned List */}
              <div className={`flex-1 overflow-y-auto pr-1 custom-scrollbar border-2 border-dashed border-slate-200 rounded-lg p-2.5 bg-slate-50/50 ${cardDensity === 'compact' ? 'space-y-1.5' : 'space-y-2'}`}>
                {!selectedInstructorId ? (
                  <div className="h-full flex items-center justify-center text-center p-6 text-slate-400 text-xs">
                    Please select an instructor from the left roster to view and manage their assignments.
                  </div>
                ) : stagedWorkbenchSubjects.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
                    <p className="font-semibold text-slate-600">No courses currently assigned</p>
                    <p className="text-[11px] mt-1">Click "+ Assign" on any available subject on the right, or drag them here.</p>
                  </div>
                ) : (
                  stagedWorkbenchSubjects.map((ss) => (
                    <div
                      key={ss.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ss.id)}
                      className={`bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex items-center justify-between group ${
                        cardDensity === 'compact' ? 'p-2' : 'p-3'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className={`rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 ${cardDensity === 'compact' ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'}`}>
                            {ss.course?.code}
                          </span>
                          <span className={`font-bold text-slate-900 truncate ${cardDensity === 'compact' ? 'text-[11px]' : 'text-xs'}`}>
                            {ss.course?.title || ss.course?.name}
                          </span>
                        </div>
                        <div className={`text-slate-500 flex items-center space-x-2 ${cardDensity === 'compact' ? 'text-[10px] mt-0.5' : 'text-[11px] mt-1'}`}>
                          <span className="font-semibold text-slate-700 truncate">
                            Cohort: {ss.section?.department?.code} {ss.section?.year_level}{ss.section?.name || 'A'}
                          </span>
                          <span>&bull;</span>
                          <span className="font-semibold text-indigo-700 shrink-0">
                            {ss.course?.has_lab ? '5.0 hrs/wk' : '3.0 hrs/wk'}
                          </span>
                          <span>&bull;</span>
                          <span className="shrink-0">{ss.course?.credits || 3} Units</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveOne(ss.id)}
                        className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition cursor-pointer shrink-0"
                        title="Remove course assignment"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Box 3: Available / Unassigned Curriculum Sections */}
            <div
              style={{ flex: `${availableRatio} ${availableRatio} 0%`, height: containerHeight }}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all min-w-[240px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropToAvailable}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Available Subject Cohorts
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    {availableWorkbenchSubjects.length} available to assign
                  </span>
                </div>
              </div>

              {/* Available List */}
              <div className={`flex-1 overflow-y-auto pr-1 custom-scrollbar border-2 border-dashed border-slate-200 rounded-lg p-2.5 bg-slate-50/50 ${cardDensity === 'compact' ? 'space-y-1.5' : 'space-y-2'}`}>
                {availableWorkbenchSubjects.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-6 text-slate-400 text-xs">
                    No curriculum subjects match the current filter criteria.
                  </div>
                ) : (
                  availableWorkbenchSubjects.map((ss) => (
                    <div
                      key={ss.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ss.id)}
                      className={`bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex items-center justify-between group ${
                        cardDensity === 'compact' ? 'p-2' : 'p-3'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className={`rounded font-bold bg-slate-100 text-slate-800 border border-slate-200 ${cardDensity === 'compact' ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'}`}>
                            {ss.course?.code}
                          </span>
                          <span className={`font-bold text-slate-900 truncate ${cardDensity === 'compact' ? 'text-[11px]' : 'text-xs'}`}>
                            {ss.course?.title || ss.course?.name}
                          </span>
                        </div>
                        <div className={`text-slate-500 flex items-center space-x-2 ${cardDensity === 'compact' ? 'text-[10px] mt-0.5' : 'text-[11px] mt-1'}`}>
                          <span className="font-semibold text-slate-700 truncate">
                            Cohort: {ss.section?.department?.code} {ss.section?.year_level}{ss.section?.name || 'A'}
                          </span>
                          <span>&bull;</span>
                          <span className="font-semibold text-indigo-700 shrink-0">
                            {ss.course?.has_lab ? '5.0 hrs/wk' : '3.0 hrs/wk'}
                          </span>
                          <span>&bull;</span>
                          <span className="shrink-0">{ss.course?.credits || 3} Units</span>
                          <span>&bull;</span>
                          <span className="text-amber-700 font-semibold truncate shrink-0">
                            {ss.professor ? `${ss.professor.last_name} (Unstaged)` : 'TBA'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAssignOne(ss.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition cursor-pointer shrink-0"
                        title="Assign to selected faculty"
                      >
                        + Assign
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: CURRICULUM MATRIX TABLE */}
      {viewMode === 'MATRIX' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Subject & Title
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Student Cohort
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Department & Term
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Units / Type
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Schedule Status
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Assigned Faculty Member
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredSectionSubjects.map((ss) => {
                  const subjectSlots = scheduleSlots.filter(
                    (slot) => slot.section_subject?.id === ss.id
                  );
                  const isScheduled = subjectSlots.length > 0;
                  const isUpdating = updatingSubjectId === ss.id;

                  return (
                    <tr key={ss.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Course Code & Name */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {ss.course?.code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[220px]">
                            {ss.course?.title || ss.course?.name}
                          </span>
                        </div>
                      </td>

                      {/* Cohort Section */}
                      <td className="px-6 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-800">
                        {ss.section?.department?.code} {ss.section?.year_level}{ss.section?.name || 'A'}
                        <span className="text-slate-400 font-normal ml-1">
                          (Yr {ss.section?.year_level})
                        </span>
                      </td>

                      {/* Department & Term */}
                      <td className="px-6 py-3.5 whitespace-nowrap text-xs text-slate-600">
                        <span>{ss.section?.department?.name || 'N/A'}</span>
                        <span className="text-slate-400 block text-[11px]">
                          {ss.section?.term?.name || 'Term'}
                        </span>
                      </td>

                      {/* Units & Component */}
                      <td className="px-6 py-3.5 whitespace-nowrap text-xs">
                        <span className="font-bold text-slate-900">{ss.course?.credits || 3} Units</span>
                        <span className="text-indigo-700 font-semibold block text-[11px]">
                          {ss.course?.has_lab ? '5.0 hrs/wk (Lab+Lec)' : '3.0 hrs/wk'}
                        </span>
                      </td>

                      {/* Schedule Status */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {isScheduled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Scheduled ({subjectSlots.length})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Unscheduled
                          </span>
                        )}
                      </td>

                      {/* Inline Instructor Select Dropdown */}
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <select
                            disabled={isUpdating}
                            value={ss.professor?.id || ''}
                            onChange={(e) => handleMatrixDirectAssign(ss.id, e.target.value)}
                            className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer ${
                              ss.professor
                                ? 'bg-white text-slate-800 border-slate-300 focus:border-indigo-500'
                                : 'bg-amber-50/60 text-amber-800 border-amber-300 focus:border-amber-500 font-bold'
                            }`}
                          >
                            <option value="">-- Unassigned (TBA) --</option>
                            {instructors.map((inst) => {
                              const load = instructorLoads.get(inst.id);
                              const maxH = inst.max_hours_per_week || 30;
                              return (
                                <option key={inst.id} value={inst.id}>
                                  {inst.first_name} {inst.last_name} ({load?.hours?.toFixed(0) || 0}/{maxH}h • {load?.units || 0}u)
                                </option>
                              );
                            })}
                          </select>
                          {isUpdating && (
                            <span className="text-[10px] text-indigo-600 animate-pulse font-bold">
                              Saving...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredSectionSubjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-500">
                      No curriculum sections found matching the current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

