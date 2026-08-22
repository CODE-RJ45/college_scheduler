"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AutoScheduleSettings() {
  const router = useRouter();
  const [scheduling, setScheduling] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scheduling) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          const increment = (95 - prev) * 0.1;
          return prev + increment > 95 ? 95 : prev + increment;
        });
      }, 500);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [scheduling]);
  
  // Constraints state
  const [constraints, setConstraints] = useState({
    operatingHours: { start: '07:30', end: '17:00' },
    universalBreak: { enabled: true, start: '12:00', end: '13:00' },
    activeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    strictCapacity: true,
    instructorMaxHours: 6,
    maxClassesPerDay: 5,
    maxConsecutiveHours: 4,
    schedulingStrategy: 'COMPACT',
    strictRoomType: true,
    asyncDays: [] as string[]
  });

  const toggleDay = (day: string) => {
    setConstraints(prev => {
      const activeDays = prev.activeDays.includes(day)
        ? prev.activeDays.filter(d => d !== day)
        : [...prev.activeDays, day];
      return { ...prev, activeDays };
    });
  };

  const toggleAsyncDay = (day: string) => {
    setConstraints(prev => {
      const asyncDays = prev.asyncDays.includes(day)
        ? prev.asyncDays.filter(d => d !== day)
        : [...prev.asyncDays, day];
      return { ...prev, asyncDays };
    });
  };

  const handleAutoSchedule = async () => {
    setScheduling(true);
    try {
      const res = await axios.post('http://localhost:8000/api/auto-schedule/', { constraints });
      setProgress(100);
      setTimeout(() => {
        toast.success(`Successfully scheduled ${res.data.scheduled_slots_created} slots. ${res.data.failed_operations} subjects could not be scheduled.`);
        router.push('/admin/dashboard');
      }, 300);
    } catch (err: any) {
      toast.error(`Scheduling failed: ${err.response?.data?.error || err.message}`);
      setScheduling(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Auto-Schedule Configuration</h1>
            <p className="text-sm text-slate-500 mt-1">Configure constraints before generating the master schedule.</p>
          </div>
          <Link 
            href="/admin/dashboard" 
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            
            {/* Left Column */}
            <div className="p-6 space-y-8">
              {/* Section 1: Time & Availability */}
              <section>
                <h3 className="text-sm font-semibold text-slate-900 mb-4 tracking-tight">Time & Availability</h3>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Operating Hours</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input 
                          type="time" 
                          className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border" 
                          value={constraints.operatingHours.start} 
                          onChange={e => setConstraints({...constraints, operatingHours: {...constraints.operatingHours, start: e.target.value}})} 
                        />
                      </div>
                      <div>
                        <input 
                          type="time" 
                          className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border" 
                          value={constraints.operatingHours.end} 
                          onChange={e => setConstraints({...constraints, operatingHours: {...constraints.operatingHours, end: e.target.value}})} 
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Active Days</label>
                    <div className="flex flex-wrap gap-2">
                      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => {
                        const isActive = constraints.activeDays.includes(day);
                        return (
                          <button
                            key={day}
                            onClick={() => toggleDay(day)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                              isActive 
                                ? 'bg-slate-800 text-white border-slate-800' 
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700">Universal Lunch Break</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={constraints.universalBreak.enabled} 
                          onChange={e => setConstraints({...constraints, universalBreak: {...constraints.universalBreak, enabled: e.target.checked}})} 
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {constraints.universalBreak.enabled && (
                      <div className="grid grid-cols-2 gap-3 mt-2 bg-slate-50 p-3 rounded-md border border-slate-100">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Start</label>
                          <input 
                            type="time" 
                            className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2.5 border bg-white" 
                            value={constraints.universalBreak.start} 
                            onChange={e => setConstraints({...constraints, universalBreak: {...constraints.universalBreak, start: e.target.value}})} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">End</label>
                          <input 
                            type="time" 
                            className="block w-full border-slate-300 rounded-md shadow-sm sm:text-sm focus:ring-blue-500 focus:border-blue-500 py-1.5 px-2.5 border bg-white" 
                            value={constraints.universalBreak.end} 
                            onChange={e => setConstraints({...constraints, universalBreak: {...constraints.universalBreak, end: e.target.value}})} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* Section 2: Algorithm Strategy */}
              <section>
                <h3 className="text-sm font-semibold text-slate-900 mb-4 tracking-tight">Algorithm Strategy</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Placement Strategy</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div 
                        onClick={() => setConstraints({...constraints, schedulingStrategy: 'COMPACT'})}
                        className={`p-3 rounded-md cursor-pointer transition-colors border ${
                          constraints.schedulingStrategy === 'COMPACT' 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <input 
                            type="radio" 
                            checked={constraints.schedulingStrategy === 'COMPACT'} 
                            readOnly
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <span className={`ml-2 text-sm font-medium ${constraints.schedulingStrategy === 'COMPACT' ? 'text-blue-900' : 'text-slate-700'}`}>Compact</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 ml-6 leading-relaxed">Minimize days on campus.</p>
                      </div>

                      <div 
                        onClick={() => setConstraints({...constraints, schedulingStrategy: 'BALANCED'})}
                        className={`p-3 rounded-md cursor-pointer transition-colors border ${
                          constraints.schedulingStrategy === 'BALANCED' 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <input 
                            type="radio" 
                            checked={constraints.schedulingStrategy === 'BALANCED'} 
                            readOnly
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <span className={`ml-2 text-sm font-medium ${constraints.schedulingStrategy === 'BALANCED' ? 'text-blue-900' : 'text-slate-700'}`}>Balanced</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 ml-6 leading-relaxed">Spread classes evenly.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Asynchronous Days</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                        <button
                          key={day}
                          onClick={() => toggleAsyncDay(day)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                            constraints.asyncDays.includes(day)
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Classes scheduled here won't consume physical rooms.</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column */}
            <div className="p-6 space-y-8">
              {/* Section 3: Well-being */}
              <section>
                <h3 className="text-sm font-semibold text-slate-900 mb-4 tracking-tight">Workload & Limits</h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-sm font-medium text-slate-700">Max Teaching Hours / Day</label>
                      <span className="text-sm font-medium text-slate-900">{constraints.instructorMaxHours}h</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" max="10" step="1" 
                      value={constraints.instructorMaxHours} 
                      onChange={e => setConstraints({...constraints, instructorMaxHours: parseInt(e.target.value)})} 
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                    />
                    <p className="text-xs text-slate-500 mt-1.5">Caps an instructor's daily teaching load.</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-sm font-medium text-slate-700">Max Subjects / Day</label>
                      <span className="text-sm font-medium text-slate-900">{constraints.maxClassesPerDay}</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" max="8" step="1" 
                      value={constraints.maxClassesPerDay} 
                      onChange={e => setConstraints({...constraints, maxClassesPerDay: parseInt(e.target.value)})} 
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                    />
                    <p className="text-xs text-slate-500 mt-1.5">Maximum classes for a student section in one day.</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-sm font-medium text-slate-700">Max Consecutive Hours</label>
                      <span className="text-sm font-medium text-slate-900">{constraints.maxConsecutiveHours}h</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" max="6" step="1" 
                      value={constraints.maxConsecutiveHours} 
                      onChange={e => setConstraints({...constraints, maxConsecutiveHours: parseInt(e.target.value)})} 
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                    />
                    <p className="text-xs text-slate-500 mt-1.5">Forces a break after continuous back-to-back classes.</p>
                  </div>
                </div>
              </section>

              <hr className="border-slate-100" />

              {/* Section 4: Strict Rules */}
              <section>
                <h3 className="text-sm font-semibold text-slate-900 mb-4 tracking-tight">Strict Constraints</h3>
                
                <div className="space-y-3">
                  <label className="flex items-start p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex items-center h-5 mt-0.5">
                      <input 
                        type="checkbox" 
                        checked={constraints.strictCapacity} 
                        onChange={e => setConstraints({...constraints, strictCapacity: e.target.checked})} 
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-slate-300 rounded" 
                      />
                    </div>
                    <div className="ml-3">
                      <span className="text-sm font-medium text-slate-900">Strict Room Capacity</span>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Only allow rooms where physical capacity &ge; section size.</p>
                    </div>
                  </label>

                  <label className="flex items-start p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex items-center h-5 mt-0.5">
                      <input 
                        type="checkbox" 
                        checked={constraints.strictRoomType} 
                        onChange={e => setConstraints({...constraints, strictRoomType: e.target.checked})} 
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-slate-300 rounded" 
                      />
                    </div>
                    <div className="ml-3">
                      <span className="text-sm font-medium text-slate-900">Strict Room Type Matching</span>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Laboratories in Lab rooms, lectures in Lecture rooms.</p>
                    </div>
                  </label>
                </div>
              </section>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
            <button 
              onClick={handleAutoSchedule} 
              disabled={scheduling}
              className="relative overflow-hidden inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[200px]"
            >
              {scheduling && (
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-blue-800 transition-all duration-500 ease-out z-0" 
                  style={{ width: `${progress}%` }} 
                />
              )}
              <div className="relative z-10 flex items-center">
                {scheduling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating... {Math.round(progress)}%
                  </>
                ) : 'Generate Master Schedule'}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
