"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SectionGeneration() {
  const router = useRouter();

  const [departments, setDepartments] = useState([]);
  const [terms, setTerms] = useState([]);

  const [formData, setFormData] = useState({
    department_id: '',
    term_id: '',
  });

  const [sectionCounts, setSectionCounts] = useState({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingSections, setExistingSections] = useState<any[]>([]);

  const fetchSections = () => {
    axios.get('http://localhost:8000/api/sections/').then(res => setExistingSections(res.data)).catch(console.error);
  };

  useEffect(() => {
    // Fetch departments and terms on load
    axios.get('http://localhost:8000/api/departments/').then(res => setDepartments(res.data)).catch(console.error);
    axios.get('http://localhost:8000/api/terms/').then(res => setTerms(res.data)).catch(console.error);
    fetchSections();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSectionCountChange = (year: number, value: string) => {
    setSectionCounts({ ...sectionCounts, [year]: parseInt(value) || 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Prepare sections distribution payload
    const sections_distribution = Object.entries(sectionCounts)
      .map(([year, count]) => ({
        year_level: parseInt(year),
        count: count,
        capacity: 30 // default capacity
      }))
      .filter(dist => dist.count > 0);

    if (sections_distribution.length === 0) {
      setError('Please specify at least one section to generate.');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('http://localhost:8000/api/sections/bulk-create/', {
        ...formData,
        sections_distribution
      });
      setSuccess(response.data.message || 'Sections successfully generated!');
      setSectionCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      fetchSections();
    } catch (err: any) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to generate sections.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      {/* Navbar back to dashboard */}
      <div className="max-w-3xl mx-auto mb-4">
        <Link href="/admin/dashboard?tab=sections" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1.5 transition-colors">
          &larr; Back to Student Sections
        </Link>
      </div>
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-xs border border-slate-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Bulk Generate Sections</h2>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Department</label>
              <select name="department_id" required value={formData.department_id} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black bg-white">
                <option value="">Select a Department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Term</label>
              <select name="term_id" required value={formData.term_id} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black bg-white">
                <option value="">Select a Term</option>
                {terms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Section Generation per Year Level</h3>
            <p className="text-sm text-gray-500 mb-4">Specify how many sections you want to open for each year level. Enter 0 if no sections are needed.</p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map(year => (
                <div key={year}>
                  <label className="block text-xs font-medium text-gray-700">{year}{year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year</label>
                  <input
                    type="number"
                    min="0"
                    value={sectionCounts[year as keyof typeof sectionCounts]}
                    onChange={(e) => handleSectionCountChange(year, e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Sections'}
          </button>
        </form>
      </div>

      <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 mt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Generated Sections (Cohorts)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year Level</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-black">
              {existingSections.map(sec => (
                <tr key={sec.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">Section {sec.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{sec.department.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{sec.term.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">Year {sec.year_level}</td>
                </tr>
              ))}
              {existingSections.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No sections found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
