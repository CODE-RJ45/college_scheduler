"use client";

import React, { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface ParsedFaculty {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password?: string;
  status?: 'pending' | 'success' | 'error';
  errorMessage?: string;
}

interface ImportFacultyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): ParsedFaculty[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => 
    h.trim().toLowerCase().replace(/[\s_-]/g, '')
  );

  const results: ParsedFaculty[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ? values[idx].trim() : '';
    });

    const firstName = row['firstname'] || row['first'] || row['givenname'] || '';
    const lastName = row['lastname'] || row['last'] || row['surname'] || '';
    if (!firstName && !lastName) continue;

    const username = row['username'] || `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, '');
    const email = row['email'] || `${username}@college.edu`;
    const password = row['password'] || 'Password123!';

    results.push({
      firstName,
      lastName,
      username,
      email,
      password,
      status: 'pending',
    });
  }

  return results;
}

export default function ImportFacultyModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportFacultyModalProps) {
  const [parsedItems, setParsedItems] = useState<ParsedFaculty[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent = 
`first_name,last_name,email,username,password
Maria,Santos,maria.santos@college.edu,maria.santos,Password123!
Juan,Dela Cruz,juan.delacruz@college.edu,juan.delacruz,Password123!
Elena,Reyes,elena.reyes@college.edu,elena.reyes,Password123!
Robert,Lim,robert.lim@college.edu,robert.lim,Password123!`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'faculty_roster_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast.error('No valid faculty records found in CSV. Please verify file format.');
      } else {
        setParsedItems(parsed);
        toast.success(`Parsed ${parsed.length} faculty record(s). Ready for import.`);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedItems.length === 0) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;
    const updated = [...parsedItems];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      try {
        await axios.post('http://localhost:8000/api/instructor-registration/', {
          first_name: item.firstName,
          last_name: item.lastName,
          username: item.username,
          email: item.email,
          password: item.password || 'Password123!',
          section_subject_ids: [],
        });
        item.status = 'success';
        successCount++;
      } catch (err: any) {
        item.status = 'error';
        const data = err.response?.data;
        let errStr = 'Registration error';
        if (data && typeof data === 'object') {
          errStr = Object.entries(data)
            .map(([k, v]) => (Array.isArray(v) ? `${k}: ${v.join(' ')}` : `${k}: ${v}`))
            .join(' | ');
        }
        item.errorMessage = errStr;
        failCount++;
      }
      setParsedItems([...updated]);
    }

    setLoading(false);
    setImportResults({ success: successCount, failed: failCount });

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} faculty member(s)!`);
      onSuccess();
    }
    if (failCount > 0) {
      toast.error(`${failCount} record(s) failed. See status below.`);
    }
  };

  const handleReset = () => {
    setParsedItems([]);
    setFileName('');
    setImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Batch Import Faculty Roster</h3>
            <p className="text-xs text-slate-300 mt-0.5">Upload a CSV file to bulk-register professors</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Template Download & Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Standard CSV Template</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Headers: <code className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded">first_name, last_name, email, username</code>
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* File Upload Zone */}
          {parsedItems.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-indigo-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Click or drag CSV file here</p>
              <p className="text-[11px] text-slate-400 mt-1">Accepts standard .csv file up to 5MB</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-700">File:</span>
                  <span className="font-mono text-indigo-700 font-bold">{fileName}</span>
                  <span className="text-slate-400">({parsedItems.length} records)</span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Faculty Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Username</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {item.firstName} {item.lastName}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">{item.username}</td>
                        <td className="px-3 py-2 text-slate-600">{item.email}</td>
                        <td className="px-3 py-2 text-center">
                          {item.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">Ready</span>
                          )}
                          {item.status === 'success' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">Imported</span>
                          )}
                          {item.status === 'error' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700" title={item.errorMessage}>
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {importResults && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Import Completed:</span>
                  <div className="space-x-3">
                    <span className="text-emerald-700 font-bold">✓ {importResults.success} Succeeded</span>
                    {importResults.failed > 0 && (
                      <span className="text-rose-700 font-bold">✕ {importResults.failed} Failed</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            {importResults ? 'Done' : 'Cancel'}
          </button>
          {parsedItems.length > 0 && !importResults && (
            <button
              type="button"
              onClick={handleImport}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Importing...' : `Import ${parsedItems.length} Faculty`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
