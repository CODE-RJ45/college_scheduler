"use client";

import React, { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Department {
  id: number;
  name: string;
  code: string;
}

interface ParsedCourse {
  code: string;
  name: string;
  credits: number;
  year_level: number;
  semester: number;
  has_lecture: boolean;
  has_lab: boolean;
}

interface ImportCoursesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
  defaultSemester?: number;
}

// Clean CSV line parser handling quotes and commas
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

function parseCSV(text: string): ParsedCourse[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => 
    h.trim().toLowerCase().replace(/[\s_-]/g, '')
  );

  const results: ParsedCourse[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ? values[idx].trim() : '';
    });

    const code = row['code'] || row['coursecode'] || row['subjectcode'] || '';
    const name = row['name'] || row['coursename'] || row['subjectname'] || row['title'] || '';
    if (!code && !name) continue;

    const rawCredits = row['credits'] || row['units'] || row['credit'] || '3';
    const credits = parseInt(rawCredits, 10) || 3;

    const rawYear = row['yearlevel'] || row['year'] || row['level'] || '1';
    const year_level = Math.min(5, Math.max(1, parseInt(rawYear, 10) || 1));

    const rawSem = row['semester'] || row['sem'] || '1';
    let semester = 1;
    if (rawSem.includes('2') || rawSem.toLowerCase().includes('second')) {
      semester = 2;
    }

    const rawLec = (row['haslecture'] || row['lecture'] || row['lec'] || 'true').toLowerCase();
    const has_lecture = rawLec === 'true' || rawLec === 'yes' || rawLec === '1';

    const rawLab = (row['haslab'] || row['laboratory'] || row['lab'] || 'false').toLowerCase();
    const has_lab = rawLab === 'true' || rawLab === 'yes' || rawLab === '1';

    results.push({
      code: code.toUpperCase(),
      name,
      credits,
      year_level,
      semester,
      has_lecture,
      has_lab,
    });
  }

  return results;
}

export const downloadCSVTemplate = () => {
  const headers = ['code', 'name', 'credits', 'year_level', 'semester', 'has_lecture', 'has_lab'];
  const sampleRows = [
    ['IT101', 'Introduction to Computing', '3', '1', '1', 'true', 'false'],
    ['IT102', 'Computer Programming 1', '3', '1', '1', 'true', 'true'],
    ['IT103', 'Data Structures and Algorithms', '3', '1', '2', 'true', 'true'],
    ['IT201', 'Database Management Systems', '3', '2', '1', 'true', 'true'],
    ['IT202', 'Web Systems and Technologies', '3', '2', '2', 'true', 'true'],
  ];
  const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'subjects_curriculum_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function ImportCoursesModal({
  isOpen,
  onClose,
  onSuccess,
  departments,
  defaultSemester = 1,
}: ImportCoursesModalProps) {
  const [departmentId, setDepartmentId] = useState<number | ''>(
    departments.length > 0 ? departments[0].id : ''
  );
  const [parsedCourses, setParsedCourses] = useState<ParsedCourse[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a valid .csv file.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setError('No valid subject rows found in the CSV. Please ensure headers match the template.');
          setParsedCourses([]);
        } else {
          setParsedCourses(rows);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to parse CSV file. Please verify file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!departmentId) {
      setError('Please select a target department for the imported subjects.');
      return;
    }
    if (parsedCourses.length === 0) {
      setError('Please choose a CSV file with valid subject records.');
      return;
    }

    setImporting(true);
    setError('');

    let successCount = 0;
    const errors: string[] = [];

    for (const course of parsedCourses) {
      try {
        await axios.post('http://localhost:8000/api/courses/', {
          ...course,
          department_id: Number(departmentId),
        });
        successCount++;
      } catch (err: any) {
        const msg = err.response?.data?.detail 
          || (err.response?.data?.code && `${course.code}: ${err.response.data.code.join(' ')}`)
          || `${course.code}: Failed to register`;
        errors.push(msg);
      }
    }

    setImporting(false);

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} subject(s)!`);
      onSuccess();
      if (errors.length === 0) {
        onClose();
      } else {
        setError(`Imported ${successCount} subjects, but ${errors.length} failed: ${errors.slice(0, 3).join(', ')}`);
        // Remove successfully imported courses from list
        setParsedCourses(prev => prev.slice(successCount));
      }
    } else {
      setError(`Failed to import subjects: ${errors.slice(0, 3).join(', ')}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Import Subjects via CSV</h3>
            <p className="text-xs text-indigo-100 mt-0.5">Upload a curriculum spreadsheet to batch register courses</p>
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Department Selection & Template Download */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Target Department <span className="text-red-500">*</span>
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Need the standard format?
              </label>
              <button
                type="button"
                onClick={downloadCSVTemplate}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV Template
              </button>
            </div>
          </div>

          {/* CSV File Upload Box */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Select CSV File
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/20 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <svg className="w-8 h-8 text-indigo-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {fileName ? (
                <div>
                  <span className="text-sm font-bold text-slate-900">{fileName}</span>
                  <p className="text-xs text-indigo-600 font-semibold mt-0.5">
                    {parsedCourses.length} subject(s) detected • Click to choose a different file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Click to browse or drop your CSV file here
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Columns: code, name, credits, year_level, semester, has_lecture, has_lab
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Parsed Preview Table */}
          {parsedCourses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Preview ({parsedCourses.length} subjects found)
                </span>
                <span className="text-xs text-slate-500">
                  Semesters: {parsedCourses.filter(c => c.semester === 1).length} in 1st Sem, {parsedCourses.filter(c => c.semester === 2).length} in 2nd Sem
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Code</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Year</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Semester</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Units</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedCourses.slice(0, 15).map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 font-bold text-indigo-700">{c.code}</td>
                        <td className="px-3 py-1.5 font-medium text-slate-900 truncate max-w-[180px]">{c.name}</td>
                        <td className="px-3 py-1.5 text-slate-600">Y{c.year_level}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            c.semester === 2 ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {c.semester === 2 ? '2nd Sem' : '1st Sem'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">{c.credits}</td>
                        <td className="px-3 py-1.5 text-slate-500">
                          {c.has_lecture && 'Lec '}{c.has_lab && 'Lab'}
                        </td>
                      </tr>
                    ))}
                    {parsedCourses.length > 15 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-1.5 text-center text-slate-400 italic">
                          ... and {parsedCourses.length - 15} more subjects
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || parsedCourses.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {importing ? 'Importing Subjects...' : `Import ${parsedCourses.length} Subject(s)`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

