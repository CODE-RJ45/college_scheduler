"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import axios from 'axios';
import toast from 'react-hot-toast';
import SectionModal from './SectionModal';
import SectionDetailDrawer from './SectionDetailDrawer';

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

interface Section {
  id: number;
  name: string | null;
  year_level: number;
  capacity: number;
  department: Department;
  term: Term;
}

interface SectionsTabProps {
  sections: Section[];
  departments: Department[];
  terms: Term[];
  sectionSubjects: any[];
  scheduleSlots: any[];
  fetchData: () => void;
  setActiveTab: (tab: string) => void;
  setCalendarViewType: (view: string) => void;
  setSelectedCalendarId: (id: string) => void;
}

export default function SectionsTab({
  sections,
  departments,
  terms,
  sectionSubjects,
  scheduleSlots,
  fetchData,
  setActiveTab,
  setCalendarViewType,
  setSelectedCalendarId,
}: SectionsTabProps) {
  // Find active term
  const activeTerm = useMemo(() => terms.find((t) => t.is_active) || null, [terms]);

  // Filters State
  const [termFilter, setTermFilter] = useState<'ACTIVE' | number | 'ALL'>('ACTIVE');
  const [departmentFilter, setDepartmentFilter] = useState<number | 'ALL'>('ALL');
  const [yearLevelFilter, setYearLevelFilter] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawer State
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [sectionToEdit, setSectionToEdit] = useState<Section | null>(null);
  const [selectedSectionForDrawer, setSelectedSectionForDrawer] = useState<Section | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compute filtered sections
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      // Term filter
      if (termFilter === 'ACTIVE') {
        if (activeTerm && s.term?.id !== activeTerm.id) return false;
      } else if (termFilter !== 'ALL') {
        if (s.term?.id !== termFilter) return false;
      }

      // Department filter
      if (departmentFilter !== 'ALL') {
        if (s.department?.id !== departmentFilter) return false;
      }

      // Year level filter
      if (yearLevelFilter !== 'ALL') {
        if (s.year_level !== yearLevelFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const fullName = `${s.department?.code || ''} ${s.year_level}${s.name || ''}`.toLowerCase();
        const secName = (s.name || '').toLowerCase();
        const depName = (s.department?.name || '').toLowerCase();
        if (!fullName.includes(query) && !secName.includes(query) && !depName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [sections, termFilter, activeTerm, departmentFilter, yearLevelFilter, searchQuery]);

  // Aggregate metrics
  const totalCapacity = useMemo(() => {
    return filteredSections.reduce((sum, s) => sum + (s.capacity || 0), 0);
  }, [filteredSections]);

  // Calculate overall scheduling progress for filtered sections
  const schedulingMetrics = useMemo(() => {
    const filteredSectionIds = new Set(filteredSections.map((s) => s.id));
    const relevantAssigned = sectionSubjects.filter((ss) =>
      filteredSectionIds.has(ss.section?.id)
    );
    const scheduled = relevantAssigned.filter((ss) =>
      scheduleSlots.some((slot) => slot.section_subject?.id === ss.id)
    ).length;

    const total = relevantAssigned.length;
    const percent = total > 0 ? Math.round((scheduled / total) * 100) : 0;
    return { scheduled, total, percent };
  }, [filteredSections, sectionSubjects, scheduleSlots]);

  // Group filtered sections by year level
  const groupedByYear = useMemo(() => {
    const groups: Record<number, Section[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    filteredSections.forEach((s) => {
      const y = s.year_level || 1;
      if (!groups[y]) groups[y] = [];
      groups[y].push(s);
    });
    // Sort sections within each year by department code and section name
    Object.keys(groups).forEach((yKey) => {
      const y = Number(yKey);
      groups[y].sort((a, b) => {
        const depA = a.department?.code || '';
        const depB = b.department?.code || '';
        if (depA !== depB) return depA.localeCompare(depB);
        return (a.name || '').localeCompare(b.name || '');
      });
    });
    return groups;
  }, [filteredSections]);

  // Section-specific scheduling helper
  const getSectionSchedulingProgress = (sectionId: number) => {
    const assigned = sectionSubjects.filter((ss) => ss.section?.id === sectionId);
    const scheduled = assigned.filter((ss) =>
      scheduleSlots.some((slot) => slot.section_subject?.id === ss.id)
    ).length;
    const total = assigned.length;
    const percent = total > 0 ? Math.round((scheduled / total) * 100) : 0;
    return { scheduled, total, percent };
  };

  // Handlers
  const handleOpenAddModal = () => {
    setSectionToEdit(null);
    setIsSectionModalOpen(true);
  };

  const handleOpenEditModal = (section: Section) => {
    setSectionToEdit(section);
    setIsSectionModalOpen(true);
  };

  const handleCalendarJump = (sectionId: number) => {
    setActiveTab('calendar');
    setCalendarViewType('section');
    setSelectedCalendarId(sectionId.toString());
  };

  const handleConfirmDelete = async () => {
    if (!sectionToDelete) return;
    setIsDeleting(true);
    try {
      await axios.delete(`http://localhost:8000/api/sections/${sectionToDelete.id}/`);
      toast.success(
        `Section ${sectionToDelete.department?.code} ${sectionToDelete.year_level}${sectionToDelete.name} deleted successfully.`
      );
      if (selectedSectionForDrawer?.id === sectionToDelete.id) {
        setSelectedSectionForDrawer(null);
      }
      setSectionToDelete(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data?.detail || 'Failed to delete section. Please verify constraints.'
      );
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
            <h2 className="text-xl font-bold text-slate-900">Cohort Sections</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {filteredSections.length} {filteredSections.length === 1 ? 'Cohort' : 'Cohorts'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Institutional student cohorts organized by year level and academic term.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/admin/sections/new"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
          >
            <span>Bulk Generator</span>
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Section</span>
          </button>
        </div>
      </div>

      {/* Institutional Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Filtered Cohorts</span>
            <span className="text-xs font-bold text-indigo-600">{filteredSections.length} Sections</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{filteredSections.length}</span>
            <span className="text-xs text-slate-400">of {sections.length} Total</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Seat Capacity</span>
            <span className="text-xs font-bold text-slate-700">Students</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{totalCapacity.toLocaleString()}</span>
            <span className="text-xs text-slate-400">Available Seats</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Timetable Progress</span>
            <span className="text-xs font-bold text-indigo-600">
              {schedulingMetrics.percent}%
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-bold text-slate-900">
                {schedulingMetrics.scheduled} / {schedulingMetrics.total} Slots
              </span>
              <span className="text-xs text-slate-400">Scheduled</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  schedulingMetrics.percent === 100
                    ? 'bg-emerald-500'
                    : schedulingMetrics.percent > 0
                    ? 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${schedulingMetrics.percent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Term Context</span>
            {activeTerm && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            )}
          </div>
          <div className="mt-2 truncate">
            <span className="text-sm font-bold text-slate-900 block truncate" title={activeTerm?.name || 'No Active Term'}>
              {activeTerm?.name || 'No Active Term Set'}
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">
              {termFilter === 'ACTIVE' ? 'Viewing Active Term Cohorts' : 'Custom Term Filter Applied'}
            </span>
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
                if (val === 'ACTIVE' || val === 'ALL') {
                  setTermFilter(val);
                } else {
                  setTermFilter(Number(val));
                }
              }}
              className="text-xs font-medium bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="ACTIVE">
                Active Term {activeTerm ? `(${activeTerm.name})` : ''}
              </option>
              <option value="ALL">All Academic Terms</option>
              <optgroup label="Specific Terms">
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_active ? '★' : ''}
                  </option>
                ))}
              </optgroup>
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
              className="text-xs font-medium bg-slate-50 border border-slate-300 text-slate-700 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Level Filter Pills */}
          <div className="flex items-center space-x-1 border-l border-slate-200 pl-3">
            <span className="text-xs font-semibold text-slate-600 mr-1.5">Year:</span>
            {(['ALL', 1, 2, 3, 4, 5] as const).map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYearLevelFilter(y)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  yearLevelFilter === y
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {y === 'ALL' ? 'All' : `Y${y}`}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Search cohort or code..."
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

      {/* Year-Level Grouped Panels */}
      <div className="space-y-6">
        {[1, 2, 3, 4, 5].map((year) => {
          const yearSections = groupedByYear[year] || [];
          if (yearLevelFilter !== 'ALL' && yearLevelFilter !== year) return null;
          if (yearSections.length === 0 && (yearLevelFilter === year || searchQuery)) {
            // When filtered to this specific year or searching and none found
            if (yearLevelFilter === year) {
              return (
                <div key={year} className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm mx-auto mb-2">
                    Y{year}
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No Year {year} Cohorts</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    No sections registered for Year {year} matching the current filters.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="mt-4 inline-flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition"
                  >
                    + Create Year {year} Section
                  </button>
                </div>
              );
            }
            return null;
          }

          if (yearSections.length === 0) return null;

          // Year level aggregate stats
          const yearCapacity = yearSections.reduce((sum, s) => sum + (s.capacity || 0), 0);
          const yearSectionIds = new Set(yearSections.map((s) => s.id));
          const yearAssigned = sectionSubjects.filter((ss) => yearSectionIds.has(ss.section?.id));
          const yearScheduled = yearAssigned.filter((ss) =>
            scheduleSlots.some((slot) => slot.section_subject?.id === ss.id)
          ).length;
          const yearPercent = yearAssigned.length > 0
            ? Math.round((yearScheduled / yearAssigned.length) * 100)
            : 0;

          return (
            <div
              key={year}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Year Group Header */}
              <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    Y{year}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Year {year} Student Cohorts
                    </h3>
                    <p className="text-xs text-slate-500">
                      {yearSections.length} {yearSections.length === 1 ? 'section' : 'sections'} &bull; {yearCapacity} total capacity
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Scheduling mini progress */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 font-medium">Timetable:</span>
                    <span className="text-xs font-bold text-slate-800">
                      {yearScheduled}/{yearAssigned.length}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        yearPercent === 100
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : yearPercent > 0
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {yearPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Sections Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Cohort Identifier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Academic Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Academic Term
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Capacity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Timetable Progress
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {yearSections.map((section) => {
                      const prog = getSectionSchedulingProgress(section.id);
                      return (
                        <tr
                          key={section.id}
                          className="hover:bg-slate-50/70 transition-colors group"
                        >
                          {/* Cohort Identifier */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {section.department?.code || 'DEP'} {section.year_level}{section.name || 'A'}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                Sec {section.name || 'A'}
                              </span>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-6 py-3.5 whitespace-nowrap text-xs text-slate-700">
                            <span className="font-semibold">{section.department?.code || 'N/A'}</span>
                            <span className="text-slate-400 ml-1.5 hidden sm:inline">
                              {section.department?.name || ''}
                            </span>
                          </td>

                          {/* Academic Term */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                section.term?.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {section.term?.name || 'N/A'}
                            </span>
                          </td>

                          {/* Seat Capacity */}
                          <td className="px-6 py-3.5 whitespace-nowrap text-xs">
                            <span className="font-bold text-slate-900">{section.capacity}</span>
                            <span className="text-slate-400 ml-1">students</span>
                          </td>

                          {/* Timetable Progress Badge */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  prog.total === 0
                                    ? 'bg-slate-50 text-slate-600 border-slate-200'
                                    : prog.percent === 100
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : prog.percent > 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {prog.scheduled}/{prog.total} Scheduled
                              </span>
                              {prog.total > 0 && (
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {prog.percent}%
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="px-6 py-3.5 whitespace-nowrap text-right text-xs">
                            <div className="flex items-center justify-end space-x-2">
                              {/* Inspect Drawer button */}
                              <button
                                type="button"
                                onClick={() => setSelectedSectionForDrawer(section)}
                                className="px-2.5 py-1 font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                                title="Inspect cohort curriculum and scheduled periods"
                              >
                                Inspect
                              </button>

                              {/* Master Calendar Shortcut */}
                              <button
                                type="button"
                                onClick={() => handleCalendarJump(section.id)}
                                className="px-2.5 py-1 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                                title="Open section timetable on master calendar"
                              >
                                Calendar
                              </button>

                              {/* Edit Modal button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(section)}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                                title="Edit cohort details"
                              >
                                Edit
                              </button>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => setSectionToDelete(section)}
                                className="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                title="Delete cohort section"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">No Cohort Sections Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No sections match the current filter criteria. You can change your active filters or add a new cohort section.
            </p>
            <div className="mt-4 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  setTermFilter('ALL');
                  setDepartmentFilter('ALL');
                  setYearLevelFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                + Add Section
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cohort Detail Drawer */}
      <SectionDetailDrawer
        isOpen={Boolean(selectedSectionForDrawer)}
        onClose={() => setSelectedSectionForDrawer(null)}
        section={selectedSectionForDrawer}
        sectionSubjects={sectionSubjects}
        scheduleSlots={scheduleSlots}
        onEdit={(section) => {
          setSelectedSectionForDrawer(null);
          handleOpenEditModal(section);
        }}
        onDelete={(section) => {
          setSelectedSectionForDrawer(null);
          setSectionToDelete(section);
        }}
        onViewCalendar={handleCalendarJump}
      />

      {/* Add / Edit Section Modal */}
      <SectionModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        onSuccess={() => {
          fetchData();
        }}
        departments={departments}
        terms={terms}
        sectionToEdit={sectionToEdit}
        defaultTermId={activeTerm?.id}
      />

      {/* Delete Confirmation Modal */}
      {sectionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-rose-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Delete Cohort Section</h3>
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="text-rose-200 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">
                Are you sure you want to permanently delete section{' '}
                <span className="font-bold text-slate-900">
                  {sectionToDelete.department?.code} {sectionToDelete.year_level}{sectionToDelete.name}
                </span>{' '}
                ({sectionToDelete.term?.name})?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <span className="font-bold block mb-0.5">Warning:</span>
                This will also remove all scheduled timetable slots, assigned curriculum linkages, and student enrollments associated with this cohort.
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSectionToDelete(null)}
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

