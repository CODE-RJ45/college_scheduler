"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export interface Room {
  id?: number;
  building: string;
  room_number: string;
  room_type: 'LECTURE' | 'LABORATORY';
  capacity: number;
  has_projector: boolean;
  has_computers: boolean;
}

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  roomToEdit?: Room | null;
  existingBuildings?: string[];
}

export default function RoomModal({
  isOpen,
  onClose,
  onSuccess,
  roomToEdit,
  existingBuildings = [],
}: RoomModalProps) {
  const isEditing = Boolean(roomToEdit && roomToEdit.id);

  const [formData, setFormData] = useState<Room>({
    building: '',
    room_number: '',
    room_type: 'LECTURE',
    capacity: 35,
    has_projector: false,
    has_computers: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (roomToEdit) {
      setFormData({
        id: roomToEdit.id,
        building: roomToEdit.building || '',
        room_number: roomToEdit.room_number || '',
        room_type: roomToEdit.room_type || 'LECTURE',
        capacity: roomToEdit.capacity || 35,
        has_projector: Boolean(roomToEdit.has_projector),
        has_computers: Boolean(roomToEdit.has_computers),
      });
    } else {
      setFormData({
        building: existingBuildings[0] || 'Main Building',
        room_number: '',
        room_type: 'LECTURE',
        capacity: 35,
        has_projector: false,
        has_computers: false,
      });
    }
    setError('');
  }, [roomToEdit, isOpen, existingBuildings]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.building.trim()) {
      setError('Building name is required.');
      return;
    }

    if (!formData.room_number.trim()) {
      setError('Room number / identifier is required.');
      return;
    }

    if (!formData.capacity || formData.capacity <= 0) {
      setError('Capacity must be greater than zero.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        building: formData.building.trim(),
        room_number: formData.room_number.trim(),
        room_type: formData.room_type,
        capacity: Number(formData.capacity),
        has_projector: formData.has_projector,
        has_computers: formData.has_computers,
      };

      if (isEditing && roomToEdit?.id) {
        await axios.put(`http://localhost:8000/api/rooms/${roomToEdit.id}/`, payload);
        toast.success(`Room ${payload.room_number} updated successfully.`);
      } else {
        await axios.post('http://localhost:8000/api/rooms/', payload);
        toast.success(`Room ${payload.room_number} registered successfully.`);
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Room save error:', err);
      const detail =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        (err.response?.data?.room_number ? `Room Number: ${err.response.data.room_number[0]}` : null) ||
        'Failed to save room. Check for duplicate room in this building.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? `Edit Room ${roomToEdit?.room_number}` : 'Add Room'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing ? 'Modify physical room specifications and amenities.' : 'Register a new institutional lecture or laboratory room.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Building Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Building / Complex <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="building-suggestions"
                required
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                placeholder="e.g. Main Building"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <datalist id="building-suggestions">
                {existingBuildings.map((b, idx) => (
                  <option key={idx} value={b} />
                ))}
              </datalist>
            </div>

            {/* Room Identifier */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Number / Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                placeholder="e.g. Lab 301, Rm 204"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Room Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Room Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.room_type}
                onChange={(e) => setFormData({ ...formData, room_type: e.target.value as 'LECTURE' | 'LABORATORY' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="LECTURE">Lecture Room / Classroom</option>
                <option value="LABORATORY">Laboratory Room (Computers / Science)</option>
              </select>
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Capacity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 0 })}
                placeholder="35"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Equipment & Features */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Technical Equipment & Amenities
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition select-none ${
                  formData.has_projector
                    ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.has_projector}
                  onChange={(e) => setFormData({ ...formData, has_projector: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold block">Projector / Smart Display</span>
                  <span className="text-[11px] text-slate-500 font-normal">Equipped for multimedia presentation</span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition select-none ${
                  formData.has_computers
                    ? 'border-purple-400 bg-purple-50/50 text-purple-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.has_computers}
                  onChange={(e) => setFormData({ ...formData, has_computers: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold block">Computer Terminals</span>
                  <span className="text-[11px] text-slate-500 font-normal">PC workstations for students</span>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Room'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
