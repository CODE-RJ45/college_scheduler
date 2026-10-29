"use client";

import React from 'react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  itemName: string;
  itemType: 'Department' | 'Term' | 'Room' | 'Section' | 'Course';
  dependencyCount?: {
    courses?: number;
    sections?: number;
    slots?: number;
  };
  loading?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemType,
  dependencyCount,
  loading = false,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  const hasDependencies =
    (dependencyCount?.courses && dependencyCount.courses > 0) ||
    (dependencyCount?.sections && dependencyCount.sections > 0) ||
    (dependencyCount?.slots && dependencyCount.slots > 0);

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-600 mt-1.5">
            Are you sure you want to delete <span className="font-semibold text-slate-900">"{itemName}"</span>? This action cannot be undone.
          </p>

          {hasDependencies && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Active Dependencies Notice
              </div>
              <p className="text-amber-700 leading-relaxed">
                This {itemType.toLowerCase()} is currently referenced by:
              </p>
              <ul className="list-disc list-inside font-medium pl-1 text-amber-900">
                {dependencyCount?.courses ? <li>{dependencyCount.courses} Course(s)</li> : null}
                {dependencyCount?.sections ? <li>{dependencyCount.sections} Section(s)</li> : null}
                {dependencyCount?.slots ? <li>{dependencyCount.slots} Scheduled Class Slot(s)</li> : null}
              </ul>
              <p className="text-[11px] text-amber-600 italic">
                Deleting it may orphan or cascade delete these linked records.
              </p>
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Deleting...
              </>
            ) : (
              'Confirm Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

