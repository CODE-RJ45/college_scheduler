"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import DepartmentsTermsTab from './components/DepartmentsTermsTab';
import CourseModal from './components/CourseModal';
import ImportCoursesModal from './components/ImportCoursesModal';
import SectionsTab from './components/SectionsTab';
import FacultyTab from './components/FacultyTab';
import AnalyticsTab from './components/AnalyticsTab';
import CourseAssignmentsTab from './components/CourseAssignmentsTab';
import MasterCalendarTab from './components/MasterCalendarTab';
import RoomsTab from './components/RoomsTab';
import Footer from '../../components/Footer';

export default function Dashboard() {
  const [activeTab, setActiveTabState] = useState('analytics');

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('admin_dashboard_active_tab', tabId);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tabId);
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        console.error(e);
      }
    }
  };
  
  const [instructors, setInstructors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionSubjects, setSectionSubjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);

  const [calendarViewType, setCalendarViewType] = useState('room'); // 'room', 'instructor', 'section'
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  
  const [isMounted, setIsMounted] = useState(false);

  // --- Courses Semester Filter & Modal State ---
  const [courseSemesterFilter, setCourseSemesterFilter] = useState<'ACTIVE' | 1 | 2 | 'ALL'>('ACTIVE');
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<any | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeletingCourse(true);
    try {
      await axios.delete(`http://localhost:8000/api/courses/${courseToDelete.id}/`);
      toast.success(`Subject "${courseToDelete.code}" deleted successfully.`);
      setCourseToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error('Failed to delete subject.');
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);


  const fetchData = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/dashboard-data/');
      const data = res.data;

      setInstructors(data.instructors);
      setCourses(data.courses);
      setSections(data.sections);
      setSectionSubjects(data.sectionSubjects);
      setDepartments(data.departments);
      setTerms(data.terms);
      setRooms(data.rooms);
      setScheduleSlots(data.scheduleSlots);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const validTabs = ['analytics', 'assignments', 'calendar', 'instructors', 'courses', 'sections', 'rooms', 'depts'];
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const savedTab = localStorage.getItem('admin_dashboard_active_tab');

      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTabState(tabParam);
        localStorage.setItem('admin_dashboard_active_tab', tabParam);
      } else if (savedTab && validTabs.includes(savedTab)) {
        setActiveTabState(savedTab);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', savedTab);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);




  if (!isMounted || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading data...</div>;
  }

  interface NavItem {
    id: string;
    name: string;
    icon: React.ReactNode;
  }

  interface NavGroup {
    category: string;
    items: NavItem[];
  }

  const navGroups: NavGroup[] = [
    {
      category: 'Foundation Setup',
      items: [
        {
          id: 'depts',
          name: 'Departments & Terms',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
        },
        {
          id: 'rooms',
          name: 'Rooms & Facilities',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: 'Academic Registry',
      items: [
        {
          id: 'courses',
          name: 'Subjects Curriculum',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          ),
        },
        {
          id: 'sections',
          name: 'Sections & Cohorts',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
        {
          id: 'instructors',
          name: 'Faculty & Availability',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: 'Timetable & Operations',
      items: [
        {
          id: 'assignments',
          name: 'Course Assignments',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
        {
          id: 'calendar',
          name: 'Master Calendar',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: 'Analytics & Reports',
      items: [
        {
          id: 'analytics',
          name: 'Analytics Dashboard',
          icon: (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
      ],
    },
  ];

  const tabs: NavItem[] = navGroups.flatMap(g => g.items);

  // Helper to map a day string to a specific date in our template week (e.g. Aug 24 2026 is a Monday)
  const mapDayToDate = (day: string) => {
    const dayMap: { [key: string]: number } = {
      'MON': 24, 'TUE': 25, 'WED': 26, 'THU': 27, 'FRI': 28, 'SAT': 29, 'SUN': 30
    };
    return dayMap[day] || 24;
  };

  const handleClearAll = () => {
    setIsClearModalOpen(true);
  };

  const confirmClearAll = async () => {
    setIsClearModalOpen(false);
    try {
      await axios.delete('http://localhost:8000/api/schedule-slots/clear-all/');
      fetchData();
      toast.success('All schedules have been cleared.');
    } catch (err: any) {
      toast.error(`Failed to clear schedules: ${err.message}`);
    }
  };

  const exportCSV = () => {
    let csv = "Section,Subject,Instructor,Room,Day,Start Time,End Time\n";
    scheduleSlots.forEach((slot: any) => {
      const section = `${slot.section_subject?.section?.department?.code} Yr ${slot.section_subject?.section?.year_level} Sec ${slot.section_subject?.section?.name || 'A'}`;
      const subject = slot.section_subject?.course?.code || '';
      const instructor = slot.section_subject?.professor ? `${slot.section_subject.professor.first_name} ${slot.section_subject.professor.last_name}` : 'TBA';
      const room = slot.room ? `${slot.room.room_number}` : 'Asynch';
      const day = slot.day_of_week;
      const start = slot.start_time;
      const end = slot.end_time;
      csv += `"${section}","${subject}","${instructor}","${room}","${day}","${start}","${end}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule_export.csv';
    a.click();
  };

  const exportICS = () => {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//College Scheduler//EN\n";
    scheduleSlots.forEach((slot: any) => {
      const day = mapDayToDate(slot.day_of_week);
      const start = slot.start_time.replace(':', '') + '00';
      const end = slot.end_time.replace(':', '') + '00';
      const dateStr = `202608${day.toString().padStart(2, '0')}T`;
      
      const summary = `${slot.section_subject?.course?.code} - Yr ${slot.section_subject?.section?.year_level} ${slot.section_subject?.section?.name || 'A'}`;
      const location = slot.room?.room_number || '';
      const desc = `Instructor: ${slot.section_subject?.professor?.last_name || 'TBA'}`;
      
      ics += "BEGIN:VEVENT\n";
      ics += `DTSTART:${dateStr}${start}\n`;
      ics += `DTEND:${dateStr}${end}\n`;
      ics += `SUMMARY:${summary}\n`;
      ics += `LOCATION:${location}\n`;
      ics += `DESCRIPTION:${desc}\n`;
      ics += "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schedule.ics';
    a.click();
  };


  // Active Term Semester Number (1 or 2)
  const activeTerm = terms.find((t: any) => t.is_active);
  const activeSemesterNumber = activeTerm
    ? (activeTerm.name.toLowerCase().includes('2nd') || activeTerm.name.toLowerCase().includes('second') ? 2 : 1)
    : 1;

  const effectiveCourseSemester = courseSemesterFilter === 'ACTIVE' 
    ? activeSemesterNumber 
    : courseSemesterFilter;

  const filteredCourses = courses.filter((c: any) => {
    if (effectiveCourseSemester === 'ALL') return true;
    return (c.semester || 1) === effectiveCourseSemester;
  });

  // Group courses by year level for the UI
  const groupedCourses = filteredCourses.reduce((acc: any, course: any) => {
    const year = course.year_level;
    if (!acc[year]) acc[year] = [];
    acc[year].push(course);
    return acc;
  }, {});


  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex shrink-0 border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              CS
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight">College Scheduler</h1>
              <p className="text-[10px] font-semibold text-slate-400">Institutional Administration</p>
            </div>
          </div>
        </div>

        {/* Institutional Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.category} className="space-y-1">
              <div className="px-3 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.category}
                </span>
              </div>

              <div className="space-y-0.5">
                {group.items.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer group ${
                        isActive
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <span
                        className={`mr-2.5 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      >
                        {tab.icon}
                      </span>
                      <span className="truncate">{tab.name}</span>
                    </button>
                  );
                })}
              </div>

              {group.category === 'Timetable & Operations' && (
                <div className="pt-1.5 px-0.5">
                  <Link
                    href="/admin/auto-schedule"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-colors group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Auto-Schedule Engine</span>
                    </div>
                    <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                      Run
                    </span>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900 space-y-2">
          {terms.find(t => t.is_active) && (
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block">Active Term</span>
                <span className="text-xs font-semibold text-slate-200 truncate block">
                  {terms.find(t => t.is_active)?.name}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/20">Active</span>
            </div>
          )}

          <Link href="/" className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <span>&larr; Back to Home</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50">

        {/* Top Desktop Header with Hierarchical Breadcrumbs */}
        <header className="bg-white px-6 py-3.5 border-b border-slate-200 flex justify-between items-center z-20 sticky top-0 hidden md:flex shadow-2xs">
          <div className="flex items-center gap-3">
            <Link href="/" className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold transition-colors">
              Home
            </Link>
            <div className="h-4 w-px bg-slate-300"></div>

            {/* Hierarchical Breadcrumb */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {navGroups.find(g => g.items.some(i => i.id === activeTab))?.category}
              </span>
              <span className="text-slate-400 text-xs font-semibold">&rsaquo;</span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {tabs.find(t => t.id === activeTab)?.name}
              </h2>
            </div>
          </div>
        </header>

        {/* Mobile Header with Horizontal Scrollable Tabs */}
        <header className="bg-slate-900 border-b border-slate-800 p-3 shadow-2xs md:hidden z-20">
          <div className="flex justify-between items-center mb-2.5">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">CS</div>
              <h1 className="text-sm font-bold text-white">College Scheduler</h1>
            </div>
            <Link href="/" className="text-indigo-400 font-semibold text-xs hover:text-indigo-300">Home</Link>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-6 custom-scrollbar">
          
          <div className="max-w-[1400px] mx-auto w-full">
            
            {/* Tab Content Container */}
            <div className="bg-white shadow-2xs rounded-xl border border-slate-200 overflow-hidden">
          
          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              instructors={instructors}
              courses={courses}
              sections={sections}
              rooms={rooms}
              sectionSubjects={sectionSubjects}
              scheduleSlots={scheduleSlots}
              onClearAll={handleClearAll}
              onExportCSV={exportCSV}
              onExportICS={exportICS}
            />
          )}

          {/* Course Assignments Tab */}
          {activeTab === 'assignments' && (
            <CourseAssignmentsTab
              instructors={instructors}
              courses={courses}
              sections={sections}
              sectionSubjects={sectionSubjects}
              scheduleSlots={scheduleSlots}
              departments={departments}
              terms={terms}
              fetchData={fetchData}
            />
          )}

          {/* Master Calendar Tab */}
          {activeTab === 'calendar' && (
            <MasterCalendarTab
              rooms={rooms}
              instructors={instructors}
              sections={sections}
              sectionSubjects={sectionSubjects}
              scheduleSlots={scheduleSlots}
              departments={departments}
              terms={terms}
              fetchData={fetchData}
              setScheduleSlots={setScheduleSlots}
              onClearAll={handleClearAll}
              onExportCSV={exportCSV}
              onExportICS={exportICS}
              calendarViewType={calendarViewType as any}
              setCalendarViewType={setCalendarViewType as any}
              selectedCalendarId={selectedCalendarId}
              setSelectedCalendarId={setSelectedCalendarId}
            />
          )}

          {/* React Hot Toast */}
      <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />

      {/* Clear Schedules Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 transform transition-all">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Clear All Schedules</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete all schedules? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmClearAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm hover:shadow-md"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}



          {/* Faculty & Availability Tab */}
          {activeTab === 'instructors' && (
            <FacultyTab
              instructors={instructors}
              sectionSubjects={sectionSubjects}
              scheduleSlots={scheduleSlots}
              terms={terms}
              fetchData={fetchData}
              setActiveTab={setActiveTab}
              setCalendarViewType={setCalendarViewType}
              setSelectedCalendarId={setSelectedCalendarId}
            />
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <div className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Subjects Curriculum</h2>
                  <p className="text-sm text-slate-500">View and manage offered subjects by year level and semester.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setIsCourseModalOpen(true)}
                    className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3.5 rounded-lg shadow-xs transition-colors text-xs cursor-pointer"
                  >
                    + Add Subject
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3.5 rounded-lg border border-slate-300 transition-colors text-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import CSV
                  </button>
                  <Link 
                    href="/admin/courses/new" 
                    className="inline-flex items-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3.5 rounded-lg border border-slate-300 transition-colors text-xs"
                  >
                    Batch Register &rarr;
                  </Link>
                </div>
              </div>

              {/* Semester Filter Bar */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Semester:</span>
                  <button
                    type="button"
                    onClick={() => setCourseSemesterFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                      courseSemesterFilter === 'ACTIVE'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${courseSemesterFilter === 'ACTIVE' ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                    Active ({activeSemesterNumber === 2 ? '2nd Sem' : '1st Sem'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseSemesterFilter(1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      courseSemesterFilter === 1
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    1st Semester
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseSemesterFilter(2)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      courseSemesterFilter === 2
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    2nd Semester
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseSemesterFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      courseSemesterFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Semesters
                  </button>
                </div>

                <div className="text-xs font-semibold text-slate-500">
                  Showing <span className="font-bold text-slate-900">{filteredCourses.length}</span> of {courses.length} subjects
                </div>
              </div>

              {Object.keys(groupedCourses).length === 0 ? (
                <div className="text-center bg-white rounded-xl border border-slate-200 p-12 space-y-3">
                  <p className="text-sm font-semibold text-slate-700">
                    No subjects found for {effectiveCourseSemester === 'ALL' ? 'the selected filter' : `${effectiveCourseSemester === 2 ? '2nd' : '1st'} Semester`}.
                  </p>
                  <p className="text-xs text-slate-500">You can add new subjects or switch to "All Semesters".</p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCourseSemesterFilter('ALL')}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      View All Semesters
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCourseModalOpen(true)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                    >
                      + Add Subject
                    </button>
                  </div>
                </div>
              ) : (
                Object.keys(groupedCourses).sort().map(year => (
                  <div key={year} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center">
                        <span className="bg-indigo-600 text-white w-7 h-7 rounded-md flex items-center justify-center text-xs mr-2.5 font-bold">
                          Y{year}
                        </span>
                        Year Level {year}
                      </h3>
                      <span className="bg-slate-200/80 text-slate-700 font-semibold px-2.5 py-0.5 rounded-md text-xs">
                        {groupedCourses[year].length} Subjects
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Course Code</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject Name</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Semester</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Units</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Components</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {groupedCourses[year].map((course: any) => (
                            <tr key={course.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm font-bold text-indigo-700">{course.code}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-slate-900">{course.name}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600">{course.department?.name || 'N/A'}</td>
                              <td className="px-6 py-3.5 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                  course.semester === 2
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                  {course.semester === 2 ? '2nd Sem' : '1st Sem'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-800">
                                <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">{course.credits}</span>
                              </td>
                              <td className="px-6 py-3.5 whitespace-nowrap">
                                <div className="flex gap-1 text-[11px] font-medium">
                                  {course.has_lecture && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">Lec</span>}
                                  {course.has_lab && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">Lab</span>}
                                </div>
                              </td>
                              <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm">
                                <button
                                  type="button"
                                  onClick={() => setCourseToDelete(course)}
                                  className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer px-2.5 py-1 rounded-md hover:bg-red-50 border border-transparent hover:border-red-200"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sections Tab */}
          {activeTab === 'sections' && (
            <SectionsTab
              sections={sections}
              departments={departments}
              terms={terms}
              sectionSubjects={sectionSubjects}
              scheduleSlots={scheduleSlots}
              fetchData={fetchData}
              setActiveTab={setActiveTab}
              setCalendarViewType={setCalendarViewType}
              setSelectedCalendarId={setSelectedCalendarId}
            />
          )}

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <RoomsTab
              rooms={rooms}
              scheduleSlots={scheduleSlots}
              fetchData={fetchData}
              setActiveTab={setActiveTab}
              setCalendarViewType={setCalendarViewType}
              setSelectedCalendarId={setSelectedCalendarId}
            />
          )}

          {/* Departments & Terms Tab */}
          {activeTab === 'depts' && (
            <DepartmentsTermsTab
              departments={departments}
              terms={terms}
              courses={courses}
              sections={sections}
              fetchData={fetchData}
              setActiveTab={setActiveTab}
              setCalendarViewType={setCalendarViewType}
              setSelectedCalendarId={setSelectedCalendarId}
            />
          )}

            </div>
            
            {/* Dashboard Footer */}
            <Footer variant="light" />
          </div>
        </main>
      </div>

      {/* Add Course Modal */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        onSuccess={fetchData}
        departments={departments}
        defaultSemester={effectiveCourseSemester === 'ALL' ? activeSemesterNumber : (effectiveCourseSemester as number)}
      />

      {/* Import Courses via CSV Modal */}
      <ImportCoursesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchData}
        departments={departments}
        defaultSemester={effectiveCourseSemester === 'ALL' ? activeSemesterNumber : (effectiveCourseSemester as number)}
      />

      {/* Delete Course Confirmation Modal */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Subject</h3>
            <p className="text-slate-600 text-sm mb-4">
              Are you sure you want to delete <span className="font-bold text-slate-900">{courseToDelete.code} - {courseToDelete.name}</span>?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 font-medium mb-6">
              ⚠️ Deleting this subject will also permanently remove its assigned section subjects and associated schedule time slots.
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                type="button"
                onClick={() => setCourseToDelete(null)}
                disabled={isDeletingCourse}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmDeleteCourse}
                disabled={isDeletingCourse}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeletingCourse ? 'Deleting...' : 'Delete Subject'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
