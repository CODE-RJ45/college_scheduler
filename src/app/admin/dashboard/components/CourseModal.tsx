"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
  defaultSemester?: number;
}

export default function CourseModal({
  isOpen,
  onClose,
  onSuccess,
  departments,
  defaultSemester = 1,
}: CourseModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [yearLevel, setYearLevel] = useState<number>(1);
  const [semester, setSemester] = useState<number>(defaultSemester);
  const [credits, setCredits] = useState<number>(3);
  const [hasLecture, setHasLecture] = useState<boolean>(true);
  const [hasLab, setHasLab] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setName('');
      setYearLevel(1);
      setSemester(defaultSemester || 1);
      setCredits(3);
      setHasLecture(true);
      setHasLab(false);
      setError('');
      if (departments.length > 0) {
        setDepartmentId(departments[0].id);
      }
    }
  }, [isOpen, defaultSemester, departments]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Course code and course name are required.');
      return;
    }
    if (!departmentId) {
      setError('Please select an academic department.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post('http://localhost:8000/api/courses/', {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        department_id: Number(departmentId),
        year_level: Number(yearLevel),
        semester: Number(semester),
        credits: Number(credits),
        has_lecture: hasLecture,
        has_lab: hasLab,
      });

      toast.success(`Subject "${code.toUpperCase()}" registered successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail 
        || (err.response?.data?.code && `Code error: ${err.response.data.code.join(' ')}`)
        || 'Failed to register subject. Please check inputs.';
      setError(detail);
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
            <h3 className="text-base font-bold text-white">Add Academic Subject</h3>
            <p className="text-xs text-indigo-100 mt-0.5">Register a course curriculum unit into the catalog</p>
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

        {/* Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Code & Credits */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Course Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. CS101, IT204"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Units <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={credits}
                onChange={e => setCredits(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Course Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Subject Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Fundamentals of Database Systems"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Department <span className="text-red-500">*</span>
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

          {/* Year Level & Semester */}
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
                Semester Tag <span className="text-red-500">*</span>
              </label>
              <select
                value={semester}
                onChange={e => setSemester(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium"
              >
                <option value={1}>1st Semester</option>
                <option value={2}>2nd Semester</option>
              </select>
            </div>
          </div>

          {/* Component Types */}
          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Class Components
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLecture}
                  onChange={e => setHasLecture(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                Lecture Component
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLab}
                  onChange={e => setHasLab(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                Laboratory Component
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
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
              {loading ? 'Registering...' : 'Add Subject'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

