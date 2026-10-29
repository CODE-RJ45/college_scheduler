"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Term {
  id: number;
  name: string;
  is_active: boolean;
}

interface Section {
  id: number;
  name: string | null;
  year_level: number;
  capacity: number;
  department: Department;
  term: Term;
}

interface SectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
  terms: Term[];
  sectionToEdit?: Section | null;
  defaultTermId?: number;
}

export default function SectionModal({
  isOpen,
  onClose,
  onSuccess,
  departments,
  terms,
  sectionToEdit,
  defaultTermId,
}: SectionModalProps) {
  const isEditing = Boolean(sectionToEdit);

  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [termId, setTermId] = useState<number | ''>('');
  const [yearLevel, setYearLevel] = useState<number>(1);
  const [name, setName] = useState<string>('A');
  const [capacity, setCapacity] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (sectionToEdit) {
        setDepartmentId(sectionToEdit.department?.id || (departments[0]?.id ?? ''));
        setTermId(sectionToEdit.term?.id || (terms[0]?.id ?? ''));
        setYearLevel(sectionToEdit.year_level || 1);
        setName(sectionToEdit.name || 'A');
        setCapacity(sectionToEdit.capacity || 30);
      } else {
        setDepartmentId(departments[0]?.id ?? '');
        const activeTerm = terms.find(t => t.is_active);
        setTermId(defaultTermId || activeTerm?.id || terms[0]?.id || '');
        setYearLevel(1);
        setName('A');
        setCapacity(30);
      }
      setError('');
    }
  }, [isOpen, sectionToEdit, departments, terms, defaultTermId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId) {
      setError('Please select an academic department.');
      return;
    }
    if (!termId) {
      setError('Please select an academic term.');
      return;
    }
    if (!name.trim()) {
      setError('Section identifier name is required (e.g. "A", "B", "1").');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = {
        department_id: Number(departmentId),
        term_id: Number(termId),
        year_level: Number(yearLevel),
        name: name.trim().toUpperCase(),
        capacity: Number(capacity),
      };

      if (isEditing && sectionToEdit) {
        await axios.patch(`http://localhost:8000/api/sections/${sectionToEdit.id}/`, payload);
        toast.success(`Section ${name.trim().toUpperCase()} updated successfully!`);
      } else {
        await axios.post('http://localhost:8000/api/sections/', payload);
        toast.success(`Section ${name.trim().toUpperCase()} created successfully!`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail 
        || (err.response?.data?.non_field_errors && err.response.data.non_field_errors.join(' '))
        || 'Failed to save section. Please verify input fields.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              {isEditing ? 'Edit Cohort Section' : 'Create Cohort Section'}
            </h3>
            <p className="text-xs text-indigo-100 mt-0.5">
              {isEditing ? 'Update student block parameters' : 'Register a new student cohort for class scheduling'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Collegiate Department <span className="text-red-500">*</span>
            </label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.code} - {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Term */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Academic Term / Semester <span className="text-red-500">*</span>
            </label>
            <select
              value={termId}
              onChange={e => setTermId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
            >
              {terms.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_active ? '(Active Semester)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Year Level & Section Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Year Level <span className="text-red-500">*</span>
              </label>
              <select
                value={yearLevel}
                onChange={e => setYearLevel(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
                <option value={5}>5th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Section Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. A, B, 1, 2"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                autoFocus
              />
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Student Capacity (Seats) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={capacity}
              onChange={e => setCapacity(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">Used by timetable solver to enforce room capacity limits.</p>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Section')}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

