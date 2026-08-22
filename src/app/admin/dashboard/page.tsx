"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import Link from 'next/link';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell
} from 'recharts';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import toast, { Toaster } from 'react-hot-toast';

const DnDCalendar = withDragAndDrop(Calendar);

moment.updateLocale('en', {
  week: {
    dow: 1, // First day of week is Monday
  },
});

const localizer = momentLocalizer(moment);

const CustomEvent = ({ event }: any) => {
  const slot = event.resource;
  const durationHours = event.end && event.start 
    ? (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60)
    : 1.5;
  const isShort = durationHours <= 1;
  
  // Handle ghost events when dragging from outside or recommendations
  if (!slot || !slot.id) {
    if (event.is_recommendation) {
      return (
        <div className="flex flex-col h-full border-[3px] border-dashed border-indigo-500 rounded-lg justify-center items-center recommendation-pulse">
          <span className="text-indigo-700 font-black text-sm text-center px-1 drop-shadow-sm">FITS HERE</span>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full p-1 text-xs overflow-hidden relative z-10 opacity-70">
        <div className="font-bold text-sm text-white leading-tight mb-0.5 truncate drop-shadow-md">
          {event.title || event.course?.code || 'Scheduling...'}
        </div>
      </div>
    );
  }

  if (slot.is_custom) {
    return (
      <div className={`flex flex-col h-full overflow-hidden relative z-10 rounded-sm ${isShort ? 'p-0.5' : 'p-1'}`} style={{ backgroundColor: '#f59e0b' }}>
        <div className={`font-bold text-white drop-shadow-md truncate ${isShort ? 'text-[11px] leading-tight' : 'text-sm mb-0.5'}`}>{slot.custom_title}</div>
        <div className="text-[10px] text-amber-50 font-medium leading-tight">
          {slot.counts_towards_hours ? 'Hrs' : 'No Hrs'} 
          {slot.counts_towards_units ? ` • ${slot.custom_units_value} Units` : ''}
        </div>
      </div>
    );
  }

  const courseCode = slot.section_subject?.course?.code;
  const professor = slot.section_subject?.professor ? `${slot.section_subject.professor.first_name[0]}. ${slot.section_subject.professor.last_name}` : 'TBA';
  const room = slot.room?.room_number || 'Asynch';
  const section = `Sec ${slot.section_subject?.section?.name || 'A'}`;
  
  if (isShort) {
    return (
      <div className="flex flex-col h-full px-1 py-0.5 overflow-visible relative z-10 hover:z-50 justify-center group">
        <div className="absolute inset-0 bg-inherit rounded-sm -z-10 group-hover:scale-110 transition-transform group-hover:shadow-lg"></div>
        <div className="font-bold text-[11px] text-white leading-none drop-shadow-md break-words whitespace-normal">{courseCode}</div>
        <div className="text-[10px] text-white/95 font-medium leading-none mt-0.5 drop-shadow-md break-words whitespace-normal">{professor}</div>
        <div className="text-[10px] text-white/95 font-medium leading-none mt-0.5 drop-shadow-md break-words whitespace-normal">{section} • Rm: {room}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-1 text-xs overflow-visible relative z-10 hover:z-50 group">
      <div className="absolute inset-0 bg-inherit rounded-sm -z-10 group-hover:scale-105 transition-transform group-hover:shadow-lg"></div>
      <div className="font-bold text-sm text-white leading-tight drop-shadow-md break-words whitespace-normal">{courseCode}</div>
      <div className="text-white/95 font-medium leading-tight mt-1 drop-shadow-md break-words whitespace-normal">{professor}</div>
      <div className="text-white/95 font-medium leading-tight mt-0.5 drop-shadow-md break-words whitespace-normal">{section} • Rm: {room}</div>
    </div>
  );
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('analytics');
  
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
  const [draggedEvent, setDraggedEvent] = useState<any>(null);
  const [hoveredUnscheduled, setHoveredUnscheduled] = useState<any>(null);
  const [pendingDrop, setPendingDrop] = useState<any>(null);

  // --- Assignments State ---
  const [selectedAssignmentInstructor, setSelectedAssignmentInstructor] = useState<string>('');
  const [selectedAssignmentCourse, setSelectedAssignmentCourse] = useState<string>('');
  const [stagedSectionSubjects, setStagedSectionSubjects] = useState<number[]>([]);
  const [draggedAssignmentItem, setDraggedAssignmentItem] = useState<number | null>(null);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [assignmentError, setAssignmentError] = useState('');

  // --- Instructor Availability State ---
  const [availabilityModalInstructor, setAvailabilityModalInstructor] = useState<any>(null);
  const [availabilityDetails, setAvailabilityDetails] = useState({
    activeDays: [] as string[],
    startTime: '',
    endTime: ''
  });

  const handleOpenAvailabilityModal = (instructor: any) => {
    setAvailabilityModalInstructor(instructor);
    setAvailabilityDetails({
      activeDays: instructor.available_days ? instructor.available_days.split(',') : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      startTime: instructor.available_start_time ? instructor.available_start_time.substring(0, 5) : '',
      endTime: instructor.available_end_time ? instructor.available_end_time.substring(0, 5) : ''
    });
  };

  const handleSaveAvailability = async () => {
    if (!availabilityModalInstructor) return;
    try {
      await axios.patch(`http://localhost:8000/api/users/${availabilityModalInstructor.id}/`, {
        available_days: availabilityDetails.activeDays.join(','),
        available_start_time: availabilityDetails.startTime || null,
        available_end_time: availabilityDetails.endTime || null
      });
      setAvailabilityModalInstructor(null);
      fetchData(); // Refresh to get updated constraints
    } catch (err: any) {
      toast.error('Failed to save availability: ' + err.message);
    }
  };

  // --- Custom Schedule State ---
  const [isCustomSlotModalOpen, setIsCustomSlotModalOpen] = useState(false);
  const [isEditCustomSlotModalOpen, setIsEditCustomSlotModalOpen] = useState(false);
  const [editingCustomSlotId, setEditingCustomSlotId] = useState<number | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isDeleteEventModalOpen, setIsDeleteEventModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [customSlotDetails, setCustomSlotDetails] = useState({
    title: '',
    countsTowardsHours: true,
    countsTowardsUnits: false,
    unitsValue: '0',
    start: null as Date | null,
    end: null as Date | null,
  });

  const handleSelectSlot = ({ start, end }: any) => {
    if (calendarViewType !== 'instructor' || !selectedCalendarId) {
      toast.error("Custom schedules can only be added directly to an Instructor's calendar.");
      return;
    }
    setCustomSlotDetails(prev => ({ ...prev, start, end }));
    setIsCustomSlotModalOpen(true);
  };

  const handleSelectEvent = (event: any) => {
    if (event.is_recommendation) return;
    
    if (event.resource?.is_custom) {
      setEditingCustomSlotId(event.resource.id);
      setCustomSlotDetails({
        title: event.resource.custom_title,
        countsTowardsHours: event.resource.counts_towards_hours,
        countsTowardsUnits: event.resource.counts_towards_units,
        unitsValue: (event.resource.custom_units_value || 0).toString(),
        start: event.start,
        end: event.end
      });
      setIsEditCustomSlotModalOpen(true);
      return;
    }

    setEventToDelete(event);
    setIsDeleteEventModalOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete || !eventToDelete.resource?.id) return;
    setIsDeleteEventModalOpen(false);
    
    // Optimistic UI Update
    const originalSlots = [...scheduleSlots];
    setScheduleSlots((prev) => prev.filter(slot => slot.id !== eventToDelete.resource.id));
    
    try {
      await axios.delete(`http://localhost:8000/api/schedule-slots/${eventToDelete.resource.id}/`);
      toast.success('Schedule removed successfully');
      fetchData(); // ensures unscheduled list updates correctly
    } catch (err: any) {
      setScheduleSlots(originalSlots);
      toast.error('Failed to remove schedule');
    }
    setEventToDelete(null);
  };

  const handleSaveCustomSlot = async () => {
    if (!customSlotDetails.title.trim()) {
      toast.error('Please enter a title for the custom block.');
      return;
    }
    if (!customSlotDetails.start || !customSlotDetails.end) return;

    const newStart = moment(customSlotDetails.start).format('HH:mm');
    const newEnd = moment(customSlotDetails.end).format('HH:mm');
    
    const dayMapRev: { [key: number]: string } = {
      24: 'MON', 25: 'TUE', 26: 'WED', 27: 'THU', 28: 'FRI', 29: 'SAT', 30: 'SUN'
    };
    const newDay = dayMapRev[moment(customSlotDetails.start).date()];

    try {
      await axios.post('http://localhost:8000/api/schedule-slots/', {
        is_custom: true,
        custom_title: customSlotDetails.title,
        professor_id: parseInt(selectedCalendarId),
        counts_towards_hours: customSlotDetails.countsTowardsHours,
        counts_towards_units: customSlotDetails.countsTowardsUnits,
        custom_units_value: parseFloat(customSlotDetails.unitsValue) || 0,
        day_of_week: newDay,
        start_time: newStart,
        end_time: newEnd
      });
      setIsCustomSlotModalOpen(false);
      setCustomSlotDetails({ title: '', countsTowardsHours: true, countsTowardsUnits: false, unitsValue: '0', start: null, end: null });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save custom schedule: ' + (err.response?.data?.non_field_errors?.[0] || 'Conflict detected.'));
    }
  };

  const handleUpdateCustomSlot = async () => {
    if (!customSlotDetails.title.trim() || !customSlotDetails.start || !customSlotDetails.end || !editingCustomSlotId) return;
    
    const newStart = moment(customSlotDetails.start).format('HH:mm');
    const newEnd = moment(customSlotDetails.end).format('HH:mm');
    
    const dayMapRev: { [key: number]: string } = {
      24: 'MON', 25: 'TUE', 26: 'WED', 27: 'THU', 28: 'FRI', 29: 'SAT', 30: 'SUN'
    };
    const newDay = dayMapRev[moment(customSlotDetails.start).date()];

    try {
      await axios.patch(`http://localhost:8000/api/schedule-slots/${editingCustomSlotId}/`, {
        custom_title: customSlotDetails.title,
        day_of_week: newDay,
        start_time: newStart,
        end_time: newEnd,
        counts_towards_hours: customSlotDetails.countsTowardsHours,
        counts_towards_units: customSlotDetails.countsTowardsUnits,
        custom_units_value: parseFloat(customSlotDetails.unitsValue) || 0
      });
      setIsEditCustomSlotModalOpen(false);
      setEditingCustomSlotId(null);
      setCustomSlotDetails({ title: '', countsTowardsHours: true, countsTowardsUnits: false, unitsValue: '0', start: null, end: null });
      fetchData();
      toast.success('Custom schedule updated');
    } catch (err: any) {
      toast.error('Failed to update custom schedule');
    }
  };

  const handleDeleteCustomSlot = async () => {
    if (!editingCustomSlotId) return;
    
    try {
      await axios.delete(`http://localhost:8000/api/schedule-slots/${editingCustomSlotId}/`);
      setIsEditCustomSlotModalOpen(false);
      setEditingCustomSlotId(null);
      setCustomSlotDetails({ title: '', countsTowardsHours: true, countsTowardsUnits: false, unitsValue: '0', start: null, end: null });
      fetchData();
      toast.success('Custom schedule deleted');
    } catch (err: any) {
      toast.error('Failed to delete custom schedule');
    }
  };

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
  }, []);

  // --- Assignments Logic ---
  useEffect(() => {
    if (selectedAssignmentInstructor) {
      const assigned = sectionSubjects
        .filter(ss => ss.professor?.id?.toString() === selectedAssignmentInstructor)
        .map(ss => ss.id);
      setStagedSectionSubjects(assigned);
    } else {
      setStagedSectionSubjects([]);
    }
  }, [selectedAssignmentInstructor, sectionSubjects]);

  const handleAssignmentToggle = (ssId: number) => {
    setStagedSectionSubjects(prev => 
      prev.includes(ssId) ? prev.filter(id => id !== ssId) : [...prev, ssId]
    );
  };

  const assignmentTotalUnits = stagedSectionSubjects.reduce((sum, ssId) => {
    const ss = sectionSubjects.find(s => s.id === ssId);
    return sum + (ss ? ss.course.credits : 0);
  }, 0) + scheduleSlots
    .filter(s => s.is_custom && s.professor?.id?.toString() === selectedAssignmentInstructor && s.counts_towards_units)
    .reduce((sum, s) => sum + parseFloat(s.custom_units_value || 0), 0);

  const assignmentTotalHours = stagedSectionSubjects.reduce((sum, ssId) => {
    const ss = sectionSubjects.find(s => s.id === ssId);
    if (!ss) return sum;
    const hours = ss.course.has_lab ? 5 : ss.course.credits;
    return sum + hours;
  }, 0) + scheduleSlots
    .filter(s => s.is_custom && s.professor?.id?.toString() === selectedAssignmentInstructor && s.counts_towards_hours)
    .reduce((sum, s) => sum + parseFloat(s.custom_units_value || 0), 0);

  const handleSaveAssignments = async () => {
    if (!selectedAssignmentInstructor) return;
    setIsSavingAssignments(true);
    setAssignmentSuccess('');
    setAssignmentError('');

    try {
      const originallyAssigned = sectionSubjects
        .filter(ss => ss.professor?.id?.toString() === selectedAssignmentInstructor)
        .map(ss => ss.id);
      
      const toAdd = stagedSectionSubjects.filter(id => !originallyAssigned.includes(id));
      const toRemove = originallyAssigned.filter(id => !stagedSectionSubjects.includes(id));

      const requests = [
        ...toAdd.map(id => axios.patch(`http://localhost:8000/api/section-subjects/${id}/`, { professor_id: selectedAssignmentInstructor })),
        ...toRemove.map(id => axios.patch(`http://localhost:8000/api/section-subjects/${id}/`, { professor_id: null }))
      ];

      await Promise.all(requests);
      setAssignmentSuccess('Assignments saved successfully!');
      fetchData(); // Refresh to update originallyAssigned state
      setTimeout(() => setAssignmentSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setAssignmentError('Failed to save assignments. Please try again.');
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const filteredAssignmentSS = selectedAssignmentCourse 
    ? sectionSubjects.filter(ss => {
        if (ss.course.id.toString() !== selectedAssignmentCourse) return false;
        if (ss.professor && ss.professor.id.toString() !== selectedAssignmentInstructor) return false;
        return true;
      })
    : [];


  if (!isMounted || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading data...</div>;
  }

  const tabs = [
    { id: 'analytics', name: 'Analytics' },
    { id: 'calendar', name: 'Calendar' },
    { id: 'assignments', name: 'Assignments' },
    { id: 'instructors', name: 'Instructors' },
    { id: 'courses', name: 'Subjects' },
    { id: 'sections', name: 'Sections' },
    { id: 'rooms', name: 'Rooms' },
    { id: 'depts', name: 'Departments & Terms' },
  ];

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

  const onEventDrop = async ({ event, start, end }: any) => {
    const newStart = moment(start).format('HH:mm');
    const newEnd = moment(end).format('HH:mm');
    
    const dayMapRev: { [key: number]: string } = {
      24: 'MON', 25: 'TUE', 26: 'WED', 27: 'THU', 28: 'FRI', 29: 'SAT', 30: 'SUN'
    };
    const newDay = dayMapRev[moment(start).date()];
    if (!newDay) {
      toast.error('Cannot move schedule to an invalid day outside the target week.');
      return;
    }
    
    // Instant Frontend Conflict Detection
    // Check if the new time overlaps with any other event currently visible on this calendar
    const hasVisualConflict = calendarEvents.some((existingEvent: any) => {
      // Don't compare against itself
      if (existingEvent.resource.id === event.resource.id) return false;
      // Check for overlap: max(start1, start2) < min(end1, end2)
      return Math.max(start.getTime(), existingEvent.start.getTime()) < Math.min(end.getTime(), existingEvent.end.getTime());
    });

    if (hasVisualConflict) {
      toast.error(`Conflict: You cannot drag a class onto a time slot that is already occupied in this view.`);
      return;
    }
    
    // Save original state for potential revert
    const originalSlots = [...scheduleSlots];
    
    // Optimistic UI Update: instantly snap the block to the new time locally
    setScheduleSlots((prev) => prev.map(slot => 
      slot.id === event.resource.id 
        ? { ...slot, day_of_week: newDay, start_time: newStart, end_time: newEnd }
        : slot
    ));
    
    try {
      await axios.patch(`http://localhost:8000/api/schedule-slots/${event.resource.id}/`, {
        day_of_week: newDay,
        start_time: newStart,
        end_time: newEnd,
      });
      // Success! No need to run the heavy fetchData() anymore.
    } catch (err: any) {
      // Conflict detected by backend: instantly revert the UI to the original state
      setScheduleSlots(originalSlots);
      
      const errorData = err.response?.data;
      let msg = 'Could not move class. Conflict detected.';
      if (Array.isArray(errorData)) msg = errorData[0];
      else if (errorData?.non_field_errors) msg = errorData.non_field_errors[0];
      else if (typeof errorData === 'string') msg = errorData;
      
      toast.error(msg);
    }
  };

  const onDropFromOutside = async ({ start }: any) => {
    if (!draggedEvent || !selectedCalendarId) {
      toast.error("Please select a calendar view first.");
      return;
    }
    
    // Auto-calculate end time based on the specific block being dragged
    const durationHours = draggedEvent.blockInfo?.hours || 1;
    const end = new Date(start.getTime() + (durationHours * 60 * 60 * 1000));
    
    const newStart = moment(start).format('HH:mm');
    const newEnd = moment(end).format('HH:mm');
    
    const dayMapRev: { [key: number]: string } = {
      24: 'MON', 25: 'TUE', 26: 'WED', 27: 'THU', 28: 'FRI', 29: 'SAT', 30: 'SUN'
    };
    const newDay = dayMapRev[moment(start).date()];
    if (!newDay) {
      toast.error('Cannot schedule outside the target week.');
      return;
    }

    // Instant Frontend Conflict Detection
    const hasVisualConflict = calendarEvents.some((existingEvent: any) => {
      return Math.max(start.getTime(), existingEvent.start.getTime()) < Math.min(end.getTime(), existingEvent.end.getTime());
    });

    if (hasVisualConflict) {
      const conflictingCourse = calendarEvents.find((existingEvent: any) => 
        Math.max(start.getTime(), existingEvent.start.getTime()) < Math.min(end.getTime(), existingEvent.end.getTime())
      )?.title || 'another class';
      toast.error(`Conflict: Time slot overlaps with ${conflictingCourse}.`);
      return;
    }

    if (calendarViewType !== 'room') {
      setPendingDrop({
        subject: draggedEvent,
        day: newDay,
        start_time: newStart,
        end_time: newEnd
      });
      return;
    }

    try {
      await axios.post('http://localhost:8000/api/schedule-slots/', {
        section_subject_id: draggedEvent.id,
        room_id: parseInt(selectedCalendarId),
        day_of_week: newDay,
        start_time: newStart,
        end_time: newEnd
      });
      toast.success(`${draggedEvent.course.code} scheduled successfully!`);
      fetchData(); // refresh data to remove from unscheduled
      setDraggedEvent(null);
    } catch (err: any) {
      const errorData = err.response?.data;
      let msg = 'Could not create schedule. Conflict detected.';
      if (Array.isArray(errorData)) msg = errorData[0];
      else if (errorData?.non_field_errors) msg = errorData.non_field_errors[0];
      else if (typeof errorData === 'string') msg = errorData;
      toast.error(msg);
    }
  };

  const handleConfirmPendingDrop = async (roomId: number | null) => {
    if (!pendingDrop) return;
    try {
      await axios.post('http://localhost:8000/api/schedule-slots/', {
        section_subject_id: pendingDrop.subject.id,
        room_id: roomId,
        day_of_week: pendingDrop.day,
        start_time: pendingDrop.start_time,
        end_time: pendingDrop.end_time
      });
      toast.success(`${pendingDrop.subject.course.code} scheduled successfully!`);
      fetchData();
      setDraggedEvent(null);
      setPendingDrop(null);
    } catch (err: any) {
      const errorData = err.response?.data;
      let msg = 'Could not create schedule. Conflict detected.';
      if (Array.isArray(errorData)) msg = errorData[0];
      else if (errorData?.non_field_errors) msg = errorData.non_field_errors[0];
      else if (typeof errorData === 'string') msg = errorData;
      toast.error(msg);
    }
  };

  const scheduledSlotsBySubject = scheduleSlots.reduce((acc: any, slot: any) => {
    if (slot.section_subject) {
      if (!acc[slot.section_subject.id]) acc[slot.section_subject.id] = [];
      acc[slot.section_subject.id].push(slot);
    }
    return acc;
  }, {});

  const unscheduledSubjects = sectionSubjects.flatMap((ss: any) => {
    // Check filters
    if (calendarViewType === 'instructor' && selectedCalendarId && ss.professor?.id?.toString() !== selectedCalendarId) return [];
    if (calendarViewType === 'section' && selectedCalendarId && ss.section?.id?.toString() !== selectedCalendarId) return [];
    
    // Define required blocks based on course
    let requiredBlocks: { type: string, hours: number, id: string }[] = [];
    if (ss.course.has_lab) {
      requiredBlocks.push({ type: 'Laboratory', hours: 3, id: `${ss.id}-lab` });
      requiredBlocks.push({ type: 'Lecture', hours: 1, id: `${ss.id}-lec` });
      requiredBlocks.push({ type: 'Async', hours: 1, id: `${ss.id}-async` });
    } else {
      const credits = ss.course.credits || 3;
      for (let i = 0; i < credits; i++) {
         requiredBlocks.push({ 
           type: i === credits - 1 ? 'Async' : 'Lecture',
           hours: 1, 
           id: `${ss.id}-lec-${i}` 
         });
      }
    }

    // Calculate scheduled blocks
    const scheduled = scheduledSlotsBySubject[ss.id] || [];
    const scheduledDurations = scheduled.map((s: any) => {
      const start = moment(s.start_time, 'HH:mm');
      const end = moment(s.end_time, 'HH:mm');
      return moment.duration(end.diff(start)).asHours();
    });

    // Check off completed blocks
    let remainingBlocks = [...requiredBlocks];
    for (const duration of scheduledDurations) {
       const exactMatch = remainingBlocks.findIndex(b => Math.abs(b.hours - duration) < 0.1);
       if (exactMatch !== -1) {
         remainingBlocks.splice(exactMatch, 1);
       } else {
         if (remainingBlocks.length > 0) remainingBlocks.splice(0, 1);
       }
    }

    // Return remaining blocks
    return remainingBlocks.map(b => ({
      ...ss,
      _renderId: b.id, // override ID so react keys don't clash
      blockInfo: b
    }));
  });

  let rawCalendarEvents: any[] = scheduleSlots
    .filter((slot: any) => {
      if (!selectedCalendarId) return false;
      if (calendarViewType === 'room') return slot.room?.id?.toString() === selectedCalendarId;
      if (calendarViewType === 'instructor') {
        if (slot.is_custom) return slot.professor?.id?.toString() === selectedCalendarId;
        return slot.section_subject?.professor?.id?.toString() === selectedCalendarId;
      }
      if (calendarViewType === 'section') return slot.section_subject?.section?.id?.toString() === selectedCalendarId;
      return false;
    })
    .map((slot: any) => {
      const day = mapDayToDate(slot.day_of_week);
      const [startH, startM] = slot.start_time.split(':');
      const [endH, endM] = slot.end_time.split(':');
      
      let title = '';
      if (slot.is_custom) {
        title = slot.custom_title;
      } else if (calendarViewType === 'room') {
        title = `${slot.section_subject?.course?.code} - ${slot.section_subject?.professor?.last_name || 'TBA'} - Sec ${slot.section_subject?.section?.name || 'A'}`;
      } else if (calendarViewType === 'instructor') {
        title = `${slot.section_subject?.course?.code} - Room ${slot.room?.room_number || 'TBA'} - Sec ${slot.section_subject?.section?.name || 'A'}`;
      } else if (calendarViewType === 'section') {
        title = `${slot.section_subject?.course?.code} - ${slot.section_subject?.professor?.last_name || 'TBA'} - Room ${slot.room?.room_number || 'TBA'}`;
      }
      
      return {
        title,
        start: new Date(2026, 7, day, parseInt(startH), parseInt(startM)),
        end: new Date(2026, 7, day, parseInt(endH), parseInt(endM)),
        resource: slot,
      };
    });

  const activeSubject = draggedEvent || hoveredUnscheduled;
  if (activeSubject && selectedCalendarId && calendarViewType === 'room') {
    const durationHours = activeSubject.blockInfo?.hours || 1;
    let recsFound = 0;
    const maxRecs = 5;
    
    for (let day = 24; day <= 28; day++) { // MON to FRI
       for (let hour = 8; hour <= 16; hour++) { // 8 AM to 4 PM start times
          if (recsFound >= maxRecs) break;
          
          const start = new Date(2026, 7, day, hour, 0);
          const end = new Date(start.getTime() + (durationHours * 60 * 60 * 1000));
          const dayName = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][day - 24];
          
          const hasConflict = scheduleSlots.some((slot: any) => {
             if (slot.day_of_week !== dayName) return false;
             
             const [slotStartH, slotStartM] = slot.start_time.split(':');
             const [slotEndH, slotEndM] = slot.end_time.split(':');
             const slotStart = new Date(2026, 7, day, parseInt(slotStartH), parseInt(slotStartM));
             const slotEnd = new Date(2026, 7, day, parseInt(slotEndH), parseInt(slotEndM));
             
             const overlaps = Math.max(start.getTime(), slotStart.getTime()) < Math.min(end.getTime(), slotEnd.getTime());
             if (!overlaps) return false;
             
             if (slot.room?.id?.toString() === selectedCalendarId) return true;
             if (activeSubject.professor && slot.section_subject?.professor?.id === activeSubject.professor.id) return true;
             if (activeSubject.section && slot.section_subject?.section?.id === activeSubject.section.id) return true;
             return false;
          });
          
          if (!hasConflict) {
             rawCalendarEvents.push({
               title: 'Recommended',
               start,
               end,
               is_recommendation: true,
               resource: null
             });
             recsFound++;
             hour++; // Skip an hour to stagger recommendations
          }
       }
    }
  }

  const calendarEvents = rawCalendarEvents;

  // Group courses by year level for the UI
  const groupedCourses = courses.reduce((acc: any, course: any) => {
    const year = course.year_level;
    if (!acc[year]) acc[year] = [];
    acc[year].push(course);
    return acc;
  }, {});

  // --- Analytics Data Prep ---
  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH + endM / 60) - (startH + startM / 60);
  };

  const roomAnalyticsData = rooms.map(room => {
    const slots = scheduleSlots.filter(s => s.room?.id === room.id);
    const totalHours = slots.reduce((acc, slot) => acc + calculateHours(slot.start_time, slot.end_time), 0);
    // Max 47.5 hours per week (7:30 to 17:00 for 5 days)
    const utilization = Math.min(100, Math.round((totalHours / 47.5) * 100));
    return {
      name: `${room.building} ${room.room_number}`,
      utilization,
      hours: parseFloat(totalHours.toFixed(1))
    };
  }).sort((a, b) => b.utilization - a.utilization);
  const instructorAnalyticsData = instructors.map(inst => {
    const slots = scheduleSlots.filter(s => {
      if (s.is_custom && s.professor?.id === inst.id) return s.counts_towards_hours;
      return s.section_subject?.professor?.id === inst.id;
    });
    const totalHours = slots.reduce((acc, slot) => acc + calculateHours(slot.start_time, slot.end_time), 0);
    return {
      name: `${inst.first_name} ${inst.last_name}`,
      hours: parseFloat(totalHours.toFixed(1)),
      max: 30 // Example max target hours
    };
  }).filter(d => d.hours > 0).sort((a, b) => b.hours - a.hours);

  const unscheduledSectionSubjects = sectionSubjects.filter(ss => {
    const ssSlots = scheduleSlots.filter(slot => slot.section_subject?.id === ss.id);
    const scheduledHours = ssSlots.reduce((acc, slot) => acc + calculateHours(slot.start_time, slot.end_time), 0);
    const targetHours = ss.course.has_lab ? 5 : ss.course.credits;
    return scheduledHours < targetHours;
  });

  const instructorCalendarHours = () => {
    if (calendarViewType !== 'instructor' || !selectedCalendarId) return null;
    const hours = { 24: 0, 25: 0, 26: 0, 27: 0, 28: 0, 29: 0, 30: 0 };
    let total = 0;
    calendarEvents.forEach((ev: any) => {
      if (ev.resource.is_custom && !ev.resource.counts_towards_hours) return;
      const day = ev.start.getDate();
      const duration = (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60);
      if (hours[day as keyof typeof hours] !== undefined) {
        hours[day as keyof typeof hours] += duration;
      }
      total += duration;
    });
    return { hours, total };
  };

  const instHours = instructorCalendarHours();

  // --- Assignments Drag & Drop Handlers ---
  const handleAssignmentDragStart = (e: any, ssId: number) => {
    setDraggedAssignmentItem(ssId);
  };
  
  const handleAssignmentDragOver = (e: any) => {
    e.preventDefault();
  };
  
  const handleAssignmentDropToAssigned = (e: any) => {
    e.preventDefault();
    if (draggedAssignmentItem !== null && !stagedSectionSubjects.includes(draggedAssignmentItem)) {
      setStagedSectionSubjects([...stagedSectionSubjects, draggedAssignmentItem]);
    }
    setDraggedAssignmentItem(null);
  };

  const handleAssignmentDropToAvailable = (e: any) => {
    e.preventDefault();
    if (draggedAssignmentItem !== null && stagedSectionSubjects.includes(draggedAssignmentItem)) {
      setStagedSectionSubjects(stagedSectionSubjects.filter(id => id !== draggedAssignmentItem));
    }
    setDraggedAssignmentItem(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex shrink-0">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
              CS
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Scheduler</h1>
          </div>
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-indigo-500/10 text-indigo-400 font-bold'
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate">{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6">
          <Link href="/" className="flex items-center space-x-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors">
            <span>&larr; Back to Home</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50">
        {/* Decorative background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-200/40 blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/40 blur-[100px] pointer-events-none z-0"></div>

        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-200 flex justify-between items-center z-20 sticky top-0 hidden md:flex shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Home
            </Link>
            <div className="h-6 w-px bg-slate-300"></div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {tabs.find(t => t.id === activeTab)?.name}
            </h2>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="bg-white/70 backdrop-blur-md border-b border-slate-200/50 p-4 shadow-sm flex justify-between items-center z-10 md:hidden">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">CS</div>
              <h1 className="text-lg font-bold text-slate-800">Dashboard</h1>
            </div>
            <Link href="/" className="text-indigo-600 font-medium text-sm">Home</Link>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative z-10 custom-scrollbar">
          
          <div className="max-w-[1400px] mx-auto w-full">
            
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Scheduling Controls</h2>
                <p className="text-slate-500 mt-1 text-sm">Manage data or execute the auto-scheduler engine.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleClearAll}
                  className="inline-flex items-center px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl font-semibold transition-colors shadow-sm text-sm"
                >
                  Clear All Schedules
                </button>
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md text-sm"
                >
                  Export CSV
                </button>
                <button
                  onClick={exportICS}
                  className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md text-sm"
                >
                  Export ICS
                </button>
                <Link
                  href="/admin/auto-schedule"
                  className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 text-sm"
                >
                  Auto-Schedule
                </Link>
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Total Instructors', value: instructors.length, text: 'text-indigo-600' },
                { label: 'Total Subjects', value: courses.length, text: 'text-emerald-600' },
                { label: 'Total Sections', value: sections.length, text: 'text-purple-600' },
                { label: 'Total Rooms', value: rooms.length, text: 'text-rose-600' },
              ].map((stat, i) => (
                 <div key={i} className="bg-white/80 backdrop-blur-sm border border-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 flex flex-col justify-between transition-transform hover:-translate-y-1">
                   <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
                   <div className={`text-5xl font-black mt-3 bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500`}>{stat.value}</div>
                 </div>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white/40 backdrop-blur-sm shadow-xl shadow-slate-200/50 rounded-3xl border border-white min-h-[600px] overflow-hidden p-2">
          
          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 min-h-[600px] auto-rows-min">
              
              {/* Box 1: Instructor Load Chart (Span 2) */}
              <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex flex-col h-[400px] transition-all hover:shadow-2xl hover:shadow-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Instructor Scheduled Hours</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Total weekly scheduled hours per instructor based on calendar blocks.</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  </div>
                </div>
                {instructorAnalyticsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={instructorAnalyticsData} margin={{ top: 5, right: 30, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                      <YAxis stroke="#94a3b8" tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(value: any) => [`${value} hrs`, 'Teaching Load']}
                        contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
                        cursor={{fill: '#f8fafc'}}
                      />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]} barSize={24}>
                        {instructorAnalyticsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.hours > 24 ? '#ef4444' : entry.hours > 18 ? '#f59e0b' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">No instructor assignments scheduled.</div>
                )}
              </div>

              {/* Box 2: Instructor Highlights (Span 1) */}
              <div className="col-span-1 bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-3xl shadow-xl shadow-indigo-200/50 border border-white/20 flex flex-col h-[400px] text-white transition-all hover:-translate-y-1">
                 <h3 className="text-xl font-black tracking-tight mb-6">Instructor Insights</h3>
                 
                 <div className="flex-1 flex flex-col justify-center space-y-6">
                   {instructorAnalyticsData.length > 0 ? (
                     <>
                       <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                         <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">Highest Load</div>
                         <div className="text-xl font-black truncate">{instructorAnalyticsData[0].name}</div>
                         <div className="text-3xl font-black mt-1">{instructorAnalyticsData[0].hours} <span className="text-base font-medium text-indigo-200">hrs</span></div>
                       </div>
                       
                       <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                         <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2">Lightest Load</div>
                         <div className="text-xl font-black truncate">{instructorAnalyticsData[instructorAnalyticsData.length - 1].name}</div>
                         <div className="text-3xl font-black mt-1">{instructorAnalyticsData[instructorAnalyticsData.length - 1].hours} <span className="text-base font-medium text-indigo-200">hrs</span></div>
                       </div>
                     </>
                   ) : (
                     <div className="text-center text-indigo-200 text-sm font-medium">No data available</div>
                   )}
                 </div>
              </div>

              {/* Box 3: Room Highlights (Span 1) */}
              <div className="col-span-1 bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-xl shadow-emerald-200/50 border border-white/20 flex flex-col h-[400px] text-white transition-all hover:-translate-y-1">
                 <h3 className="text-xl font-black tracking-tight mb-6">Room Insights</h3>
                 
                 <div className="flex-1 flex flex-col justify-center space-y-6">
                   {roomAnalyticsData.length > 0 ? (
                     <>
                       <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                         <div className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2">Most Utilized</div>
                         <div className="text-xl font-black truncate">{roomAnalyticsData[0].name}</div>
                         <div className="text-3xl font-black mt-1">{roomAnalyticsData[0].utilization}% <span className="text-sm font-medium text-emerald-200">({roomAnalyticsData[0].hours}h)</span></div>
                       </div>
                       
                       <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                         <div className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2">Least Utilized</div>
                         <div className="text-xl font-black truncate">{roomAnalyticsData[roomAnalyticsData.length - 1].name}</div>
                         <div className="text-3xl font-black mt-1">{roomAnalyticsData[roomAnalyticsData.length - 1].utilization}% <span className="text-sm font-medium text-emerald-200">({roomAnalyticsData[roomAnalyticsData.length - 1].hours}h)</span></div>
                       </div>
                     </>
                   ) : (
                     <div className="text-center text-emerald-200 text-sm font-medium">No data available</div>
                   )}
                 </div>
              </div>

              {/* Box 4: Room Utilization Chart (Span 2) */}
              <div className="col-span-1 lg:col-span-2 bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex flex-col h-[400px] transition-all hover:shadow-2xl hover:shadow-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Room Utilization</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Percentage of 47.5 operating hours scheduled per room.</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z"></path></svg>
                  </div>
                </div>
                {roomAnalyticsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roomAnalyticsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" width={100} stroke="#64748b" tick={{fontSize: 11, fontWeight: 700}} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(value: any) => [`${value}%`, 'Utilization']}
                        contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
                        cursor={{fill: '#f8fafc'}}
                      />
                      <Bar dataKey="utilization" radius={[0, 6, 6, 0]} barSize={20}>
                        {roomAnalyticsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.utilization > 85 ? '#ef4444' : entry.utilization > 50 ? '#f59e0b' : '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">No scheduling data available.</div>
                )}
              </div>
              
              {/* Box 5: Unscheduled Subjects (Span 3) */}
              <div className="col-span-1 lg:col-span-3 bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex flex-col transition-all hover:shadow-2xl hover:shadow-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Unscheduled Subjects</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Subjects that have been assigned but not fully scheduled on the calendar.</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </div>
                </div>
                
                {unscheduledSectionSubjects.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Section</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Instructor</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduled / Target</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {unscheduledSectionSubjects.map(ss => {
                          const ssSlots = scheduleSlots.filter(slot => slot.section_subject?.id === ss.id);
                          const scheduledHours = ssSlots.reduce((acc, slot) => acc + calculateHours(slot.start_time, slot.end_time), 0);
                          const targetHours = ss.course.has_lab ? 5 : ss.course.credits;
                          return (
                            <tr key={ss.id} className="hover:bg-amber-50/50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-800">
                                {ss.course.code} <span className="text-xs text-slate-500 font-medium ml-1">({ss.course.name})</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                                {ss.section.department.code} {ss.section.name || `${ss.section.year_level}A`}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                                {ss.professor ? `${ss.professor.first_name} ${ss.professor.last_name}` : <span className="text-red-500 italic">Unassigned</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-amber-600">{scheduledHours}</span>
                                  <span className="text-xs text-slate-400">/</span>
                                  <span className="text-sm font-bold text-slate-700">{targetHours} hrs</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-emerald-600 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <svg className="w-12 h-12 mb-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-bold text-lg">All caught up!</span>
                    <span className="text-sm text-emerald-500">Every assigned subject is fully scheduled.</span>
                  </div>
                )}
              </div>
              
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div className="p-6 bg-slate-50 min-h-[600px] flex flex-col lg:flex-row gap-6">
              
              {/* Left Panel: Instructor Selection & Assigned Load */}
              <div 
                className="w-full lg:w-1/2 bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex flex-col h-[700px]"
                onDragOver={handleAssignmentDragOver}
                onDrop={handleAssignmentDropToAssigned}
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Instructor Load</h3>
                    <p className="text-sm text-slate-500 font-medium">Select an instructor to view or drop assignments here.</p>
                  </div>
                </div>
                
                <select
                  value={selectedAssignmentInstructor}
                  onChange={(e) => setSelectedAssignmentInstructor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 shadow-sm cursor-pointer"
                >
                  <option value="">-- Select Instructor --</option>
                  {instructors.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.first_name} {inst.last_name}</option>
                  ))}
                </select>

                {selectedAssignmentInstructor && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center transition-transform hover:-translate-y-1">
                      <span className="text-indigo-900 font-bold text-xs uppercase tracking-wider mb-1">Total Units</span>
                      <span className="text-3xl font-black text-indigo-600">{assignmentTotalUnits}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center transition-transform hover:-translate-y-1">
                      <span className="text-emerald-900 font-bold text-xs uppercase tracking-wider mb-1">Total Hours</span>
                      <span className="text-3xl font-black text-emerald-600">{assignmentTotalHours}</span>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-2xl border border-slate-200 p-4 space-y-3 custom-scrollbar border-dashed border-2 border-slate-300">
                  {!selectedAssignmentInstructor ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium text-center">
                      <p>Select an instructor first.</p>
                    </div>
                  ) : sectionSubjects.filter(ss => stagedSectionSubjects.includes(ss.id)).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium text-center">
                      <p>No subjects assigned. Drag subjects here.</p>
                    </div>
                  ) : (
                    sectionSubjects.filter(ss => stagedSectionSubjects.includes(ss.id)).map(ss => (
                      <div 
                        key={ss.id} 
                        draggable
                        onDragStart={(e) => handleAssignmentDragStart(e, ss.id)}
                        className="bg-white p-3 rounded-xl border border-indigo-200 shadow-sm hover:shadow hover:border-indigo-400 transition-all cursor-move active:cursor-grabbing border-l-4 border-l-indigo-500"
                      >
                        <div className="font-bold text-slate-800 text-sm">{ss.course.code} - {ss.course.name}</div>
                        <div className="text-xs font-medium text-slate-500 mt-1 flex items-center justify-between">
                          <span>{ss.section.department.code} Sec {ss.section.name || `${ss.section.year_level}A`}</span>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">{ss.course.has_lab ? 5 : ss.course.credits} hrs</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Panel: Available Subjects Checklist */}
              <div 
                className="w-full lg:w-1/2 bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex flex-col h-[700px]"
                onDragOver={handleAssignmentDragOver}
                onDrop={handleAssignmentDropToAvailable}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Available Subjects</h3>
                    <p className="text-sm text-slate-500 font-medium">Drag subjects to the instructor's load.</p>
                  </div>
                  <button
                    onClick={handleSaveAssignments}
                    disabled={isSavingAssignments || !selectedAssignmentInstructor}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {isSavingAssignments ? 'Saving...' : 'Save Assignments'}
                  </button>
                </div>

                {assignmentSuccess && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 font-semibold rounded-xl border border-emerald-100 shadow-sm">{assignmentSuccess}</div>}
                {assignmentError && <div className="mb-4 p-3 bg-red-50 text-red-700 font-semibold rounded-xl border border-red-100 shadow-sm">{assignmentError}</div>}

                <div className="mb-4">
                  <select 
                    value={selectedAssignmentCourse} 
                    onChange={(e) => setSelectedAssignmentCourse(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
                  >
                    <option value="">-- Filter by Subject --</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.code} - {course.name} (Year {course.year_level})</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-2xl border border-slate-200 p-4 space-y-3 custom-scrollbar border-dashed border-2 border-slate-300">
                  {!selectedAssignmentInstructor ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium text-center">
                      <p>Please select an instructor first.</p>
                    </div>
                  ) : filteredAssignmentSS.filter(ss => !stagedSectionSubjects.includes(ss.id)).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 font-medium text-center">
                      <p>{selectedAssignmentCourse ? "No available sections found." : "Select a subject filter to see available sections."}</p>
                    </div>
                  ) : (
                    filteredAssignmentSS.filter(ss => !stagedSectionSubjects.includes(ss.id)).map(ss => (
                      <div 
                        key={ss.id} 
                        draggable
                        onDragStart={(e) => handleAssignmentDragStart(e, ss.id)}
                        className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow hover:border-slate-400 transition-all cursor-move active:cursor-grabbing border-l-4 border-l-slate-400"
                      >
                        <div className="font-bold text-slate-800 text-sm">{ss.course.code} - {ss.course.name}</div>
                        <div className="text-xs font-medium text-slate-500 mt-1 flex items-center justify-between">
                          <span>{ss.section.department.code} Sec {ss.section.name || `${ss.section.year_level}A`}</span>
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{ss.course.has_lab ? 5 : ss.course.credits} hrs</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="p-4 h-[calc(100vh-200px)] min-h-[750px] flex flex-col lg:flex-row gap-6">
              
              {/* Sidebar for Unscheduled Classes */}
              <div className="w-full lg:w-72 bg-white p-5 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col h-full overflow-hidden shrink-0">
                 <h3 className="text-lg font-black text-slate-800 mb-1 tracking-tight">Unscheduled</h3>
                 <p className="text-xs text-slate-500 mb-4 font-medium">Drag and drop into a Room calendar.</p>
                 <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {unscheduledSubjects.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium text-center px-4">
                        All active subjects have been scheduled!
                      </div>
                    ) : (
                      unscheduledSubjects.map((ss: any) => (
                         <div
                           key={ss._renderId}
                           draggable
                           onDragStart={(e) => {
                             e.dataTransfer.setData('text/plain', ss.id.toString());
                             e.dataTransfer.effectAllowed = 'move';
                             setDraggedEvent(ss);
                           }}
                           onDragEnd={() => setDraggedEvent(null)}
                           onMouseEnter={() => setHoveredUnscheduled(ss)}
                           onMouseLeave={() => setHoveredUnscheduled(null)}
                           className="p-3 border border-slate-200 rounded-xl bg-slate-50 cursor-grab hover:border-indigo-400 hover:shadow-md transition-all active:cursor-grabbing group relative"
                         >
                           <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity flex flex-col gap-0.5">
                             <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                             <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                             <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                             <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                           </div>
                           <div className="pl-3">
                             <div className="font-bold text-indigo-900 text-sm leading-tight mb-1 flex items-center justify-between">
                               <span>{ss.course.code}</span>
                               <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                 ss.blockInfo.type === 'Laboratory' ? 'bg-orange-100 text-orange-700' :
                                 ss.blockInfo.type === 'Async' ? 'bg-emerald-100 text-emerald-700' :
                                 'bg-indigo-100 text-indigo-700'
                               }`}>
                                 {ss.blockInfo.type} ({ss.blockInfo.hours} hr)
                               </span>
                             </div>
                             <div className="text-xs text-slate-700 font-semibold mb-0.5">{ss.course.name}</div>
                             <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                               <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full">Sec {ss.section.name || 'A'}</span>
                               <span className="text-[10px] font-bold text-indigo-600 truncate max-w-[100px]">{ss.professor?.last_name || 'TBA'}</span>
                             </div>
                           </div>
                         </div>
                      ))
                    )}
                 </div>
              </div>

              {/* Main Calendar Area */}
              <div className="flex-1 flex flex-col h-full min-w-0">
                {/* Calendar Filters */}
                <div className="flex flex-wrap gap-4 mb-4 items-end bg-white/80 p-4 rounded-2xl border border-white shadow-sm">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">View Type</label>
                    <select 
                      value={calendarViewType} 
                      onChange={e => {
                        if (e.target.value === 'view_all_fullscreen') {
                          window.open('/master-schedule', '_blank');
                          return;
                        }
                        setCalendarViewType(e.target.value); 
                        setSelectedCalendarId(''); 
                      }}
                      className="block w-48 pl-3 pr-10 py-2 text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl shadow-sm border bg-slate-50 font-semibold text-slate-800 cursor-pointer"
                    >
                      <option value="room">Room Utilization</option>
                      <option value="instructor">Instructor Schedule</option>
                      <option value="section">Section Schedule</option>
                      <option value="view_all_fullscreen">View All (Full Screen)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Select {calendarViewType.charAt(0).toUpperCase() + calendarViewType.slice(1)}
                    </label>
                    <select 
                      value={selectedCalendarId} 
                      onChange={e => setSelectedCalendarId(e.target.value)}
                      className="block w-64 pl-3 pr-10 py-2 text-sm border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl shadow-sm border bg-slate-50 font-semibold text-slate-800 cursor-pointer"
                    >
                      <option value="">-- Select --</option>
                      {calendarViewType === 'room' && rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.building} - {r.room_number}</option>
                      ))}
                      {calendarViewType === 'instructor' && instructors.map(i => (
                        <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                      ))}
                      {calendarViewType === 'section' && sections.map(s => (
                        <option key={s.id} value={s.id}>{s.department?.code} - Yr {s.year_level} Sec {s.name || 'A'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!selectedCalendarId ? (
                  <div className="flex-grow flex items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-white/50 backdrop-blur-sm">
                    <div className="text-center p-8">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-semibold text-slate-500">Please select a {calendarViewType} from the dropdown to view its schedule.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-slate-50/80 border-b border-slate-100">
                      <h3 className="text-lg font-black text-indigo-900 tracking-tight">
                        {calendarViewType === 'room' && `Room Schedule: ${rooms.find(r => r.id.toString() === selectedCalendarId)?.room_number}`}
                        {calendarViewType === 'instructor' && `Instructor Schedule: ${instructors.find(i => i.id.toString() === selectedCalendarId)?.first_name} ${instructors.find(i => i.id.toString() === selectedCalendarId)?.last_name}`}
                        {calendarViewType === 'section' && `Section Schedule: ${sections.find(s => s.id.toString() === selectedCalendarId)?.department?.code} Yr ${sections.find(s => s.id.toString() === selectedCalendarId)?.year_level} Sec ${sections.find(s => s.id.toString() === selectedCalendarId)?.name || 'A'}`}
                      </h3>
                    </div>

                    <div className="flex-1 min-h-0 p-2 pb-0 relative">
                      <DnDCalendar
                        localizer={localizer}
                        events={calendarEvents}
                        onEventDrop={onEventDrop}
                        onEventResize={onEventDrop}
                        onDropFromOutside={onDropFromOutside}
                        dragFromOutsideItem={() => {
                          if (!draggedEvent) return {} as any;
                          return {
                            title: draggedEvent.course?.code,
                            resource: draggedEvent,
                          } as any;
                        }}
                        selectable={true}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        resizable
                        startAccessor={(event: any) => event.start}
                        endAccessor={(event: any) => event.end}
                        defaultView="week"
                        views={['week', 'day']}
                        toolbar={false}
                        formats={{
                          dayFormat: 'dddd' // Only show "Monday", "Tuesday", etc. (no date)
                        }}
                        eventPropGetter={(event: any, start: Date, end: Date) => {
                          if (event.is_recommendation) {
                            return { 
                              className: 'recommendation-event animate-pulse',
                              style: { background: 'transparent', border: 'none' } 
                            };
                          }
                          
                          const hasConflict = calendarEvents.some((otherEvent: any) => {
                            // Skip if comparing against the original slot of the event being dragged
                            if (otherEvent.resource?.id && event.resource?.id && otherEvent.resource.id === event.resource.id) return false;
                            
                            // Skip recommendations
                            if (otherEvent.is_recommendation) return false;
                            
                            return Math.max(start.getTime(), otherEvent.start.getTime()) < Math.min(end.getTime(), otherEvent.end.getTime());
                          });
    
                          const conflictClass = hasConflict ? 'has-conflict' : 'no-conflict';
    
                          const durationHours = end && start 
                            ? (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                            : 1.5;
                          
                          if (durationHours <= 1) {
                            return { className: `short-event ${conflictClass}` };
                          }
                          return { className: conflictClass };
                        }}
                        defaultDate={new Date(2026, 7, 24)} // Start on our template week Monday (Aug 24)
                        min={new Date(2026, 7, 24, 7, 30)} // Start calendar day at 7:30 AM
                        max={new Date(2026, 7, 24, 19, 0)} // End calendar day at 7 PM
                        step={30}
                        timeslots={2}
                        components={{
                          event: CustomEvent
                        }}
                        className="rounded-md border-0 bg-white h-full"
                      />
                    </div>
                    {calendarViewType === 'instructor' && instHours && (
                      <div className="flex items-center bg-indigo-50 border-t border-indigo-100 p-4 shadow-sm z-10 shrink-0">
                         <div className="flex-shrink-0 mr-8 w-32 border-r border-indigo-200/60 pr-4">
                           <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Total Load</div>
                           <div className="text-2xl font-black text-indigo-900 leading-none">{instHours.total}<span className="text-sm font-bold text-indigo-400 ml-1">hrs</span></div>
                         </div>
                         
                         <div className="flex-1 flex justify-between ml-[80px]"> {/* ML to approx align with the calendar time gutter which is usually ~80px */}
                           {[
                             { label: 'Mon', day: 24 },
                             { label: 'Tue', day: 25 },
                             { label: 'Wed', day: 26 },
                             { label: 'Thu', day: 27 },
                             { label: 'Fri', day: 28 },
                             { label: 'Sat', day: 29 },
                             { label: 'Sun', day: 30 },
                           ].map(d => (
                             <div key={d.day} className="text-center flex-1">
                               <div className="text-[10px] font-bold text-indigo-400/70 uppercase">{d.label}</div>
                               <div className={`text-lg font-black mt-0.5 ${instHours.hours[d.day as keyof typeof instHours.hours] > 0 ? 'text-indigo-900' : 'text-indigo-200'}`}>
                                 {instHours.hours[d.day as keyof typeof instHours.hours]}
                               </div>
                             </div>
                           ))}
                         </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Subject Instructor Assignments</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Section</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Instructor</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sectionSubjects.map((ss) => {
                      const isTBA = !ss.professor;
                      return (
                        <tr key={ss.id} className={isTBA ? "bg-amber-50 hover:bg-amber-100/50 transition-colors" : "hover:bg-gray-50 transition-colors"}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {ss.section.department.code} Yr {ss.section.year_level} Sec {ss.section.name || 'A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                            {ss.course.code}
                            <span className="block text-xs font-normal text-gray-500">{ss.course.name}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <select
                              value={ss.professor?.id || ''}
                              onChange={async (e) => {
                                const newProfId = e.target.value;
                                try {
                                  await axios.patch(`http://localhost:8000/api/section-subjects/${ss.id}/`, {
                                    professor_id: newProfId ? parseInt(newProfId) : null
                                  });
                                  fetchData(); // Refresh data to update calendar and lists
                                } catch (err) {
                                  toast.error('Failed to assign instructor.');
                                }
                              }}
                              className={`mt-1 block w-64 rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm border shadow-sm ${isTBA ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : 'bg-white text-gray-900'}`}
                            >
                              <option value="">-- TBA (Unassigned) --</option>
                              {instructors.map(inst => (
                                <option key={inst.id} value={inst.id}>{inst.first_name} {inst.last_name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {isTBA ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                Needs Assignment
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Assigned
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {sectionSubjects.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No subjects currently active for any section.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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

      {/* Delete Single Event Modal */}
      {isDeleteEventModalOpen && eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 transform transition-all">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Remove Schedule</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to remove <span className="font-bold text-indigo-700">{eventToDelete.title}</span>? 
              {eventToDelete.resource.is_custom ? " It will be permanently deleted." : " It will be returned to the Unscheduled list."}
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsDeleteEventModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteEvent}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm hover:shadow-md"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

          {/* Instructors Tab */}
          {activeTab === 'instructors' && (
            <div className="p-6">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Instructor Directory</h2>
                  <p className="text-sm text-slate-500">Manage all registered faculty members.</p>
                </div>
                <Link href="/admin/instructors/new" className="inline-block bg-indigo-50 text-indigo-600 font-semibold py-2 px-4 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors text-sm">
                  + Add Instructor
                </Link>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Instructor</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Sections</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {instructors.map((instructor) => {
                      const assignedSubjects = sectionSubjects.filter(ss => ss.professor && ss.professor.id === instructor.id);
                      return (
                        <tr key={instructor.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 shadow-sm group-hover:scale-105 transition-transform">
                                {instructor.first_name[0]}{instructor.last_name[0]}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-bold text-slate-900">{instructor.first_name} {instructor.last_name}</div>
                                <div className="text-sm text-slate-500">@{instructor.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">{instructor.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            {assignedSubjects.length > 0 ? (
                              <div className="flex flex-wrap gap-2 max-w-sm">
                                {assignedSubjects.map(ss => (
                                  <span key={ss.id} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    {ss.course.code} <span className="opacity-50 ml-1">({ss.section.department.code}{ss.section.year_level}{ss.section.name || 'A'})</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col space-y-2 items-start">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                              <button 
                                onClick={() => handleOpenAvailabilityModal(instructor)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                              >
                                Edit Availability &rarr;
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {instructors.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span className="font-medium">No instructors found.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <div className="p-6 space-y-10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Subjects Curriculum</h2>
                  <p className="text-sm text-slate-500">View and manage all offered subjects by year level.</p>
                </div>
                <Link href="/admin/courses/new" className="inline-block bg-indigo-50 text-indigo-600 font-semibold py-2 px-4 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors text-sm">
                  + Add Subject
                </Link>
              </div>

              {Object.keys(groupedCourses).length === 0 ? (
                <div className="text-center text-slate-400 py-10 font-medium">No courses found.</div>
              ) : (
                Object.keys(groupedCourses).sort().map(year => (
                  <div key={year} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50/80 backdrop-blur-sm px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center">
                        <span className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm mr-3 font-black shadow-sm">
                          Y{year}
                        </span>
                        Year Level {year}
                      </h3>
                      <span className="bg-slate-200/60 text-slate-600 font-bold px-3 py-1 rounded-full text-xs">
                        {groupedCourses[year].length} Subjects
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Course Code</th>
                            <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Department</th>
                            <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">Units</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                          {groupedCourses[year].map((course: any) => (
                            <tr key={course.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-indigo-900">{course.code}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">{course.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">{course.department?.name || 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-700">
                                <span className="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">{course.credits}</span>
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
            <div className="p-6">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Cohort Sections</h2>
                  <p className="text-sm text-slate-500">Student blocks available for scheduling.</p>
                </div>
                <Link href="/admin/sections/new" className="inline-block bg-indigo-50 text-indigo-600 font-semibold py-2 px-4 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors text-sm">
                  + Add Section
                </Link>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Section ID</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Term</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {sections.map((section) => (
                      <tr key={section.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs border border-indigo-200">
                              Y{section.year_level}
                            </div>
                            <span className="text-sm font-bold text-slate-900">Section {section.name || 'A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-600">
                          {section.department?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {section.term.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-700">{section.capacity}</td>
                      </tr>
                    ))}
                    {sections.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-sm font-medium text-slate-400">No sections found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <div className="p-6">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Facilities & Rooms</h2>
                  <p className="text-sm text-slate-500">Manage all available physical locations.</p>
                </div>
                <Link href="/admin/rooms/new" className="inline-block bg-indigo-50 text-indigo-600 font-semibold py-2 px-4 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors text-sm">
                  + Add Room
                </Link>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/80 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Capacity</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Features</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {rooms.map((room) => (
                      <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-slate-900">{room.room_number}</div>
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{room.building}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {room.room_type === 'LECTURE' ? (
                            <span className="px-3 py-1 inline-flex text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200">Lecture</span>
                          ) : (
                            <span className="px-3 py-1 inline-flex text-xs font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">Laboratory</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-slate-700">{room.capacity}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            {room.has_projector && <div className="bg-slate-100 text-slate-600 p-1.5 rounded-lg border border-slate-200 shadow-sm" title="Projector">📽️</div>}
                            {room.has_computers && <div className="bg-slate-100 text-slate-600 p-1.5 rounded-lg border border-slate-200 shadow-sm" title="Computers">💻</div>}
                            {!room.has_projector && !room.has_computers && <span className="text-xs font-bold text-slate-400 py-1.5">Standard</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rooms.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-sm font-medium text-slate-400">No rooms found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Departments & Terms Tab */}
          {activeTab === 'depts' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Departments */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="bg-slate-50/80 backdrop-blur-sm px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800">Departments</h3>
                  <Link href="/admin/departments/new" className="inline-block text-indigo-600 text-sm font-bold hover:text-indigo-800">+ Add</Link>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {departments.map(d => (
                    <div key={d.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all group flex items-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs mr-4 border border-indigo-100">
                        {d.code}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{d.name}</div>
                        <div className="text-xs text-slate-500 font-medium">Department Code: {d.code}</div>
                      </div>
                    </div>
                  ))}
                  {departments.length === 0 && <div className="py-10 text-center text-sm font-medium text-slate-400">No departments configured.</div>}
                </div>
              </div>
              
              {/* Terms */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="bg-slate-50/80 backdrop-blur-sm px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-800">Academic Terms</h3>
                  <Link href="/admin/terms/new" className="inline-block text-indigo-600 text-sm font-bold hover:text-indigo-800">+ Add</Link>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {terms.map(t => (
                    <div key={t.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-lg">{t.name}</div>
                        <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center">
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {t.start_date} <span className="mx-1 text-slate-300">&rarr;</span> {t.end_date}
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>
                    </div>
                  ))}
                  {terms.length === 0 && <div className="py-10 text-center text-sm font-medium text-slate-400">No terms configured.</div>}
                </div>
              </div>
            </div>
          )}

          </div>
          </div>
        </main>
      </div>

      {/* Instructor Availability Modal */}
      {availabilityModalInstructor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Edit Availability</h3>
              <button 
                onClick={() => setAvailabilityModalInstructor(null)}
                className="text-emerald-200 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm font-bold text-slate-800">{availabilityModalInstructor.first_name} {availabilityModalInstructor.last_name}</p>
                <p className="text-xs text-slate-500">Define when this instructor can be scheduled for classes.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Available Days</label>
                <div className="flex flex-wrap gap-2">
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => {
                    const isActive = availabilityDetails.activeDays.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          setAvailabilityDetails(prev => ({
                            ...prev,
                            activeDays: isActive 
                              ? prev.activeDays.filter(d => d !== day)
                              : [...prev.activeDays, day]
                          }))
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          isActive 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Preferred Window (Optional)</label>
                <p className="text-[11px] text-slate-500 mb-3">Leave blank if available all day on active days.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label>
                    <input 
                      type="time" 
                      value={availabilityDetails.startTime}
                      onChange={(e) => setAvailabilityDetails(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label>
                    <input 
                      type="time" 
                      value={availabilityDetails.endTime}
                      onChange={(e) => setAvailabilityDetails(prev => ({ ...prev, endTime: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setAvailabilityModalInstructor(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveAvailability}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
                >
                  Save Availability
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Schedule Modal */}
      {isCustomSlotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add Custom Schedule</h3>
              <button 
                onClick={() => setIsCustomSlotModalOpen(false)}
                className="text-indigo-200 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Custom Title <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={customSlotDetails.title}
                  onChange={(e) => setCustomSlotDetails(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Consultation Hours, Admin Duties"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1 custom-time-picker-wrapper">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Start Time</label>
                  <TimePicker 
                    value={moment(customSlotDetails.start as Date).format('HH:mm')}
                    onChange={(val: any) => {
                       if (!val) return;
                       const [hours, minutes] = val.split(':');
                       const newStart = new Date(customSlotDetails.start || new Date());
                       newStart.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
                       setCustomSlotDetails(prev => ({ ...prev, start: newStart }));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 font-medium text-slate-800"
                    disableClock={false}
                    clearIcon={null}
                  />
                </div>
                <div className="flex-1 custom-time-picker-wrapper">
                  <label className="block text-sm font-bold text-slate-700 mb-1">End Time</label>
                  <TimePicker 
                    value={moment(customSlotDetails.end as Date).format('HH:mm')}
                    onChange={(val: any) => {
                       if (!val) return;
                       const [hours, minutes] = val.split(':');
                       const newEnd = new Date(customSlotDetails.end || new Date());
                       newEnd.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
                       setCustomSlotDetails(prev => ({ ...prev, end: newEnd }));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 font-medium text-slate-800"
                    disableClock={false}
                    clearIcon={null}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-sm text-slate-800">Counts towards Total Hours</div>
                  <div className="text-xs text-slate-500">Include in instructor load calculations.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={customSlotDetails.countsTowardsHours} onChange={(e) => setCustomSlotDetails(prev => ({ ...prev, countsTowardsHours: e.target.checked }))} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-sm text-slate-800">Counts towards Total Units</div>
                  <div className="text-xs text-slate-500">Will prompt for unit value if enabled.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={customSlotDetails.countsTowardsUnits} onChange={(e) => setCustomSlotDetails(prev => ({ ...prev, countsTowardsUnits: e.target.checked }))} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {customSlotDetails.countsTowardsUnits && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Units Value</label>
                  <input 
                    type="number" 
                    step="0.5"
                    min="0"
                    value={customSlotDetails.unitsValue}
                    onChange={(e) => setCustomSlotDetails(prev => ({ ...prev, unitsValue: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsCustomSlotModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCustomSlot}
                  disabled={!customSlotDetails.title.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Custom Schedule Modal */}
      {isEditCustomSlotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Edit Custom Schedule</h3>
              <button 
                onClick={() => {
                  setIsEditCustomSlotModalOpen(false);
                  setEditingCustomSlotId(null);
                  setCustomSlotDetails({ title: '', countsTowardsHours: true, countsTowardsUnits: false, unitsValue: '0', start: null, end: null });
                }}
                className="text-indigo-200 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Schedule Title (e.g. Lunch Break, Duty)</label>
                <input 
                  type="text" 
                  value={customSlotDetails.title}
                  onChange={e => setCustomSlotDetails({...customSlotDetails, title: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="Enter title..."
                />
              </div>
              
              {customSlotDetails.start && customSlotDetails.end && (
                <>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center gap-3 mb-2">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][customSlotDetails.start.getDay()]}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 custom-time-picker-wrapper">
                      <label className="block text-sm font-bold text-slate-700 mb-1">Start Time</label>
                      <TimePicker 
                        value={moment(customSlotDetails.start as Date).format('HH:mm')}
                        onChange={(val: any) => {
                           if (!val) return;
                           const [hours, minutes] = val.split(':');
                           const newStart = new Date(customSlotDetails.start || new Date());
                           newStart.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
                           setCustomSlotDetails(prev => ({ ...prev, start: newStart }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 font-medium text-slate-800"
                        disableClock={false}
                        clearIcon={null}
                      />
                    </div>
                    <div className="flex-1 custom-time-picker-wrapper">
                      <label className="block text-sm font-bold text-slate-700 mb-1">End Time</label>
                      <TimePicker 
                        value={moment(customSlotDetails.end as Date).format('HH:mm')}
                        onChange={(val: any) => {
                           if (!val) return;
                           const [hours, minutes] = val.split(':');
                           const newEnd = new Date(customSlotDetails.end || new Date());
                           newEnd.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
                           setCustomSlotDetails(prev => ({ ...prev, end: newEnd }));
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 font-medium text-slate-800"
                        disableClock={false}
                        clearIcon={null}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-sm text-slate-800">Counts towards Total Hours</div>
                    <div className="text-xs text-slate-500">Include in instructor load calculations.</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={customSlotDetails.countsTowardsHours} onChange={e => setCustomSlotDetails({...customSlotDetails, countsTowardsHours: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-sm text-slate-800">Counts towards Total Units</div>
                    <div className="text-xs text-slate-500">Include in units calculations.</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={customSlotDetails.countsTowardsUnits} onChange={e => setCustomSlotDetails({...customSlotDetails, countsTowardsUnits: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {customSlotDetails.countsTowardsUnits && (
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-indigo-900 mb-1">Custom Units Value</label>
                    <input 
                      type="number" 
                      step="0.5"
                      value={customSlotDetails.unitsValue}
                      onChange={e => setCustomSlotDetails({...customSlotDetails, unitsValue: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                )}
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={handleDeleteCustomSlot}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl transition-colors"
                >
                  Delete
                </button>
                <button 
                  onClick={handleUpdateCustomSlot}
                  disabled={!customSlotDetails.title.trim()}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Pending Drop Modal */}
      {pendingDrop && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">Assign a Room</h3>
              <button onClick={() => setPendingDrop(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                You are scheduling <span className="font-bold text-indigo-700">{pendingDrop.subject.course.code}</span> for <span className="font-bold text-slate-800">{pendingDrop.day} {pendingDrop.start_time} - {pendingDrop.end_time}</span>. 
                Please select an available room:
              </p>
              
              <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2 mb-2">
                <div 
                  onClick={() => handleConfirmPendingDrop(null)}
                  className="p-3 border border-emerald-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-all flex justify-between items-center group bg-emerald-50/30"
                >
                  <div>
                    <div className="font-bold text-emerald-800 group-hover:text-emerald-900">Asynchronous (No Room)</div>
                    <div className="text-xs text-emerald-600">Schedule without consuming physical space</div>
                  </div>
                  <div className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-sm">
                    Select
                  </div>
                </div>
                
                {rooms.filter(room => {
                  const startParts = pendingDrop.start_time.split(':');
                  const endParts = pendingDrop.end_time.split(':');
                  const pStart = new Date(2000, 0, 1, parseInt(startParts[0]), parseInt(startParts[1])).getTime();
                  const pEnd = new Date(2000, 0, 1, parseInt(endParts[0]), parseInt(endParts[1])).getTime();
                  
                  return !rawCalendarEvents.some((slot: any) => {
                    if (slot.day_of_week !== pendingDrop.day) return false;
                    if (slot.room?.id !== room.id) return false;
                    const sParts = slot.start_time.split(':');
                    const eParts = slot.end_time.split(':');
                    const sStart = new Date(2000, 0, 1, parseInt(sParts[0]), parseInt(sParts[1])).getTime();
                    const sEnd = new Date(2000, 0, 1, parseInt(eParts[0]), parseInt(eParts[1])).getTime();
                    return Math.max(pStart, sStart) < Math.min(pEnd, sEnd);
                  });
                }).map(room => (
                  <div 
                    key={room.id}
                    onClick={() => handleConfirmPendingDrop(room.id)}
                    className="p-3 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer transition-all flex justify-between items-center group"
                  >
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-indigo-900">{room.room_number}</div>
                      <div className="text-xs text-slate-500">{room.room_type} • Cap: {room.capacity}</div>
                    </div>
                    <div className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold text-sm">
                      Select
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
