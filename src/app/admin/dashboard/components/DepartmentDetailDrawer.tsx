"use client";

import React from 'react';

interface Department {
  id: number;
  name: string;
  code: string;
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

interface DepartmentDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
  courses: Course[];
  sections: Section[];
  onEdit: (dept: Department) => void;
  onDelete: (dept: Department) => void;
  onViewCalendar?: (sectionId: number) => void;
}

export default function DepartmentDetailDrawer({
  isOpen,
  onClose,
  department,
  courses,
  sections,
  onEdit,
  onDelete,
  onViewCalendar,
}: DepartmentDetailDrawerProps) {
  if (!isOpen || !department) return null;

  const deptCourses = courses.filter(
    c => c.department?.id === department.id || c.department_id === department.id
  );
  const deptSections = sections.filter(
    s => s.department?.id === department.id
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-6 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                {department.code}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(department)}
                  title="Edit Department"
                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(department)}
                  title="Delete Department"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors ml-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <h2 className="text-lg font-bold text-slate-900 leading-snug">{department.name}</h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">Department ID: #{department.id}</p>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Courses</span>
                <span className="text-xl font-bold text-slate-900">{deptCourses.length}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Sections</span>
                <span className="text-xl font-bold text-slate-900">{deptSections.length}</span>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Sections Sublist */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Sections ({deptSections.length})
                </h3>
              </div>
              <div className="space-y-2">
                {deptSections.map(sec => (
                  <div 
                    key={sec.id}
                    className="p-3 bg-slate-50 hover:bg-white rounded-lg border border-slate-200 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Year {sec.year_level} - Sec {sec.name || 'A'}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {sec.term?.name || 'No term assigned'}
                      </div>
                    </div>
                    {onViewCalendar && (
                      <button
                        type="button"
                        onClick={() => onViewCalendar(sec.id)}
                        className="text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 transition-colors"
                      >
                        Schedule &rarr;
                      </button>
                    )}
                  </div>
                ))}
                {deptSections.length === 0 && (
                  <div className="text-xs text-slate-400 italic py-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No sections registered under this department yet.
                  </div>
                )}
              </div>
            </div>

            {/* Courses Sublist */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Assigned Courses ({deptCourses.length})
              </h3>
              <div className="space-y-2">
                {deptCourses.map(course => (
                  <div 
                    key={course.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-800">{course.code}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">{course.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {course.units} Units
                      </span>
                      {course.has_lab && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                          LAB
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {deptCourses.length === 0 && (
                  <div className="text-xs text-slate-400 italic py-3 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No courses registered under this department yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

