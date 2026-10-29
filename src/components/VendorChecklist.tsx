'use client';

import React, { useState } from 'react';
import { VendorChecklistItem } from '@/lib/domain/types';
import { PlanMutation } from '@/lib/domain/mutations';
import { Plus, Trash2, HelpCircle, Check, Copy } from 'lucide-react';

interface VendorChecklistProps {
  vendors: VendorChecklistItem[];
  onMutation: (mutation: PlanMutation) => void;
}

export function VendorChecklist({ vendors, onMutation }: VendorChecklistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Photographer');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [questionsInput, setQuestionsInput] = useState(
    'What is your cancellation and refund policy?\nDo you provide your own backup equipment?'
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAddVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const suggestedQuestions = questionsInput
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);

    onMutation({
      type: 'ADD_VENDOR',
      name: name.trim(),
      category: category.trim(),
      priority,
      suggestedQuestions,
    });

    setName('');
    setShowAddForm(false);
  };

  const handleCopyQuestions = (vendorId: string, questions: string[]) => {
    const text = questions.map((q, idx) => `${idx + 1}. ${q}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedId(vendorId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-semibold text-slate-900">Prioritized Vendor Checklist</h3>
            <p className="text-xs text-slate-500">
              Track vendor conversations and interview questions for each celebration category.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Vendor
          </button>
        </div>

        {/* Add Vendor Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddVendor}
            className="p-4 bg-indigo-50/40 border-b border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm animate-in fade-in"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vendor / Role</label>
              <input
                type="text"
                required
                placeholder="e.g., Lead Wedding Photographer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <input
                type="text"
                required
                placeholder="e.g., Photography & Video"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm capitalize focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Suggested Interview Questions (one per line)
              </label>
              <textarea
                rows={2}
                value={questionsInput}
                onChange={(e) => setQuestionsInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs rounded-lg border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Save Vendor
              </button>
            </div>
          </form>
        )}

        {/* Vendor Cards List */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.length === 0 ? (
            <div className="col-span-2 py-8 text-center text-slate-400 text-sm">
              No vendors added. Keep track of quotes, contracts, and interview questions here.
            </div>
          ) : (
            vendors.map((v) => (
              <div
                key={v.id}
                className="bg-slate-50/75 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-base">{v.name}</h4>
                      <p className="text-xs text-slate-500 capitalize">{v.category}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-2xs font-bold uppercase px-2 py-0.5 rounded-full ${
                          v.priority === 'high'
                            ? 'bg-rose-100 text-rose-700'
                            : v.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {v.priority}
                      </span>
                      <button
                        onClick={() =>
                          onMutation({
                            type: 'REMOVE_VENDOR',
                            vendorId: v.id,
                          })
                        }
                        className="p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete vendor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Status Dropdown */}
                  <div className="my-3">
                    <label className="block text-2xs font-semibold text-slate-400 uppercase mb-1">
                      Status
                    </label>
                    <select
                      value={v.status}
                      onChange={(e) =>
                        onMutation({
                          type: 'UPDATE_VENDOR',
                          vendorId: v.id,
                          status: e.target.value as 'not_started' | 'contacted' | 'quoted' | 'booked',
                        })
                      }
                      className="w-full text-xs font-medium px-2 py-1.5 rounded-md border border-slate-300 bg-white text-slate-800 capitalize focus:outline-hidden"
                    >
                      <option value="not_started">⚪ Not Started</option>
                      <option value="contacted">🟡 Contacted</option>
                      <option value="quoted">🔵 Quoted Received</option>
                      <option value="booked">🟢 Booked & Confirmed</option>
                    </select>
                  </div>

                  {/* Interview Questions */}
                  {v.suggestedQuestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span className="flex items-center gap-1 font-medium">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                          Key Questions
                        </span>
                        <button
                          onClick={() => handleCopyQuestions(v.id, v.suggestedQuestions)}
                          className="inline-flex items-center gap-1 text-2xs text-indigo-600 hover:text-indigo-800 font-medium"
                          title="Copy all questions to clipboard"
                        >
                          {copiedId === v.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                        {v.suggestedQuestions.map((q, idx) => (
                          <li key={idx} className="leading-snug">
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
