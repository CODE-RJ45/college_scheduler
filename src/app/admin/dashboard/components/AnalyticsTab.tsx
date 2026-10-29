"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AnalyticsTabProps {
  instructors: any[];
  courses: any[];
  sections: any[];
  rooms: any[];
  sectionSubjects: any[];
  scheduleSlots: any[];
  onClearAll: () => void;
  onExportCSV: () => void;
  onExportICS: () => void;
}

const calculateHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  return endH + endM / 60 - (startH + startM / 60);
};

export default function AnalyticsTab({
  instructors,
  courses,
  sections,
  rooms,
  sectionSubjects,
  scheduleSlots,
  onClearAll,
  onExportCSV,
  onExportICS,
}: AnalyticsTabProps) {
  // Facility utilization data
  const roomAnalyticsData = useMemo(() => {
    return rooms
      .map((room) => {
        const slots = scheduleSlots.filter((s) => s.room?.id === room.id);
        const totalHours = slots.reduce(
          (acc, slot) => acc + calculateHours(slot.start_time, slot.end_time),
          0
        );
        // Max 47.5 hours per week (7:30 to 17:00 for 5 days)
        const utilization = Math.min(100, Math.round((totalHours / 47.5) * 100));
        return {
          name: `${room.building} ${room.room_number}`,
          utilization,
          hours: parseFloat(totalHours.toFixed(1)),
        };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }, [rooms, scheduleSlots]);

  // Instructor teaching load data
  const instructorAnalyticsData = useMemo(() => {
    return instructors
      .map((inst) => {
        const slots = scheduleSlots.filter((s) => {
          if (s.is_custom && s.professor?.id === inst.id) return s.counts_towards_hours;
          return s.section_subject?.professor?.id === inst.id;
        });
        const totalHours = slots.reduce(
          (acc, slot) => acc + calculateHours(slot.start_time, slot.end_time),
          0
        );
        return {
          name: `${inst.first_name} ${inst.last_name}`,
          hours: parseFloat(totalHours.toFixed(1)),
          max: 30,
        };
      })
      .filter((d) => d.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }, [instructors, scheduleSlots]);

  // Unscheduled section subjects
  const unscheduledSectionSubjects = useMemo(() => {
    return sectionSubjects.filter((ss) => {
      const ssSlots = scheduleSlots.filter((slot) => slot.section_subject?.id === ss.id);
      const scheduledHours = ssSlots.reduce(
        (acc, slot) => acc + calculateHours(slot.start_time, slot.end_time),
        0
      );
      const targetHours = ss.course?.has_lab ? 5 : ss.course?.credits || 3;
      return scheduledHours < targetHours;
    });
  }, [sectionSubjects, scheduleSlots]);

  // Average room utilization
  const avgUtilization = useMemo(() => {
    if (roomAnalyticsData.length === 0) return 0;
    const sum = roomAnalyticsData.reduce((acc, r) => acc + r.utilization, 0);
    return Math.round(sum / roomAnalyticsData.length);
  }, [roomAnalyticsData]);

  return (
    <div className="p-5 space-y-6">
      {/* Scheduling Controls Header (Display only in Analytics) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl shadow-2xs border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Scheduling Controls</h2>
          <p className="text-slate-500 mt-0.5 text-xs">System operations, timetable exports, and algorithm launcher.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center px-3.5 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg font-semibold transition-colors text-xs cursor-pointer"
          >
            Clear All Schedules
          </button>
          <button
            type="button"
            onClick={onExportCSV}
            className="inline-flex items-center px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold transition-colors text-xs cursor-pointer"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={onExportICS}
            className="inline-flex items-center px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold transition-colors text-xs cursor-pointer"
          >
            Export ICS
          </button>
          <Link
            href="/admin/auto-schedule"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors text-xs"
          >
            Auto-Schedule Engine
          </Link>
        </div>
      </div>

      {/* Quick Stats Row (Display only in Analytics) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Instructors', value: instructors.length },
          { label: 'Total Subjects', value: courses.length },
          { label: 'Total Sections', value: sections.length },
          { label: 'Total Rooms', value: rooms.length },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
            <div className="text-3xl font-bold mt-2 text-slate-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Side-by-Side Compact Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Chart: Instructor Load */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Instructor Teaching Hours
              </h3>
              <p className="text-[11px] text-slate-500">Weekly contact hours per faculty member</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {instructorAnalyticsData.length} Assigned
            </span>
          </div>

          <div className="h-[210px] w-full">
            {instructorAnalyticsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={instructorAnalyticsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    angle={-25}
                    textAnchor="end"
                    height={40}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value} hrs`, 'Teaching Load']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="hours" radius={[3, 3, 0, 0]} barSize={18}>
                    {instructorAnalyticsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.hours > 24 ? '#ef4444' : entry.hours > 18 ? '#f59e0b' : '#4f46e5'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No instructor assignments scheduled yet.
              </div>
            )}
          </div>

          {/* Embedded Instructor Insight Strip */}
          {instructorAnalyticsData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Highest Load</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {instructorAnalyticsData[0].name} ({instructorAnalyticsData[0].hours} hrs)
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Lightest Load</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {instructorAnalyticsData[instructorAnalyticsData.length - 1].name} (
                  {instructorAnalyticsData[instructorAnalyticsData.length - 1].hours} hrs)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Chart: Facility Utilization */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Facility & Room Utilization
              </h3>
              <p className="text-[11px] text-slate-500">Percentage of operating hours utilized</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {roomAnalyticsData.length} Spaces
            </span>
          </div>

          <div className="h-[210px] w-full">
            {roomAnalyticsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={roomAnalyticsData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    stroke="#94a3b8"
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    stroke="#64748b"
                    tick={{ fontSize: 10, fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, 'Utilization']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="utilization" radius={[0, 3, 3, 0]} barSize={14}>
                    {roomAnalyticsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.utilization > 85 ? '#ef4444' : entry.utilization > 50 ? '#f59e0b' : '#10b981'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No room scheduling data available.
              </div>
            )}
          </div>

          {/* Embedded Room Insight Strip */}
          {roomAnalyticsData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Most Utilized</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {roomAnalyticsData[0].name} ({roomAnalyticsData[0].utilization}%)
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Least Utilized</span>
                <span className="font-bold text-slate-800 truncate block mt-0.5">
                  {roomAnalyticsData[roomAnalyticsData.length - 1].name} (
                  {roomAnalyticsData[roomAnalyticsData.length - 1].utilization}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel: Pending Timetable Allocations (Constrained Scroll) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Pending Timetable Allocations
            </h3>
            <span
              className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                unscheduledSectionSubjects.length === 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {unscheduledSectionSubjects.length} Pending
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Subjects with unscheduled hours
          </span>
        </div>

        {unscheduledSectionSubjects.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                    Subject Code
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                    Cohort
                  </th>
                  <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                    Assigned Faculty
                  </th>
                  <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase tracking-wider text-[10px]">
                    Scheduled / Target
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {unscheduledSectionSubjects.map((ss) => {
                  const ssSlots = scheduleSlots.filter((slot) => slot.section_subject?.id === ss.id);
                  const scheduledHours = ssSlots.reduce(
                    (acc, slot) => acc + calculateHours(slot.start_time, slot.end_time),
                    0
                  );
                  const targetHours = ss.course?.has_lab ? 5 : ss.course?.credits || 3;
                  return (
                    <tr key={ss.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-1.5 whitespace-nowrap font-bold text-indigo-700">
                        {ss.course?.code}{' '}
                        <span className="text-slate-500 font-normal text-[11px]">
                          ({ss.course?.name || ss.course?.title})
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-700 font-medium">
                        {ss.section?.department?.code} {ss.section?.name || `${ss.section?.year_level}A`}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">
                        {ss.professor ? (
                          `${ss.professor.first_name} ${ss.professor.last_name}`
                        ) : (
                          <span className="text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-right">
                        <span className="font-bold text-amber-600">{scheduledHours}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="font-bold text-slate-700">{targetHours} hrs</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
            <span className="font-bold text-emerald-800">100% Complete: </span>
            <span className="text-emerald-700">
              Every curriculum subject is fully scheduled on the active timetable.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
