"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';
import CourseAssignmentsTab from '../dashboard/components/CourseAssignmentsTab';

export default function StandaloneCourseAssignmentsPage() {
  const [instructors, setInstructors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionSubjects, setSectionSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/dashboard-data/');
      const data = res.data;
      setInstructors(data.instructors || []);
      setCourses(data.courses || []);
      setSections(data.sections || []);
      setSectionSubjects(data.sectionSubjects || []);
      setDepartments(data.departments || []);
      setTerms(data.terms || []);
      setRooms(data.rooms || []);
      setScheduleSlots(data.scheduleSlots || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Toaster position="top-right" />

      {/* Top Fullscreen Institutional Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3.5 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/dashboard?tab=assignments"
            className="inline-flex items-center text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="h-5 w-px bg-slate-700" />
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              Course Assignments — Expanded Fullscreen Workbench
            </h1>
            <p className="text-[11px] text-slate-400">
              Institutional academic workload distribution and subject allocation matrix
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            {instructors.length} Instructors &bull; {sectionSubjects.length} Section Subjects
          </span>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Refresh Data"
          >
            {loading ? 'Refreshing...' : '↻ Refresh Data'}
          </button>
        </div>
      </header>

      {/* Fullscreen Main Content Area */}
      <main className="flex-1 w-full p-4 lg:p-6 overflow-x-hidden">
        {loading ? (
          <div className="h-[70vh] flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-slate-500">Loading academic data...</span>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
            <CourseAssignmentsTab
              instructors={instructors}
              courses={courses}
              sections={sections}
              sectionSubjects={sectionSubjects}
              scheduleSlots={scheduleSlots}
              departments={departments}
              terms={terms}
              fetchData={fetchData}
              isStandalone={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}

