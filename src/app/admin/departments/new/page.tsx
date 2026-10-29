"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DepartmentRegistration() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
  });
  const [existingDepartments, setExistingDepartments] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchDepartments = () => {
    axios.get('http://localhost:8000/api/departments/').then(res => setExistingDepartments(res.data)).catch(console.error);
  };


  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('http://localhost:8000/api/departments/', formData);
      setSuccess('Department successfully created!');
      setFormData({ name: '', code: '' });
      fetchDepartments();
    } catch (err: any) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to create department.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      {/* Navbar back to dashboard */}
      <div className="max-w-xl mx-auto mb-4">
        <Link href="/admin/dashboard?tab=depts" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1.5 transition-colors">
          &larr; Back to Departments & Terms
        </Link>
      </div>
      <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-xs border border-slate-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Department</h2>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Department Name</label>
            <input type="text" name="name" required value={formData.name} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black" placeholder="e.g. College of Computer Studies" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Department Code</label>
            <input type="text" name="code" required value={formData.code} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black" placeholder="e.g. CCS" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Department'}
          </button>
        </form>
      </div>

      <div className="max-w-xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 mt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Registered Departments</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-black">
              {existingDepartments.map(dept => (
                <tr key={dept.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{dept.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{dept.name}</td>
                </tr>
              ))}
              {existingDepartments.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">No departments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
