"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Term {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
}

interface TermModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  termToEdit?: Term | null;
}

export default function TermModal({
  isOpen,
  onClose,
  onSuccess,
  termToEdit,
}: TermModalProps) {
  const isEditing = Boolean(termToEdit);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (termToEdit) {
      setName(termToEdit.name);
      setStartDate(termToEdit.start_date || '');
      setEndDate(termToEdit.end_date || '');
      setIsActive(Boolean(termToEdit.is_active));
    } else {
      setName('');
      setStartDate('');
      setEndDate('');
      setIsActive(false);
    }
    setError('');
  }, [termToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Term name is required.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Both start and end dates are required.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
      };

      if (isEditing && termToEdit) {
        await axios.put(`http://localhost:8000/api/terms/${termToEdit.id}/`, payload);
        toast.success(`Term "${payload.name}" updated successfully!`);
      } else {
        await axios.post('http://localhost:8000/api/terms/', payload);
        toast.success(`Term "${payload.name}" created successfully!`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving term:', err);
      const detail = err.response?.data?.name?.[0] || 
                     err.response?.data?.start_date?.[0] || 
                     err.response?.data?.end_date?.[0] || 
                     err.response?.data?.detail || 
                     'Failed to save academic term.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <h3 className="text-base font-bold text-white">
              {isEditing ? 'Edit Academic Term' : 'Create New Academic Term'}
            </h3>
            <p className="text-xs text-indigo-100">
              {isEditing ? `Update semester details for ${termToEdit?.name}` : 'Set semester schedule duration & operational parameters'}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Term Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. 1st Semester 2026-2027 or Fall 2026"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium text-slate-800 transition-colors placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium text-slate-800 transition-colors cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                End Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium text-slate-800 transition-colors cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <input
              id="is_active_checkbox"
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="is_active_checkbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
              Mark as active operational semester
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Save Changes' : 'Create Term'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

