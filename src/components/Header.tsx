'use client';

import React from 'react';
import { EventPlan, EventPlanCalculations } from '@/lib/domain/types';
import { PlanMutation } from '@/lib/domain/mutations';
import { formatCurrency } from '@/lib/utils';
import { Calendar, Users, DollarSign, Sparkles, RotateCcw } from 'lucide-react';

interface HeaderProps {
  plan: EventPlan;
  calculations: EventPlanCalculations;
  onMutation: (mutation: PlanMutation) => void;
  onReset: () => void;
}

export function Header({ plan, calculations, onMutation, onReset }: HeaderProps) {
  const percentUsed = Math.min(calculations.variancePercentage, 100);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Top row: Title, Type badge, Version indicator, and Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <input
                type="text"
                value={plan.title}
                onChange={(e) =>
                  onMutation({
                    type: 'SET_DETAILS',
                    title: e.target.value,
                  })
                }
                className="text-2xl font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden transition-colors px-1"
                placeholder="Name your celebration..."
              />
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span className="capitalize font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                  {plan.eventType}
                </span>
                <span>•</span>
                <span>Version {plan.version}</span>
                <span>•</span>
                <span className="text-emerald-600 font-medium">Deterministic Engine</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm('Reset this event plan back to a fresh template?')) {
                  onReset();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md border border-slate-200 transition-colors"
              title="Reset plan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Plan
            </button>
          </div>
        </div>

        {/* Bottom row: Config inputs & Budget bar */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-sm">
          {/* Event Date */}
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500">Event Date</label>
              <input
                type="date"
                value={plan.eventDate || ''}
                onChange={(e) =>
                  onMutation({
                    type: 'SET_DETAILS',
                    eventDate: e.target.value || null,
                  })
                }
                className="w-full bg-transparent font-medium text-slate-800 focus:outline-hidden text-sm"
              />
            </div>
          </div>

          {/* Guest Count */}
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500">Guest Count</label>
              <input
                type="number"
                min="0"
                value={plan.guestCount || ''}
                onChange={(e) =>
                  onMutation({
                    type: 'SET_DETAILS',
                    guestCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="w-full bg-transparent font-medium text-slate-800 focus:outline-hidden text-sm"
                placeholder="0 guests"
              />
            </div>
          </div>

          {/* Total Budget Cap */}
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <DollarSign className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500">Budget Ceiling</label>
              <div className="flex items-center">
                <span className="text-slate-500 mr-1">$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={plan.totalCap ? plan.totalCap / 100 : ''}
                  onChange={(e) =>
                    onMutation({
                      type: 'SET_DETAILS',
                      totalCap: Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)),
                    })
                  }
                  className="w-full bg-transparent font-medium text-slate-800 focus:outline-hidden text-sm"
                  placeholder="Total budget limit"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Visual Budget Bar */}
        {plan.totalCap > 0 && (
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-500 font-medium">
                Allocated: <strong className="text-slate-700">{formatCurrency(calculations.projectedTotal)}</strong> of {formatCurrency(plan.totalCap)}
              </span>
              <span className={`font-semibold ${calculations.isOverBudget ? 'text-red-600' : 'text-slate-700'}`}>
                {calculations.variancePercentage}% {calculations.isOverBudget && '(OVER BUDGET)'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  calculations.isOverBudget ? 'bg-red-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
