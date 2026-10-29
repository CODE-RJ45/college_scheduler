"use client";

import React from 'react';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';

interface CustomSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEdit: boolean;
  details: {
    title: string;
    countsTowardsHours: boolean;
    countsTowardsUnits: boolean;
    unitsValue: string;
    start: Date | null;
    end: Date | null;
  };
  setDetails: React.Dispatch<
    React.SetStateAction<{
      title: string;
      countsTowardsHours: boolean;
      countsTowardsUnits: boolean;
      unitsValue: string;
      start: Date | null;
      end: Date | null;
    }>
  >;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function CustomSlotModal({
  isOpen,
  onClose,
  isEdit,
  details,
  setDetails,
  onSave,
  onDelete,
}: CustomSlotModalProps) {
  if (!isOpen) return null;

  const handleStartTimeChange = (val: string | null) => {
    if (!val || !details.start) return;
    const [hours, minutes] = val.split(':').map(Number);
    const newStart = new Date(details.start);
    newStart.setHours(hours, minutes, 0, 0);
    setDetails((prev) => ({ ...prev, start: newStart }));
  };

  const handleEndTimeChange = (val: string | null) => {
    if (!val || !details.end) return;
    const [hours, minutes] = val.split(':').map(Number);
    const newEnd = new Date(details.end);
    newEnd.setHours(hours, minutes, 0, 0);
    setDetails((prev) => ({ ...prev, end: newEnd }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {isEdit ? 'Edit Custom Faculty Block' : 'Add Custom Faculty Block'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200/50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[10px]">
              Block Title / Activity
            </label>
            <input
              type="text"
              placeholder="e.g. Faculty Consultation, Department Meeting"
              value={details.title}
              onChange={(e) => setDetails({ ...details, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[10px]">
                Start Time
              </label>
              <TimePicker
                value={
                  details.start
                    ? `${details.start.getHours().toString().padStart(2, '0')}:${details.start
                        .getMinutes()
                        .toString()
                        .padStart(2, '0')}`
                    : '08:00'
                }
                onChange={handleStartTimeChange}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs"
                disableClock={true}
                clearIcon={null}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[10px]">
                End Time
              </label>
              <TimePicker
                value={
                  details.end
                    ? `${details.end.getHours().toString().padStart(2, '0')}:${details.end
                        .getMinutes()
                        .toString()
                        .padStart(2, '0')}`
                    : '09:30'
                }
                onChange={handleEndTimeChange}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg text-xs"
                disableClock={true}
                clearIcon={null}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <span className="text-slate-800 font-semibold">Counts Toward Working Hours</span>
              <input
                type="checkbox"
                checked={details.countsTowardsHours}
                onChange={(e) => setDetails({ ...details, countsTowardsHours: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
              <span className="text-slate-800 font-semibold">Counts Toward Faculty Load Units</span>
              <input
                type="checkbox"
                checked={details.countsTowardsUnits}
                onChange={(e) => setDetails({ ...details, countsTowardsUnits: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
            </label>

            {details.countsTowardsUnits && (
              <div className="pt-1">
                <label className="block text-slate-700 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Custom Equivalent Units
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={details.unitsValue}
                  onChange={(e) => setDetails({ ...details, unitsValue: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-semibold"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="mr-auto text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-300 hover:bg-white transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!details.title.trim()}
            className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isEdit ? 'Save Changes' : 'Create Block'}
          </button>
        </div>
      </div>
    </div>
  );
}

