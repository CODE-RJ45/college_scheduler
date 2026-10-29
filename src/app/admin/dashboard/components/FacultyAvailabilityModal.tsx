"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface FacultyAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  instructor: any | null;
}

const ALL_DAYS = [
  { code: 'MON', label: 'Monday' },
  { code: 'TUE', label: 'Tuesday' },
  { code: 'WED', label: 'Wednesday' },
  { code: 'THU', label: 'Thursday' },
  { code: 'FRI', label: 'Friday' },
  { code: 'SAT', label: 'Saturday' },
  { code: 'SUN', label: 'Sunday' },
];

export default function FacultyAvailabilityModal({
  isOpen,
  onClose,
  onSuccess,
  instructor,
}: FacultyAvailabilityModalProps) {
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && instructor) {
      if (instructor.available_days) {
        const days = instructor.available_days
          .split(',')
          .map((d: string) => d.trim().toUpperCase())
          .filter(Boolean);
        setActiveDays(days);
      } else {
        setActiveDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
      }

      setStartTime(instructor.available_start_time ? instructor.available_start_time.substring(0, 5) : '');
      setEndTime(instructor.available_end_time ? instructor.available_end_time.substring(0, 5) : '');
      setMaxHoursPerWeek(instructor.max_hours_per_week || 30);
      setError('');
    }
  }, [isOpen, instructor]);

  if (!isOpen || !instructor) return null;

  const toggleDay = (day: string) => {
    if (activeDays.includes(day)) {
      setActiveDays(activeDays.filter((d) => d !== day));
    } else {
      setActiveDays([...activeDays, day]);
    }
  };

  // Presets
  const applyPreset = (preset: 'fulltime' | 'morning' | 'afternoon' | 'allweek') => {
    switch (preset) {
      case 'fulltime':
        setActiveDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
        setStartTime('08:00');
        setEndTime('17:00');
        break;
      case 'morning':
        setActiveDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
        setStartTime('07:00');
        setEndTime('12:00');
        break;
      case 'afternoon':
        setActiveDays(['MON', 'TUE', 'WED', 'THU', 'FRI']);
        setStartTime('13:00');
        setEndTime('18:00');
        break;
      case 'allweek':
        setActiveDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
        setStartTime('');
        setEndTime('');
        break;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeDays.length === 0) {
      setError('Please select at least one available teaching day.');
      return;
    }

    if ((startTime && !endTime) || (!startTime && endTime)) {
      setError('Both start time and end time must be specified for a preferred time window, or both left blank.');
      return;
    }

    if (startTime && endTime && startTime >= endTime) {
      setError('Start time must be earlier than end time.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        available_days: activeDays.join(','),
        available_start_time: startTime ? `${startTime}:00` : null,
        available_end_time: endTime ? `${endTime}:00` : null,
        max_hours_per_week: Number(maxHoursPerWeek) || 30,
      };

      await axios.patch(`http://localhost:8000/api/users/${instructor.id}/`, payload);
      toast.success(`Availability updated for ${instructor.first_name} ${instructor.last_name}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to update availability schedule.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Faculty Availability Window</h3>
            <p className="text-xs text-indigo-100 mt-0.5">
              Configure teaching constraints for timetable auto-scheduling
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-indigo-200 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Instructor Context */}
          <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
              {instructor.first_name?.[0] || 'P'}
              {instructor.last_name?.[0] || 'R'}
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block">
                {instructor.first_name} {instructor.last_name}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                @{instructor.username} &bull; {instructor.email}
              </span>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Fast Shift Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('fulltime')}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition text-slate-700 cursor-pointer"
              >
                Mon–Fri 8–5
              </button>
              <button
                type="button"
                onClick={() => applyPreset('morning')}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition text-slate-700 cursor-pointer"
              >
                Morning 7–12
              </button>
              <button
                type="button"
                onClick={() => applyPreset('afternoon')}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition text-slate-700 cursor-pointer"
              >
                Afternoon 1–6
              </button>
              <button
                type="button"
                onClick={() => applyPreset('allweek')}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition text-slate-700 cursor-pointer"
              >
                Full Week
              </button>
            </div>
          </div>

          {/* Active Days Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Available Teaching Days
              </span>
              <span className="text-xs text-slate-400">
                {activeDays.length} of 7 days selected
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {ALL_DAYS.map((d) => {
                const isSelected = activeDays.includes(d.code);
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => toggleDay(d.code)}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{d.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Time Window */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Daily Available Hours Window
              </span>
              {(startTime || endTime) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartTime('');
                    setEndTime('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer font-medium"
                >
                  Clear (All Day)
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              The scheduling engine will not assign classes outside this daily window. Leave blank for unrestricted hours.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Max Teaching Hours / Week */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Max Teaching Hours / Week
              </span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {maxHoursPerWeek} hrs/week limit
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Maximum contact hours per week allowed for this instructor. Displayed in Course Assignments to track workload capacity and overloads.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="60"
                value={maxHoursPerWeek}
                onChange={(e) => setMaxHoursPerWeek(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="w-28 text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-bold focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="flex items-center gap-1.5 text-xs">
                {[18, 24, 30, 40].map((quickHrs) => (
                  <button
                    key={quickHrs}
                    type="button"
                    onClick={() => setMaxHoursPerWeek(quickHrs)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer ${
                      maxHoursPerWeek === quickHrs
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {quickHrs}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Apply Availability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
