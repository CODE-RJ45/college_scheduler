"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface FacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  facultyToEdit?: any | null;
}

export default function FacultyModal({
  isOpen,
  onClose,
  onSuccess,
  facultyToEdit,
}: FacultyModalProps) {
  const isEditing = Boolean(facultyToEdit);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [isCustomUsername, setIsCustomUsername] = useState(false);
  const [isCustomEmail, setIsCustomEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (facultyToEdit) {
        setFirstName(facultyToEdit.first_name || '');
        setLastName(facultyToEdit.last_name || '');
        setUsername(facultyToEdit.username || '');
        setEmail(facultyToEdit.email || '');
        setPassword('');
        setIsCustomUsername(true);
        setIsCustomEmail(true);
      } else {
        setFirstName('');
        setLastName('');
        setUsername('');
        setEmail('');
        setPassword('Password123!');
        setIsCustomUsername(false);
        setIsCustomEmail(false);
      }
      setError('');
    }
  }, [isOpen, facultyToEdit]);

  // Auto-generate username and email on name change if not manually edited
  const handleFirstNameChange = (val: string) => {
    setFirstName(val);
    if (!isEditing && !isCustomUsername) {
      const generated = `${val.trim().toLowerCase()}.${lastName.trim().toLowerCase()}`.replace(/\s+/g, '');
      setUsername(generated);
      if (!isCustomEmail) setEmail(generated ? `${generated}@college.edu` : '');
    }
  };

  const handleLastNameChange = (val: string) => {
    setLastName(val);
    if (!isEditing && !isCustomUsername) {
      const generated = `${firstName.trim().toLowerCase()}.${val.trim().toLowerCase()}`.replace(/\s+/g, '');
      setUsername(generated);
      if (!isCustomEmail) setEmail(generated ? `${generated}@college.edu` : '');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (!isEditing && !password.trim()) {
      setError('Password is required for registration.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isEditing && facultyToEdit) {
        const payload: any = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
        };
        if (password.trim()) {
          payload.password = password.trim();
        }
        await axios.patch(`http://localhost:8000/api/users/${facultyToEdit.id}/`, payload);
        toast.success(`Faculty member ${firstName} ${lastName} updated successfully.`);
      } else {
        const payload = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          username: username.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          password: password.trim(),
          section_subject_ids: [],
        };
        await axios.post('http://localhost:8000/api/instructor-registration/', payload);
        toast.success(`Faculty member ${firstName} ${lastName} registered successfully.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const data = err.response?.data;
      let msg = 'Failed to save faculty record.';
      if (data && typeof data === 'object') {
        const errors = Object.entries(data).map(([k, v]) => {
          if (Array.isArray(v)) return `${k}: ${v.join(' ')}`;
          return `${k}: ${v}`;
        });
        msg = errors.join(' | ');
      }
      setError(msg);
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
              {isEditing ? 'Edit Faculty Member' : 'Register Faculty Member'}
            </h3>
            <p className="text-xs text-indigo-100 mt-0.5">
              {isEditing ? 'Update instructor profile details' : 'Add an instructor to the academic faculty roster'}
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maria"
                value={firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Santos"
                value={lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Username
            </label>
            <input
              type="text"
              required
              placeholder="e.g. maria.santos"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setIsCustomUsername(true);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Institutional Email
            </label>
            <input
              type="email"
              required
              placeholder="e.g. maria.santos@college.edu"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setIsCustomEmail(true);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              {isEditing ? 'New Password (Optional)' : 'Password'}
            </label>
            <input
              type="password"
              placeholder={isEditing ? 'Leave blank to preserve password' : 'Enter account password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {!isEditing && (
              <p className="text-[11px] text-slate-400 mt-1">Default: Password123!</p>
            )}
          </div>

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
              {loading ? 'Saving...' : isEditing ? 'Update Faculty' : 'Register Faculty'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
