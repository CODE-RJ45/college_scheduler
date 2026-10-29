"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departmentToEdit?: Department | null;
}

export default function DepartmentModal({
  isOpen,
  onClose,
  onSuccess,
  departmentToEdit,
}: DepartmentModalProps) {
  const isEditing = Boolean(departmentToEdit);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (departmentToEdit) {
      setName(departmentToEdit.name);
      setCode(departmentToEdit.code);
    } else {
      setName('');
      setCode('');
    }
    setError('');
  }, [departmentToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Both Department Name and Code are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
      };

      if (isEditing && departmentToEdit) {
        await axios.put(`http://localhost:8000/api/departments/${departmentToEdit.id}/`, payload);
        toast.success(`Department "${payload.code}" updated successfully!`);
      } else {
        await axios.post('http://localhost:8000/api/departments/', payload);
        toast.success(`Department "${payload.code}" created successfully!`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving department:', err);
      const detail = err.response?.data?.name?.[0] || 
                     err.response?.data?.code?.[0] || 
                     err.response?.data?.detail || 
                     'Failed to save department. Ensure Code and Name are unique.';
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
              {isEditing ? 'Edit Department' : 'Create New Department'}
            </h3>
            <p className="text-xs text-indigo-100">
              {isEditing ? `Update details for ${departmentToEdit?.code}` : 'Register an academic department or collegiate faculty'}
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
              Department Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. College of Computer Studies"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium text-slate-800 transition-colors placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Department Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={10}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. CCS"
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold text-slate-800 transition-colors placeholder:text-slate-400 uppercase tracking-wider"
            />
            <p className="text-[11px] text-slate-500 mt-1">Short unique code used across sections and schedules.</p>
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
                isEditing ? 'Save Changes' : 'Create Department'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

