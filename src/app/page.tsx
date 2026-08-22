"use client";

import { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import Link from 'next/link';
import axios from 'axios';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const mapDayToDate = (dayString: string) => {
  const days: { [key: string]: number } = {
    'MON': 24, 'TUE': 25, 'WED': 26, 'THU': 27, 'FRI': 28, 'SAT': 29, 'SUN': 30
  };
  return days[dayString] || 24;
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

  const durationHours = slot.end_time && slot.start_time 
    ? (new Date(`2000-01-01T${slot.end_time}`).getTime() - new Date(`2000-01-01T${slot.start_time}`).getTime()) / (1000 * 60 * 60)
    : 1.5;
  const isShort = durationHours <= 1;

  if (slot.is_custom) {
    return (
      <div className="flex flex-col h-full p-2 overflow-hidden relative z-10 justify-center">
        <div className="font-black text-sm text-white leading-tight drop-shadow-md text-center">
          {slot.custom_title}
        </div>
      </div>
    );
  }

  const courseCode = slot.section_subject?.course?.code || 'TBA';
  const instructorName = slot.section_subject?.professor?.last_name || 'TBA';
  const sectionName = slot.section_subject?.section?.name || 'A';
  const roomNumber = slot.room?.room_number || 'TBA';

  if (isShort) {
    return (
      <div className="flex flex-col h-full p-1 sm:p-2 overflow-hidden relative z-10 justify-center">
        <div className="font-black text-sm text-white leading-tight truncate drop-shadow-md">
          {courseCode}
        </div>
        <div className="flex items-center justify-between mt-0.5 opacity-90 text-[10px] sm:text-xs">
          <span className="font-bold truncate max-w-[50%]">{instructorName}</span>
          <span className="font-bold">S{sectionName} • R{roomNumber}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-2 overflow-hidden relative z-10">
      <div className="font-black text-sm text-white leading-tight mb-0.5 truncate drop-shadow-md">
        {courseCode}
      </div>
      <div className="text-xs text-white/90 font-bold mb-1 truncate">
        {instructorName}
      </div>
      <div className="mt-auto flex items-center justify-between text-xs font-bold text-white/95">
        <span className="bg-black/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">Sec {sectionName}</span>
        <span className="bg-black/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">Rm {roomNumber}</span>
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
      const [startH, startM] = slot.start_time.split(':');
      const [endH, endM] = slot.end_time.split(':');
      return {
        title: slot.is_custom ? slot.custom_title : slot.section_subject?.course?.code,
        start: new Date(2026, 7, day, parseInt(startH), parseInt(startM)),
        end: new Date(2026, 7, day, parseInt(endH), parseInt(endM)),
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Premium Glassmorphic Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-gray-200/50 p-4 shadow-sm flex justify-between items-center px-6 sm:px-12">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-200">
            CS
          </div>
          <h1 className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-purple-800 tracking-tight">
            College Scheduler
          </h1>
        </div>
        
        <div className="hidden md:flex items-center space-x-6">
          <button onClick={scrollToAbout} className="text-slate-600 hover:text-indigo-600 font-bold transition-all duration-200 text-sm cursor-pointer">
            About
          </button>
          <button onClick={scrollToCalendar} className="text-slate-600 hover:text-indigo-600 font-bold transition-all duration-200 text-sm cursor-pointer">
            Browse Schedules
          </button>
          <div className="h-6 w-px bg-slate-300"></div>
          <Link href="/admin/dashboard" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all text-sm flex items-center gap-2">
            Admin Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden flex-shrink-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[80%] rounded-full bg-purple-300/30 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-300/30 blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-8 leading-tight">
            Smarter Scheduling <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">for Modern Campuses</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 font-medium">
            AI-powered scheduling, conflict detection, and visual timetables. Find your perfect class schedule without the headache of overlaps.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={scrollToCalendar} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/20 hover:-translate-y-1 transition-all cursor-pointer">
              Browse Public Schedules
            </button>
            <Link href="/admin/dashboard" className="bg-white hover:bg-slate-50 text-indigo-700 border-2 border-indigo-100 px-8 py-4 rounded-2xl font-bold text-lg shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer">
              Go to Admin Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-20 bg-white border-y border-slate-100 relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:shadow-xl hover:shadow-indigo-100/50 transition-all group">
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">AI Auto-Scheduler</h3>
            <p className="text-slate-600 font-medium leading-relaxed">
              Generate conflict-free schedules across entire departments instantly with intelligent algorithm packing.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:shadow-xl hover:shadow-indigo-100/50 transition-all group">
            <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Drag & Drop Engine</h3>
            <p className="text-slate-600 font-medium leading-relaxed">
              Refine your generated schedules with a highly responsive, visual drag-and-drop calendar interface.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:shadow-xl hover:shadow-indigo-100/50 transition-all group">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Conflict Prevention</h3>
            <p className="text-slate-600 font-medium leading-relaxed">
              Real-time validation stops room, instructor, and student section overlaps before they happen.
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about-project" className="py-20 bg-slate-50 border-t border-slate-200 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-10 md:p-14 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-[100px] opacity-60 -mr-20 -mt-20 pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 border border-purple-100 text-purple-700 font-bold text-xs uppercase tracking-widest mb-6">
                About the System
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-8">College Scheduler System</h2>
              
              <div className="space-y-6 text-lg text-slate-600 font-medium">
                <p>
                  An advanced, full-stack college scheduling application designed to automate and manage complex academic timetables. This system features an intelligent auto-scheduling algorithm, a rich drag-and-drop interactive calendar, and comprehensive management for instructors, rooms, and courses.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Intelligent Auto-Scheduler
                    </h3>
                    <p className="text-base">Automatically generates schedules based on instructor availability, room capacities, course credits, and conflict resolution rules.</p>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Master Schedule Dashboard
                    </h3>
                    <p className="text-base">A powerful 3-column synchronized calendar view displaying schedules by Room, Instructor, and Section simultaneously.</p>
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-lg">
                    AL
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-1">Lead Developer</p>
                    <p className="text-2xl font-black text-indigo-950">Ar-jay F. Llanera</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Public Calendar */}
      <section id="public-calendar" className="py-20 flex-grow relative bg-slate-50">
        <div className="max-w-[1400px] mx-auto px-6 w-full flex flex-col h-[900px]">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Public Master Schedule</h2>
            <p className="text-slate-500 mt-2 font-medium">Browse published schedules for Fall 2026. Use the filters to find specific classes.</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200 flex-grow flex flex-col overflow-hidden">
            {/* Filters Bar */}
            <div className="bg-slate-50/50 p-6 border-b border-slate-200 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filter By</label>
                <select 
                  value={filterType} 
                  onChange={(e) => { setFilterType(e.target.value); setSelectedFilterId(''); }}
                  className="block w-48 bg-white border border-slate-300 text-slate-700 py-2.5 px-4 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm cursor-pointer"
                >
                  <option value="department">Department</option>
                  <option value="instructor">Instructor</option>
                  <option value="room">Room</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </label>
                <select 
                  value={selectedFilterId} 
                  onChange={(e) => setSelectedFilterId(e.target.value)}
                  className="block w-64 bg-white border border-slate-300 text-slate-700 py-2.5 px-4 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm cursor-pointer"
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
            </div>

            {/* Calendar Container */}
            <div className="flex-grow p-4 relative bg-slate-50/20">
              {isLoading || !isMounted ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-50">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="mt-4 font-bold text-slate-500">Loading Schedules...</p>
                </div>
              ) : null}

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
                className="rounded-xl bg-white border-0 h-full shadow-inner"
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-slate-900 py-12 text-center border-t border-slate-800 relative z-20">
        <div className="flex items-center justify-center space-x-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
            CS
          </div>
          <span className="text-xl font-bold text-white">College Scheduler</span>
        </div>
        <p className="text-slate-400 font-medium text-sm">© 2026 College Scheduler Platform. Built for University Administrators & Students.</p>
      </footer>
    </div>
  );
}
