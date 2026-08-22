"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const emptyRoom = {
  room_number: '',
  room_type: 'LECTURE',
  capacity: 30,
  has_projector: false,
  has_computers: false,
};

export default function RoomRegistration() {
  const router = useRouter();

  const [building, setBuilding] = useState('');
  const [rooms, setRooms] = useState([{ ...emptyRoom }]);
  
  const [existingRooms, setExistingRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchRooms = () => {
    axios.get('http://localhost:8000/api/rooms/').then(res => setExistingRooms(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleRoomChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const newRooms = [...rooms];
    
    if (type === 'checkbox') {
      newRooms[index] = { ...newRooms[index], [name]: (e.target as HTMLInputElement).checked };
    } else {
      newRooms[index] = { ...newRooms[index], [name]: value };
    }
    
    setRooms(newRooms);
  };

  const addRoomRow = () => {
    setRooms([...rooms, { ...emptyRoom }]);
  };

  const removeRoomRow = (index: number) => {
    if (rooms.length > 1) {
      setRooms(rooms.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!building.trim()) {
      setError('Please enter a building name for these rooms.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      for (const room of rooms) {
        await axios.post('http://localhost:8000/api/rooms/', {
          ...room,
          building: building.trim()
        });
      }
      
      setSuccess(`Successfully registered ${rooms.length} room(s)!`);
      setRooms([{ ...emptyRoom }]);
      fetchRooms();
    } catch (err: any) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to register one or more rooms.');
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
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Bulk Room Registration</h2>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
            <label className="block text-sm font-bold text-gray-900 mb-2">Target Building (Applies to all below)</label>
            <input type="text" required placeholder="e.g. Science Building" value={building} onChange={e => setBuilding(e.target.value)} className="block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-black bg-white" />
          </div>

          <div className="space-y-4">
            {rooms.map((room, index) => (
              <div key={index} className="flex flex-wrap items-end gap-4 p-4 border border-gray-200 rounded-md bg-white relative">
                
                {rooms.length > 1 && (
                  <button type="button" onClick={() => removeRoomRow(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold px-2">
                    &times;
                  </button>
                )}

                <div className="w-full sm:w-auto flex-grow">
                  <label className="block text-xs font-medium text-gray-700">Room Number</label>
                  <input type="text" name="room_number" required placeholder="e.g. 101A" value={room.room_number} onChange={(e) => handleRoomChange(index, e)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black text-sm" />
                </div>
                
                <div className="w-48">
                  <label className="block text-xs font-medium text-gray-700">Room Type</label>
                  <select name="room_type" required value={room.room_type} onChange={(e) => handleRoomChange(index, e)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black bg-white text-sm">
                    <option value="LECTURE">Lecture Room</option>
                    <option value="LABORATORY">Laboratory Room</option>
                  </select>
                </div>

                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700">Capacity (Seats)</label>
                  <input type="number" name="capacity" required min="1" value={room.capacity} onChange={(e) => handleRoomChange(index, e)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black text-sm" />
                </div>

                <div className="flex items-center h-[38px] px-2 space-x-4">
                  <label className="flex items-center text-sm text-gray-700">
                    <input type="checkbox" name="has_projector" checked={room.has_projector} onChange={(e) => handleRoomChange(index, e)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                    Projector
                  </label>
                  <label className="flex items-center text-sm text-gray-700">
                    <input type="checkbox" name="has_computers" checked={room.has_computers} onChange={(e) => handleRoomChange(index, e)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                    Computers
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={addRoomRow}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              + Add Another Room
            </button>
            <button
              type="submit"
              disabled={loading || !building.trim()}
              className="inline-flex justify-center py-2 px-8 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Registering...' : `Submit ${rooms.length} Room(s)`}
            </button>
          </div>
        </form>
      </div>

      <div className="max-w-5xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100 mt-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Existing Room Catalog</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building & Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amenities</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 text-black">
              {existingRooms.map(room => (
                <tr key={room.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{room.building} {room.room_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{room.room_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{room.capacity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {room.has_projector && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">Projector</span>}
                    {room.has_computers && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Computers</span>}
                  </td>
                </tr>
              ))}
              {existingRooms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No rooms found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
