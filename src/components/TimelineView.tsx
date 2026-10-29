'use client';

import React, { useState } from 'react';
import { Milestone, MilestoneCategory } from '@/lib/domain/types';
import { PlanMutation } from '@/lib/domain/mutations';
import { Plus, Trash2, Calendar, CheckCircle2, Clock } from 'lucide-react';

interface TimelineViewProps {
  milestones: Milestone[];
  eventDate: string | null;
  onMutation: (mutation: PlanMutation) => void;
}

const MILESTONE_CATEGORIES: MilestoneCategory[] = [
  'planning',
  'booking',
  'execution',
  'post_event',
];

export function TimelineView({ milestones, eventDate, onMutation }: TimelineViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [offsetDays, setOffsetDays] = useState('-30');
  const [category, setCategory] = useState<MilestoneCategory>('booking');

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onMutation({
      type: 'ADD_MILESTONE',
      title: title.trim(),
      offsetDays: parseInt(offsetDays, 10) || 0,
      category,
    });

    setTitle('');
    setOffsetDays('-30');
    setShowAddForm(false);
  };

  const formatOffset = (days: number) => {
    if (days === 0) return 'Day of Event';
    if (days < 0) return `${Math.abs(days)}d before`;
    return `${days}d after`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-semibold text-slate-900">Adaptive Milestone Timeline</h3>
            <p className="text-xs text-slate-500">
              Target dates automatically adapt when your event date shifts.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Milestone
          </button>
        </div>

        {/* Add Milestone Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddMilestone}
            className="p-4 bg-indigo-50/40 border-b border-indigo-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm animate-in fade-in"
          >
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Milestone Title</label>
              <input
                type="text"
                required
                placeholder="e.g., Send out invitations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Relative Days (e.g. -45)
              </label>
              <input
                type="number"
                required
                value={offsetDays}
                onChange={(e) => setOffsetDays(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phase</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MilestoneCategory)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm capitalize focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {MILESTONE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4 flex justify-end gap-2 pt-2">
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
                Save Milestone
              </button>
            </div>
          </form>
        )}

        {/* Milestone Timeline List */}
        <div className="p-4 sm:p-6">
          {milestones.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No milestones planned yet. Add key deadlines or let the Copilot generate a customized timeline.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
              {milestones.map((m) => (
                <div key={m.id} className="relative pl-6 group">
                  {/* Timeline Dot */}
                  <button
                    onClick={() =>
                      onMutation({
                        type: 'UPDATE_MILESTONE',
                        milestoneId: m.id,
                        completed: !m.completed,
                      })
                    }
                    className={`absolute -left-2.5 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center transition-colors ${
                      m.completed
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-slate-300 text-transparent hover:border-indigo-500'
                    }`}
                    title={m.completed ? 'Mark uncompleted' : 'Mark completed'}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 group-hover:border-slate-300 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            m.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {m.title}
                        </span>
                        <span className="text-2xs font-medium uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {m.category.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatOffset(m.offsetDays)}
                        </span>

                        {m.dueDate ? (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            Target: <strong className="text-slate-800">{m.dueDate}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">
                            (Set event date to resolve calendar date)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() =>
                          onMutation({
                            type: 'REMOVE_MILESTONE',
                            milestoneId: m.id,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete milestone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
