'use client';

import React, { useState } from 'react';
import { useEventPlan } from '@/hooks/useEventPlan';
import { Header } from '@/components/Header';
import { BudgetTable } from '@/components/BudgetTable';
import { TimelineView } from '@/components/TimelineView';
import { VendorChecklist } from '@/components/VendorChecklist';
import { ChatPanel } from '@/components/ChatPanel';
import { DollarSign, Calendar, Users, MessageSquare, AlertCircle } from 'lucide-react';

type ActiveTab = 'budget' | 'timeline' | 'vendors';

export default function Home() {
  const {
    plan,
    calculations,
    isHydrated,
    lastRejected,
    executeProposal,
    dispatchMutation,
    resetPlan,
  } = useEventPlan();

  const [activeTab, setActiveTab] = useState<ActiveTab>('budget');

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading Celebration Copilot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 flex flex-col font-sans">
      {/* Top Navigation & Settings Bar */}
      <Header
        plan={plan}
        calculations={calculations}
        onMutation={dispatchMutation}
        onReset={resetPlan}
      />

      {/* Rejection Notification Banner */}
      {lastRejected.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Deterministic Engine Notice:</strong> {lastRejected.length} mutation(s) were safely rejected to protect plan integrity. (e.g., {lastRejected[0].reason})
            </span>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Conversational AI Copilot (5 cols on lg) */}
        <section className="lg:col-span-5 h-[620px] lg:h-[750px] sticky top-24">
          <ChatPanel plan={plan} onApplyProposal={executeProposal} />
        </section>

        {/* Right Column: Reactive State Views (7 cols on lg) */}
        <section className="lg:col-span-7 space-y-4">
          {/* View Selection Tabs */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs gap-1">
            <button
              onClick={() => setActiveTab('budget')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'budget'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Reactive Budget ({plan.items.length})
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Timeline ({plan.milestones.length})
            </button>

            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'vendors'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Vendors ({plan.vendors.length})
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="transition-opacity duration-200">
            {activeTab === 'budget' && (
              <BudgetTable
                items={plan.items}
                calculations={calculations}
                onMutation={dispatchMutation}
              />
            )}

            {activeTab === 'timeline' && (
              <TimelineView
                milestones={plan.milestones}
                eventDate={plan.eventDate}
                onMutation={dispatchMutation}
              />
            )}

            {activeTab === 'vendors' && (
              <VendorChecklist
                vendors={plan.vendors}
                onMutation={dispatchMutation}
              />
            )}
          </div>
        </section>
      </main>

      {/* Footer / System Status */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 text-center">
        Celebration Copilot • Deterministic State Engine • Zero Float Drift Guarantee • Offline-First Ready
      </footer>
    </div>
  );
}
