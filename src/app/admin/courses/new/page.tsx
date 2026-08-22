"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const emptyCourse = {
  code: '',
  name: '',
  description: '',
  credits: 3,
  year_level: 1,
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Navbar back to dashboard */}
      <div className="max-w-5xl mx-auto mb-4">
         <Link href="/admin/dashboard" className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
           &larr; Back to Dashboard
         </Link>
      </div>

      <div className="max-w-5xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Bulk Course Registration</h2>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <label className="block text-sm font-bold text-gray-900 mb-2">Target Department (Applies to all below)</label>
            <select required value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-black bg-white">
              <option value="">Select a Department...</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="space-y-4">
            {courses.map((course, index) => (
              <div key={index} className="flex flex-wrap items-end gap-4 p-4 border border-gray-200 rounded-md bg-white relative">
                
                {courses.length > 1 && (
                  <button type="button" onClick={() => removeCourseRow(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold px-2">
                    &times;
                  </button>
                )}

                <div className="w-full sm:w-auto flex-grow">
                  <label className="block text-xs font-medium text-gray-700">Course Code</label>
                  <input type="text" name="code" required placeholder="e.g. CS101" value={course.code} onChange={(e) => handleCourseChange(index, e)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black text-sm" />
                </div>
                
                <div className="w-full sm:w-auto flex-grow-[2]">
                  <label className="block text-xs font-medium text-gray-700">Subject Name</label>
                  <input type="text" name="name" required placeholder="Intro to Programming" value={course.name} onChange={(e) => handleCourseChange(index, e)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black text-sm" />
                </div>

                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-700">Units</label>
                  <input type="number" name="credits" required min="1" value={course.credits} onChange={(e) => handleCourseChange(index, e)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black text-sm" />
                </div>

                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700">Year Level</label>
                  <select name="year_level" required value={course.year_level} onChange={(e) => handleCourseChange(index, e)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black bg-white text-sm">
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                    <option value={5}>5th Year</option>
                  </select>
                </div>

                <div className="flex items-center h-[38px] px-2 space-x-4">
                  <label className="flex items-center text-sm text-gray-700">
                    <input type="checkbox" name="has_lecture" checked={course.has_lecture} onChange={(e) => handleCourseChange(index, e)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                    Lecture
                  </label>
                  <label className="flex items-center text-sm text-gray-700">
                    <input type="checkbox" name="has_lab" checked={course.has_lab} onChange={(e) => handleCourseChange(index, e)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                    Lab
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={addCourseRow}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              + Add Another Course
            </button>
            <button
              type="submit"
              disabled={loading || !departmentId}
              className="inline-flex justify-center py-2 px-8 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Registering...' : `Submit ${courses.length} Course(s)`}
            </button>
          </div>
        </form>
      </div>

      <div className="max-w-5xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 mt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Existing Course Catalog</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year Level</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-black">
              {existingCourses.map(course => (
                <tr key={course.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{course.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{course.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.department?.name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{course.credits}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">Year {course.year_level}</td>
                </tr>
              ))}
              {existingCourses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No subjects found in catalog.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
