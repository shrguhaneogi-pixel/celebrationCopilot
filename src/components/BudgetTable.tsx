'use client';

import React, { useState } from 'react';
import { BudgetItem, BudgetCategory, BudgetItemStatus, EventPlanCalculations } from '@/lib/domain/types';
import { PlanMutation } from '@/lib/domain/mutations';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, CheckCircle2, Clock, FileText, AlertTriangle } from 'lucide-react';

interface BudgetTableProps {
  items: BudgetItem[];
  calculations: EventPlanCalculations;
  onMutation: (mutation: PlanMutation) => void;
}

const CATEGORIES: BudgetCategory[] = [
  'venue',
  'catering',
  'entertainment',
  'decor',
  'photography',
  'attire',
  'other',
];

const STATUS_OPTIONS: BudgetItemStatus[] = ['projected', 'quoted', 'committed', 'paid'];

export function BudgetTable({ items, calculations, onMutation }: BudgetTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('catering');
  const [estimatedCostDollars, setEstimatedCostDollars] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const estimatedCost = Math.round((parseFloat(estimatedCostDollars) || 0) * 100);
    onMutation({
      type: 'ADD_BUDGET_ITEM',
      name: name.trim(),
      category,
      estimatedCost,
      notes: notes.trim() || undefined,
    });

    setName('');
    setEstimatedCostDollars('');
    setNotes('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Projected Total</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(calculations.projectedTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{items.length} items estimated</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Committed / Paid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(calculations.committedTotal)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Legally agreed or settled</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Remaining Buffer</span>
            {calculations.isOverBudget ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : (
              <FileText className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <p
            className={`text-2xl font-bold mt-1 ${
              calculations.isOverBudget ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {formatCurrency(calculations.remainingBudget)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {calculations.isOverBudget ? 'Exceeds budget ceiling' : 'Under ceiling'}
          </p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-semibold text-slate-900">Line Items</h3>
            <p className="text-xs text-slate-500">
              All line costs are summed deterministically without floating point error.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>

        {/* Add Item Form Drawer */}
        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="p-4 bg-indigo-50/40 border-b border-indigo-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm animate-in fade-in"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Item Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Acoustic Guitarist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BudgetCategory)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm capitalize focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Estimated Cost ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                placeholder="0.00"
                value={estimatedCostDollars}
                onChange={(e) => setEstimatedCostDollars(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Save Item
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 font-medium text-xs rounded-lg border border-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs font-medium bg-slate-50/75">
                <th className="py-3 px-4">Item & Category</th>
                <th className="py-3 px-4 text-right">Estimated</th>
                <th className="py-3 px-4 text-right">Actual</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                    No budget items recorded. Click &quot;Add Item&quot; or ask the Copilot to suggest a breakdown!
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{item.category}</div>
                    </td>

                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {formatCurrency(item.estimatedCost)}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="--"
                        value={item.actualCost !== undefined ? item.actualCost / 100 : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          onMutation({
                            type: 'UPDATE_BUDGET_ITEM',
                            itemId: item.id,
                            actualCost: val === '' ? undefined : Math.round(parseFloat(val) * 100),
                          });
                        }}
                        className="w-24 text-right px-2 py-1 rounded-md border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden text-sm font-medium"
                      />
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          onMutation({
                            type: 'UPDATE_BUDGET_ITEM',
                            itemId: item.id,
                            status: e.target.value as BudgetItemStatus,
                          })
                        }
                        className={`text-xs font-semibold px-2 py-1 rounded-md border capitalize focus:outline-hidden ${
                          item.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item.status === 'committed'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : item.status === 'quoted'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() =>
                          onMutation({
                            type: 'REMOVE_BUDGET_ITEM',
                            itemId: item.id,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
