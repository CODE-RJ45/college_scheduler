"use client";

import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import RoomModal, { Room } from './RoomModal';
import RoomDetailDrawer from './RoomDetailDrawer';
import DeleteConfirmModal from './DeleteConfirmModal';
import Link from 'next/link';

interface RoomsTabProps {
  rooms: Room[];
  scheduleSlots: any[];
  fetchData: () => Promise<void> | void;
  setActiveTab: (tab: string) => void;
  setCalendarViewType: (view: string) => void;
  setSelectedCalendarId: (id: string) => void;
}

export default function RoomsTab({
  rooms,
  scheduleSlots,
  fetchData,
  setActiveTab,
  setCalendarViewType,
  setSelectedCalendarId,
}: RoomsTabProps) {
  // --- Modals & Drawer State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null);
  const [selectedRoomForDrawer, setSelectedRoomForDrawer] = useState<Room | null>(null);
  
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Search & Filters ---
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LECTURE' | 'LABORATORY'>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [filterProjector, setFilterProjector] = useState(false);
  const [filterComputers, setFilterComputers] = useState(false);

  // Extract unique building names
  const existingBuildings = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      if (r.building) set.add(r.building.trim());
    });
    return Array.from(set).sort();
  }, [rooms]);

  // Compute scheduled hours per room
  const roomLoadMap = useMemo(() => {
    const map: Record<number, { count: number; hours: number }> = {};
    rooms.forEach((r) => {
      if (r.id) map[r.id] = { count: 0, hours: 0 };
    });

    scheduleSlots.forEach((slot) => {
      if (slot.room && slot.room.id && map[slot.room.id]) {
        map[slot.room.id].count += 1;
        if (slot.start_time && slot.end_time) {
          const [sh, sm] = slot.start_time.split(':').map(Number);
          const [eh, em] = slot.end_time.split(':').map(Number);
          const duration = (eh * 60 + em - (sh * 60 + sm)) / 60;
          if (duration > 0) {
            map[slot.room.id].hours += duration;
          }
        }
      }
    });

    return map;
  }, [rooms, scheduleSlots]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalRooms = rooms.length;
    const lectureRooms = rooms.filter((r) => r.room_type === 'LECTURE');
    const labRooms = rooms.filter((r) => r.room_type === 'LABORATORY');
    const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
    const lectureCapacity = lectureRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
    const labCapacity = labRooms.reduce((acc, r) => acc + (r.capacity || 0), 0);

    let totalScheduledHours = 0;
    Object.values(roomLoadMap).forEach((load) => {
      totalScheduledHours += load.hours;
    });

    const totalAvailableHours = totalRooms * 50; // 50-hour standard institutional capacity
    const avgUtilization = totalAvailableHours > 0
      ? Math.round((totalScheduledHours / totalAvailableHours) * 100)
      : 0;

    return {
      totalRooms,
      buildingCount: existingBuildings.length,
      lectureCount: lectureRooms.length,
      lectureCapacity,
      labCount: labRooms.length,
      labCapacity,
      totalCapacity,
      avgUtilization,
      totalScheduledHours: totalScheduledHours.toFixed(1),
    };
  }, [rooms, existingBuildings, roomLoadMap]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchNum = (room.room_number || '').toLowerCase().includes(query);
        const matchBldg = (room.building || '').toLowerCase().includes(query);
        if (!matchNum && !matchBldg) return false;
      }

      if (typeFilter !== 'ALL' && room.room_type !== typeFilter) {
        return false;
      }

      if (buildingFilter !== 'ALL' && room.building !== buildingFilter) {
        return false;
      }

      if (filterProjector && !room.has_projector) return false;
      if (filterComputers && !room.has_computers) return false;

      return true;
    });
  }, [rooms, searchQuery, typeFilter, buildingFilter, filterProjector, filterComputers]);

  const handleCalendarJump = (roomId: number) => {
    setCalendarViewType('room');
    setSelectedCalendarId(roomId.toString());
    setActiveTab('calendar');
  };

  const handleEditRoom = (room: Room) => {
    setRoomToEdit(room);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete || !roomToDelete.id) return;
    setIsDeleting(true);

    try {
      await axios.delete(`http://localhost:8000/api/rooms/${roomToDelete.id}/`);
      toast.success(`Room "${roomToDelete.room_number}" deleted successfully.`);
      setRoomToDelete(null);
      if (selectedRoomForDrawer?.id === roomToDelete.id) {
        setSelectedRoomForDrawer(null);
      }
      await fetchData();
    } catch (err: any) {
      console.error('Failed to delete room:', err);
      toast.error('Failed to delete room. It might be referenced in schedule records.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-slate-900">Rooms & Facilities</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {filteredRooms.length} {filteredRooms.length === 1 ? 'Room' : 'Rooms'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Physical room inventory, seating capacities, technical amenities, and scheduled timetable loads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setRoomToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Room</span>
          </button>

          <Link
            href="/admin/rooms/new"
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
          >
            <span>Batch Register &rarr;</span>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Facilities</span>
            <span className="text-xs font-bold text-indigo-600">{summaryMetrics.buildingCount} Buildings</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.totalRooms}</span>
            <span className="text-xs text-slate-400">Physical Rooms</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Lecture Halls</span>
            <span className="text-xs font-bold text-blue-600">{summaryMetrics.lectureCapacity} Seats</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.lectureCount}</span>
            <span className="text-xs text-slate-400">Classrooms</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Laboratories</span>
            <span className="text-xs font-bold text-purple-600">{summaryMetrics.labCapacity} Lab Seats</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.labCount}</span>
            <span className="text-xs text-slate-400">Computer / Science</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Campus Utilization</span>
            <span className="text-xs font-bold text-emerald-600">{summaryMetrics.totalScheduledHours}h Sched</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{summaryMetrics.avgUtilization}%</span>
            <span className="text-xs text-slate-400">{summaryMetrics.totalCapacity} Total Seats</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search room or building..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center space-x-1 border border-slate-200 p-0.5 rounded-lg bg-slate-50">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('LECTURE')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                typeFilter === 'LECTURE'
                  ? 'bg-white text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lecture ({summaryMetrics.lectureCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('LABORATORY')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                typeFilter === 'LABORATORY'
                  ? 'bg-white text-purple-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Laboratory ({summaryMetrics.labCount})
            </button>
          </div>

          {/* Building Filter Dropdown */}
          {existingBuildings.length > 1 && (
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Buildings ({existingBuildings.length})</option>
              {existingBuildings.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}

          {/* Amenities Filters */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setFilterProjector(!filterProjector)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                filterProjector
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Projector
            </button>

            <button
              type="button"
              onClick={() => setFilterComputers(!filterComputers)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                filterComputers
                  ? 'bg-purple-50 border-purple-200 text-purple-700 font-semibold'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Computers
            </button>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-semibold text-slate-900">{filteredRooms.length}</span> of {rooms.length} facilities
        </div>
      </div>

      {/* Rooms Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Room & Location
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Facility Type
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Capacity
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Equipment
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Weekly Utilization
              </th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredRooms.map((room) => {
              const load = room.id ? (roomLoadMap[room.id] || { count: 0, hours: 0 }) : { count: 0, hours: 0 };
              const utilPercent = Math.min(100, Math.round((load.hours / 50) * 100));

              return (
                <tr
                  key={room.id}
                  onClick={() => setSelectedRoomForDrawer(room)}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                >
                  {/* Location */}
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-bold text-indigo-700 group-hover:text-indigo-900 transition-colors">
                        {room.room_number}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {room.building}
                      </div>
                    </div>
                  </td>

                  {/* Room Type */}
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    {room.room_type === 'LABORATORY' ? (
                      <span className="px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        Laboratory
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        Lecture Room
                      </span>
                    )}
                  </td>

                  {/* Capacity */}
                  <td className="px-6 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-800">
                    {room.capacity} seats
                  </td>

                  {/* Amenities */}
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      {room.has_projector && (
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded border border-slate-200">
                          Projector
                        </span>
                      )}
                      {room.has_computers && (
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded border border-slate-200">
                          Computers
                        </span>
                      )}
                      {!room.has_projector && !room.has_computers && (
                        <span className="text-xs text-slate-400">
                          Standard
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Utilization Bar */}
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="min-w-[130px] space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-700">
                          {load.hours.toFixed(1)} hrs/wk
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            utilPercent > 70
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : utilPercent > 35
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {utilPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            utilPercent > 70
                              ? 'bg-rose-500'
                              : utilPercent > 35
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${utilPercent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Action Buttons */}
                  <td className="px-6 py-3.5 whitespace-nowrap text-right text-xs">
                    <div
                      className="flex items-center justify-end space-x-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedRoomForDrawer(room)}
                        className="px-2 py-1 font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                        title="Inspect room timetable and occupancy"
                      >
                        Inspect
                      </button>

                      <button
                        type="button"
                        onClick={() => room.id && handleCalendarJump(room.id)}
                        className="px-2 py-1 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition cursor-pointer"
                        title="View room schedule on calendar"
                      >
                        Calendar
                      </button>

                      <Link
                        href={`/timetable?view=room&id=${room.id}`}
                        className="px-2 py-1 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                        title="Open full printable timetable"
                      >
                        Timetable
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleEditRoom(room)}
                        className="px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                        title="Edit room specifications"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setRoomToDelete(room)}
                        className="px-2 py-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                        title="Delete room"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredRooms.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-500 space-y-2">
                  <p className="font-semibold text-slate-700">No rooms match your filter criteria.</p>
                  <p className="text-slate-400">Try adjusting your search terms or clearing the filters.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setTypeFilter('ALL');
                      setBuildingFilter('ALL');
                      setFilterProjector(false);
                      setFilterComputers(false);
                    }}
                    className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Room Modal */}
      <RoomModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setRoomToEdit(null);
        }}
        onSuccess={fetchData}
        roomToEdit={roomToEdit}
        existingBuildings={existingBuildings}
      />

      {/* Room Detail Drawer */}
      <RoomDetailDrawer
        isOpen={Boolean(selectedRoomForDrawer)}
        onClose={() => setSelectedRoomForDrawer(null)}
        room={selectedRoomForDrawer}
        scheduleSlots={scheduleSlots}
        onEdit={(room) => {
          setSelectedRoomForDrawer(null);
          handleEditRoom(room);
        }}
        onDelete={(room) => {
          setSelectedRoomForDrawer(null);
          setRoomToDelete(room);
        }}
        onViewCalendar={(roomId) => handleCalendarJump(roomId)}
      />

      {/* Delete Confirmation Modal */}
      {roomToDelete && (
        <DeleteConfirmModal
          isOpen={Boolean(roomToDelete)}
          onClose={() => setRoomToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Facility / Room"
          itemName={`${roomToDelete.room_number} (${roomToDelete.building})`}
          itemType="Room"
          dependencyCount={{
            slots: roomToDelete.id ? (roomLoadMap[roomToDelete.id]?.count || 0) : 0,
          }}
          loading={isDeleting}
        />
      )}

    </div>
  );
}
