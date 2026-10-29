"use client";

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { downloadCSVTemplate } from '@/app/admin/dashboard/components/ImportCoursesModal';

const emptyCourse = {
  code: '',
  name: '',
  description: '',
  credits: 3,
  year_level: 1,
  semester: 1,
  has_lecture: true,
  has_lab: false,
};

export default function CourseRegistration() {
  const router = useRouter();

  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState(''); // Shared across multiple courses
  
  // Array of courses to be registered
  const [courses, setCourses] = useState([{ ...emptyCourse }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingCourses, setExistingCourses] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCourses = () => {
    axios.get('http://localhost:8000/api/courses/').then(res => setExistingCourses(res.data)).catch(console.error);
  };

  useEffect(() => {
    // Fetch departments on load
    axios.get('http://localhost:8000/api/departments/').then(res => setDepartments(res.data)).catch(console.error);
    fetchCourses();
  }, []);

  const handleCourseChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const newCourses = [...courses];
    
    if (type === 'checkbox') {
      newCourses[index] = { ...newCourses[index], [name]: (e.target as HTMLInputElement).checked };
    } else {
      newCourses[index] = { ...newCourses[index], [name]: value };
    }
    
    setCourses(newCourses);
  };

  const addCourseRow = () => {
    setCourses([...courses, { ...emptyCourse }]);
  };

  const removeCourseRow = (index: number) => {
    if (courses.length > 1) {
      setCourses(courses.filter((_, i) => i !== index));
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
          setError('CSV file must have a header row and at least one subject record.');
          return;
        }

        const parseLine = (line: string): string[] => {
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
        };

        const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
        const parsed: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseLine(lines[i]);
          if (values.length === 0 || values.every(v => !v.trim())) continue;

          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] ? values[idx].trim() : '';
          });

          const code = row['code'] || row['coursecode'] || row['subjectcode'] || '';
          const name = row['name'] || row['coursename'] || row['subjectname'] || row['title'] || '';
          if (!code && !name) continue;

          const credits = parseInt(row['credits'] || row['units'] || '3', 10) || 3;
          const year_level = Math.min(5, Math.max(1, parseInt(row['yearlevel'] || row['year'] || '1', 10) || 1));
          const rawSem = row['semester'] || row['sem'] || '1';
          const semester = (rawSem.includes('2') || rawSem.toLowerCase().includes('second')) ? 2 : 1;

          const rawLec = (row['haslecture'] || row['lecture'] || 'true').toLowerCase();
          const has_lecture = rawLec === 'true' || rawLec === 'yes' || rawLec === '1';

          const rawLab = (row['haslab'] || row['lab'] || 'false').toLowerCase();
          const has_lab = rawLab === 'true' || rawLab === 'yes' || rawLab === '1';

          parsed.push({
            code: code.toUpperCase(),
            name,
            description: '',
            credits,
            year_level,
            semester,
            has_lecture,
            has_lab,
          });
        }

        if (parsed.length > 0) {
          setCourses(parsed);
          setSuccess(`Successfully imported ${parsed.length} subject(s) from "${file.name}". You can review and edit each row below.`);
          setError('');
        } else {
          setError('No valid course rows found in CSV. Please verify column headers against the template.');
        }
      } catch (err) {
        setError('Failed to parse CSV file. Please verify file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId) {
      setError('Please select a department for these courses.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Register all courses sequentially
      for (const course of courses) {
        await axios.post('http://localhost:8000/api/courses/', {
          ...course,
          department_id: departmentId
        });
      }
      
      setSuccess(`Successfully registered ${courses.length} course(s)!`);
      setCourses([{ ...emptyCourse }]); // Reset form
      fetchCourses();
    } catch (err: any) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to register one or more courses.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      
      {/* Navbar back to dashboard */}
      <div className="max-w-5xl mx-auto mb-4 flex justify-between items-center">
         <Link href="/admin/dashboard?tab=courses" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1.5 transition-colors">
           &larr; Back to Subjects Curriculum
         </Link>
      </div>

      <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-xs border border-slate-200">
        
        {/* Header with Title & CSV Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Bulk Subject Registration</h2>
            <p className="text-sm text-slate-500 mt-1">Register multiple subjects into the curriculum or import directly from CSV.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3.5 py-2 rounded-lg border border-indigo-200 transition-colors text-xs cursor-pointer"
            >
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV
            </button>
            <button
              type="button"
              onClick={downloadCSVTemplate}
              className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold px-3.5 py-2 rounded-lg border border-slate-300 transition-colors text-xs cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Template
            </button>
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-semibold">{error}</div>}
        {success && <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm font-semibold">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Target Department (Applies to all below) <span className="text-red-500">*</span>
            </label>
            <select 
              required 
              value={departmentId} 
              onChange={e => setDepartmentId(e.target.value)} 
              className="block w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Select a Department...</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Subjects to Register ({courses.length})
              </span>
              {courses.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCourses([{ ...emptyCourse }])}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600"
                >
                  Clear all rows
                </button>
              )}
            </div>

            {courses.map((course, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3 p-4 border border-slate-200 rounded-xl bg-white relative hover:border-slate-300 transition-colors">
                
                {courses.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeCourseRow(index)} 
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-600 font-bold p-1 transition-colors"
                    title="Remove row"
                  >
                    &times;
                  </button>
                )}

                <div className="w-full sm:w-36">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Course Code</label>
                  <input type="text" name="code" required placeholder="e.g. CS101" value={course.code} onChange={(e) => handleCourseChange(index, e)} className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                
                <div className="w-full sm:w-auto flex-grow">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Name</label>
                  <input type="text" name="name" required placeholder="e.g. Computer Programming 1" value={course.name} onChange={(e) => handleCourseChange(index, e)} className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div className="w-20">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units</label>
                  <input type="number" name="credits" required min="1" max="12" value={course.credits} onChange={(e) => handleCourseChange(index, e)} className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>

                <div className="w-28">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Year Level</label>
                  <select name="year_level" required value={course.year_level} onChange={(e) => handleCourseChange(index, e)} className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                    <option value={5}>5th Year</option>
                  </select>
                </div>

                <div className="w-32">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                  <select name="semester" required value={course.semester} onChange={(e) => handleCourseChange(index, e)} className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer font-medium">
                    <option value={1}>1st Semester</option>
                    <option value={2}>2nd Semester</option>
                  </select>
                </div>

                <div className="flex items-center h-[36px] px-2 space-x-3">
                  <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" name="has_lecture" checked={course.has_lecture} onChange={(e) => handleCourseChange(index, e)} className="mr-1.5 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                    Lecture
                  </label>
                  <label className="flex items-center text-xs font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" name="has_lab" checked={course.has_lab} onChange={(e) => handleCourseChange(index, e)} className="mr-1.5 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                    Lab
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={addCourseRow}
              className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-lg shadow-2xs text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              + Add Another Course
            </button>
            <button
              type="submit"
              disabled={loading || !departmentId}
              className="inline-flex justify-center py-2.5 px-8 rounded-lg shadow-xs text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Registering...' : `Submit ${courses.length} Subject(s)`}
            </button>
          </div>
        </form>
      </div>

      {/* Catalog Table */}
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-xs border border-slate-200 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900">Existing Subject Catalog</h3>
          <span className="text-xs font-semibold text-slate-500">
            {existingCourses.length} registered subjects
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Semester</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Units</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Year Level</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-slate-800">
              {existingCourses.map(course => (
                <tr key={course.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm font-bold text-indigo-700">{course.code}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm font-medium text-slate-900">{course.name}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600">{course.department?.name || 'N/A'}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      course.semester === 2 
                        ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {course.semester === 2 ? '2nd Sem' : '1st Sem'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm font-semibold">{course.credits}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600">Year {course.year_level}</td>
                </tr>
              ))}
              {existingCourses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm font-medium text-slate-500">No subjects found in catalog.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

