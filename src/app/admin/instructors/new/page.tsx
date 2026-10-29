"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface InstructorForm {
  firstName: string;
  lastName: string;
}

export default function InstructorRegistration() {
  const router = useRouter();
  const [instructorsList, setInstructorsList] = useState<InstructorForm[]>([
    { firstName: '', lastName: '' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [existingInstructors, setExistingInstructors] = useState<any[]>([]);

  const fetchData = () => {
    axios.get('http://localhost:8000/api/users/')
      .then((usersRes) => {
        const professors = usersRes.data.filter((u: any) => u.role === 'PROFESSOR');
        setExistingInstructors(professors);
      })
      .catch(err => console.error('Failed to fetch data', err));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddRow = () => {
    setInstructorsList([...instructorsList, { firstName: '', lastName: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    const newList = [...instructorsList];
    newList.splice(index, 1);
    setInstructorsList(newList);
  };

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const newList = [...instructorsList];
    newList[index] = {
      ...newList[index],
      [e.target.name]: e.target.value
    };
    setInstructorsList(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate empty
    if (instructorsList.some(i => !i.firstName.trim() || !i.lastName.trim())) {
      setError('Please fill in all first and last names.');
      setLoading(false);
      return;
    }

    try {
      const requests = instructorsList.map(instructor => {
        const generatedUsername = `${instructor.firstName}.${instructor.lastName}`.toLowerCase().replace(/\s+/g, '');
        const generatedEmail = `${generatedUsername}@college.edu`;
        const defaultPassword = 'Password123!';

        return axios.post('http://localhost:8000/api/instructor-registration/', {
          first_name: instructor.firstName,
          last_name: instructor.lastName,
          username: generatedUsername,
          email: generatedEmail,
          password: defaultPassword,
          section_subject_ids: [], // Not assigning subjects during bulk registration
        });
      });

      const results = await Promise.allSettled(requests);
      
      const successfulIndexes: number[] = [];
      const errorMessages: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulIndexes.push(index);
        } else {
          const errData = result.reason?.response?.data;
          let msg = `Row ${index + 1}:`;
          if (errData && typeof errData === 'object') {
            const details = Object.entries(errData).map(([k, v]) => {
              if (Array.isArray(v)) return `${k}: ${v.join(' ')}`;
              return `${k}: ${v}`;
            }).join(' | ');
            msg += ` ${details}`;
          } else {
            msg += ' Unknown error';
          }
          errorMessages.push(msg);
        }
      });

      if (errorMessages.length === 0) {
        setSuccess(`Successfully registered all ${instructorsList.length} instructor(s)!`);
        setInstructorsList([{ firstName: '', lastName: '' }]); // Reset form
      } else {
        // Keep only failed rows in the form
        const remaining = instructorsList.filter((_, i) => !successfulIndexes.includes(i));
        setInstructorsList(remaining.length > 0 ? remaining : [{ firstName: '', lastName: '' }]);
        
        if (successfulIndexes.length > 0) {
          setSuccess(`Successfully registered ${successfulIndexes.length} instructor(s).`);
        }
        setError(errorMessages.join('\n'));
      }
      
      fetchData();
    } catch (err: any) {
      setError('An unexpected error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      {/* Navbar back to dashboard */}
      <div className="max-w-4xl mx-auto mb-4">
        <Link href="/admin/dashboard?tab=instructors" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1.5 transition-colors">
          &larr; Back to Faculty Roster
        </Link>
      </div>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-xs border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Bulk Instructor Registration</h2>
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            + Add Another Instructor
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md whitespace-pre-wrap font-sans">
            {error}
          </div>
        )}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {instructorsList.map((instructor, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-md border border-gray-200">
              <div className="col-span-1 text-center text-gray-500 font-medium mb-2">
                #{index + 1}
              </div>
              <div className="col-span-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input 
                  type="text" 
                  name="firstName" 
                  required 
                  value={instructor.firstName} 
                  onChange={(e) => handleChange(index, e)} 
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" 
                  placeholder="e.g. John"
                />
              </div>
              <div className="col-span-5">
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input 
                  type="text" 
                  name="lastName" 
                  required 
                  value={instructor.lastName} 
                  onChange={(e) => handleChange(index, e)} 
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" 
                  placeholder="e.g. Doe"
                />
              </div>
              <div className="col-span-1 text-center">
                {instructorsList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(index)}
                    className="mb-2 text-red-500 hover:text-red-700 p-2"
                    title="Remove Instructor"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Registering Instructors...' : `Register ${instructorsList.length} Instructor${instructorsList.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 mt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Registered Instructors</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-black">
              {existingInstructors.map(instructor => (
                <tr key={instructor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{instructor.first_name} {instructor.last_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{instructor.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{instructor.username}</td>
                </tr>
              ))}
              {existingInstructors.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No instructors found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
