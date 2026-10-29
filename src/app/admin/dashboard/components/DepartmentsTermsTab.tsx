"use client";

import React, { useState, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import DepartmentModal from './DepartmentModal';
import TermModal from './TermModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import DepartmentDetailDrawer from './DepartmentDetailDrawer';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Term {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

interface Course {
  id: number;
  code: string;
  name: string;
  units: number;
  has_lab: boolean;
  department?: { id: number; code: string; name: string };
  department_id?: number;
}

interface Section {
  id: number;
  name: string;
  year_level: number;
  department?: { id: number; code: string; name: string };
  term?: { id: number; name: string };
}

interface DepartmentsTermsTabProps {
  departments: Department[];
  terms: Term[];
  courses: Course[];
  sections: Section[];
  fetchData: () => Promise<void> | void;
  setActiveTab?: (tabId: string) => void;
  setCalendarViewType?: (viewType: string) => void;
  setSelectedCalendarId?: (id: string) => void;
}

// Color palette options for department icons
const DEPT_COLORS = [
  { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', dot: 'bg-violet-500' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-500' },
  { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', dot: 'bg-sky-500' },
  { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-500' },
  { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', dot: 'bg-teal-500' },
];

export default function DepartmentsTermsTab({
  departments,
  terms,
  courses,
  sections,
  fetchData,
  setActiveTab,
  setCalendarViewType,
  setSelectedCalendarId,
}: DepartmentsTermsTabProps) {
  // Search & Filter State
  const [deptSearch, setDeptSearch] = useState('');
  const [termFilter, setTermFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'CONCLUDED'>('ALL');

  // Modal & Drawer State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptToEdit, setDeptToEdit] = useState<Department | null>(null);

  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [termToEdit, setTermToEdit] = useState<Term | null>(null);

  const [selectedDeptForDrawer, setSelectedDeptForDrawer] = useState<Department | null>(null);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    itemType: 'Department' | 'Term';
    item: any | null;
    dependencyCount?: { courses?: number; sections?: number };
    title: string;
    itemName: string;
  }>({
    isOpen: false,
    itemType: 'Department',
    item: null,
    title: '',
    itemName: '',
  });

  const [isDeleting, setIsDeleting] = useState(false);

  // Date intelligence for terms
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [togglingTermId, setTogglingTermId] = useState<number | null>(null);

  const getTermStatus = (term: Term) => {
    // If explicitly marked active in database:
    if (term.is_active) {
      let progress = 50;
      if (term.start_date && term.end_date) {
        const start = new Date(term.start_date);
        const end = new Date(term.end_date);
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = today.getTime() - start.getTime();
        progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
      }
      return {
        status: 'ACTIVE',
        label: 'Active (Current)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 font-black',
        progress,
      };
    }

    if (!term.start_date || !term.end_date) return { status: 'UNKNOWN', label: 'Unset', badgeClass: 'bg-slate-100 text-slate-600', progress: 0 };

    const start = new Date(term.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(term.end_date);
    end.setHours(23, 59, 59, 999);

    if (today < start) {
      const diffTime = start.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        status: 'UPCOMING',
        label: `Starts in ${diffDays}d`,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        progress: 0,
      };
    } else {
      return {
        status: 'CONCLUDED',
        label: 'Inactive',
        badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
        progress: 100,
      };
    }
  };

  // Active Term computation (prioritizes explicitly active term)
  const activeTerm = useMemo(() => {
    return terms.find(t => t.is_active) || terms.find(t => getTermStatus(t).status === 'ACTIVE') || null;
  }, [terms, today]);

  // Toggle active semester on-demand
  const handleToggleTermActive = async (term: Term) => {
    setTogglingTermId(term.id);
    const willActivate = !term.is_active;
    try {
      if (willActivate) {
        await axios.post(`http://localhost:8000/api/terms/${term.id}/activate/`);
        toast.success(`"${term.name}" is now the active semester!`);
      } else {
        await axios.post(`http://localhost:8000/api/terms/${term.id}/deactivate/`);
        toast.success(`"${term.name}" has been deactivated.`);
      }
      await fetchData();
    } catch (err: any) {
      console.error('Failed to toggle semester active state:', err);
      toast.error(err.response?.data?.detail || 'Failed to update semester status.');
    } finally {
      setTogglingTermId(null);
    }
  };

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const q = deptSearch.toLowerCase().trim();
    return departments.filter(
      d => d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
    );
  }, [departments, deptSearch]);

  // Filtered Terms
  const filteredTerms = useMemo(() => {
    if (termFilter === 'ALL') return terms;
    return terms.filter(t => getTermStatus(t).status === termFilter);
  }, [terms, termFilter, today]);

  // Delete Action Triggers
  const handleOpenDeleteDept = (dept: Department) => {
    const linkedCourses = courses.filter(
      c => c.department?.id === dept.id || c.department_id === dept.id
    ).length;
    const linkedSections = sections.filter(
      s => s.department?.id === dept.id
    ).length;

    setDeleteModal({
      isOpen: true,
      itemType: 'Department',
      item: dept,
      title: 'Delete Department',
      itemName: `${dept.code} - ${dept.name}`,
      dependencyCount: { courses: linkedCourses, sections: linkedSections },
    });
  };

  const handleOpenDeleteTerm = (term: Term) => {
    const linkedSections = sections.filter(
      s => s.term?.id === term.id
    ).length;

    setDeleteModal({
      isOpen: true,
      itemType: 'Term',
      item: term,
      title: 'Delete Academic Term',
      itemName: term.name,
      dependencyCount: { sections: linkedSections },
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.item) return;
    setIsDeleting(true);

    try {
      if (deleteModal.itemType === 'Department') {
        await axios.delete(`http://localhost:8000/api/departments/${deleteModal.item.id}/`);
        toast.success(`Department "${deleteModal.item.code}" deleted successfully.`);
        if (selectedDeptForDrawer?.id === deleteModal.item.id) {
          setSelectedDeptForDrawer(null);
        }
      } else {
        await axios.delete(`http://localhost:8000/api/terms/${deleteModal.item.id}/`);
        toast.success(`Academic term "${deleteModal.item.name}" deleted successfully.`);
      }

      await fetchData();
      setDeleteModal(prev => ({ ...prev, isOpen: false, item: null }));
    } catch (err: any) {
      console.error('Delete error:', err);
      const detail = err.response?.data?.detail || 'Failed to delete record due to server constraint.';
      toast.error(detail);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleJumpToCalendar = (sectionId: number) => {
    if (setActiveTab && setCalendarViewType && setSelectedCalendarId) {
      setCalendarViewType('section');
      setSelectedCalendarId(sectionId.toString());
      setActiveTab('calendar');
      toast.success('Navigated to section schedule in Calendar');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 1. TOP METRICS SUMMARY STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Departments */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Departments</span>
          <div className="text-2xl font-bold text-slate-900 leading-none mt-2">
            {departments.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block font-medium">Academic divisions</span>
        </div>

        {/* Current Active Term */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Active Term</span>
          <div className="text-base font-bold text-slate-900 truncate mt-2" title={activeTerm ? activeTerm.name : 'None active'}>
            {activeTerm ? activeTerm.name : <span className="text-slate-400 font-normal">No active term</span>}
          </div>
          <span className="text-[11px] text-emerald-600 mt-1 block font-semibold">
            {activeTerm ? 'Operational' : 'Setup required'}
          </span>
        </div>

        {/* Total Courses Catalogued */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Curriculum Courses</span>
          <div className="text-2xl font-bold text-slate-900 leading-none mt-2">
            {courses.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block font-medium">Subjects in catalog</span>
        </div>

        {/* Total Sections Registered */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Cohort Sections</span>
          <div className="text-2xl font-bold text-slate-900 leading-none mt-2">
            {sections.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block font-medium">Active student groups</span>
        </div>
      </div>

      {/* 2. DUAL MAIN CONTENT GRID (DEPARTMENTS & TERMS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* --- LEFT: DEPARTMENTS PANEL --- */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col min-h-[580px]">
          {/* Header */}
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Departments</h3>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700">
                  {departments.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Academic divisions & collegiate faculties</p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                setDeptToEdit(null);
                setIsDeptModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              Add Department
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <div className="relative">
              <input
                type="text"
                value={deptSearch}
                onChange={e => setDeptSearch(e.target.value)}
                placeholder="Filter departments by code or name..."
                className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors placeholder:text-slate-400"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {deptSearch && (
                <button
                  type="button"
                  onClick={() => setDeptSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Department Cards List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[500px]">
            {filteredDepartments.map((dept) => {
              const deptCoursesCount = courses.filter(
                c => c.department?.id === dept.id || c.department_id === dept.id
              ).length;
              const deptSectionsCount = sections.filter(
                s => s.department?.id === dept.id
              ).length;

              return (
                <div
                  key={dept.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 transition-colors flex items-center justify-between"
                >
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pr-3"
                    onClick={() => setSelectedDeptForDrawer(dept)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                      {dept.code}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">
                        {dept.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Code: <strong className="text-slate-700">{dept.code}</strong>
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {deptCoursesCount} Courses
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {deptSectionsCount} Sections
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedDeptForDrawer(dept)}
                      title="Inspect Department"
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeptToEdit(dept);
                        setIsDeptModalOpen(true);
                      }}
                      title="Edit Department"
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteDept(dept)}
                      title="Delete Department"
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredDepartments.length === 0 && departments.length > 0 && (
              <div className="py-10 text-center">
                <p className="text-xs font-semibold text-slate-500">No departments match "{deptSearch}"</p>
                <button
                  type="button"
                  onClick={() => setDeptSearch('')}
                  className="mt-1 text-xs font-bold text-indigo-600 hover:underline"
                >
                  Clear search query
                </button>
              </div>
            )}

            {departments.length === 0 && (
              <div className="py-12 text-center">
                <h4 className="text-sm font-bold text-slate-800">No departments catalogued</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Create academic departments to group courses and cohorts together.</p>
                <button
                  type="button"
                  onClick={() => {
                    setDeptToEdit(null);
                    setIsDeptModalOpen(true);
                  }}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
                >
                  Create First Department
                </button>
              </div>
            )}
          </div>
        </div>

        {/* --- RIGHT: ACADEMIC TERMS PANEL --- */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col min-h-[580px]">
          {/* Header */}
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Academic Terms</h3>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700">
                  {terms.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Semesters & scheduling timelines</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setTermToEdit(null);
                setIsTermModalOpen(true);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              Add Term
            </button>
          </div>

          {/* Term Status Filter Tabs */}
          <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex items-center gap-1.5 overflow-x-auto">
            {(['ALL', 'ACTIVE', 'UPCOMING', 'CONCLUDED'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setTermFilter(tab)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                  termFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab === 'ALL' ? 'All Terms' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Academic Terms List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[500px]">
            {filteredTerms.map(term => {
              const statusInfo = getTermStatus(term);
              const termSectionsCount = sections.filter(s => s.term?.id === term.id).length;

              return (
                <div
                  key={term.id}
                  className={`p-3.5 rounded-lg border transition-colors flex flex-col justify-between gap-2.5 ${
                    term.is_active
                      ? 'border-indigo-300 bg-indigo-50/20 shadow-2xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{term.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                        <span>{term.start_date}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span>{term.end_date}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Activate / Deactivate Toggle Button */}
                      <button
                        type="button"
                        disabled={togglingTermId === term.id}
                        onClick={() => handleToggleTermActive(term)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                          term.is_active
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                        }`}
                        title={term.is_active ? 'Deactivate this semester' : 'Activate and set as primary operational semester'}
                      >
                        {togglingTermId === term.id ? (
                          <span className="inline-block animate-spin">&#9696;</span>
                        ) : term.is_active ? (
                          'Deactivate'
                        ) : (
                          'Set Active'
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTermToEdit(term);
                          setIsTermModalOpen(true);
                        }}
                        title="Edit Term"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteTerm(term)}
                        title="Delete Term"
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Active Progress bar or Sections enrolled */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">
                      Sections scheduled: <strong className="text-slate-800">{termSectionsCount}</strong>
                    </span>

                    {statusInfo.status === 'ACTIVE' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-700">
                          {statusInfo.progress}% elapsed
                        </span>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-600 h-1.5 rounded-full" 
                            style={{ width: `${statusInfo.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredTerms.length === 0 && terms.length > 0 && (
              <div className="py-10 text-center">
                <p className="text-xs font-semibold text-slate-500">No {termFilter.toLowerCase()} terms found.</p>
                <button
                  type="button"
                  onClick={() => setTermFilter('ALL')}
                  className="mt-1 text-xs font-bold text-indigo-600 hover:underline"
                >
                  View all terms
                </button>
              </div>
            )}

            {terms.length === 0 && (
              <div className="py-12 text-center">
                <h4 className="text-sm font-bold text-slate-800">No academic terms registered</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Add semesters with start and end dates to enable scheduling timelines.</p>
                <button
                  type="button"
                  onClick={() => {
                    setTermToEdit(null);
                    setIsTermModalOpen(true);
                  }}
                  className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
                >
                  Create First Term
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODALS & DRAWERS */}
      <DepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => {
          setIsDeptModalOpen(false);
          setDeptToEdit(null);
        }}
        onSuccess={fetchData}
        departmentToEdit={deptToEdit}
      />

      <TermModal
        isOpen={isTermModalOpen}
        onClose={() => {
          setIsTermModalOpen(false);
          setTermToEdit(null);
        }}
        onSuccess={fetchData}
        termToEdit={termToEdit}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false, item: null }))}
        onConfirm={handleConfirmDelete}
        title={deleteModal.title}
        itemName={deleteModal.itemName}
        itemType={deleteModal.itemType}
        dependencyCount={deleteModal.dependencyCount}
        loading={isDeleting}
      />

      <DepartmentDetailDrawer
        isOpen={Boolean(selectedDeptForDrawer)}
        onClose={() => setSelectedDeptForDrawer(null)}
        department={selectedDeptForDrawer}
        courses={courses}
        sections={sections}
        onEdit={(dept) => {
          setSelectedDeptForDrawer(null);
          setDeptToEdit(dept);
          setIsDeptModalOpen(true);
        }}
        onDelete={(dept) => {
          setSelectedDeptForDrawer(null);
          handleOpenDeleteDept(dept);
        }}
        onViewCalendar={handleJumpToCalendar}
      />
    </div>
  );
}

