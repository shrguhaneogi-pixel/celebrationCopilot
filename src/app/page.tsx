'use client';

import React, { useState } from 'react';
import { MOCK_EVENT_PLAN } from '@/lib/mock-data';
import { EventHeader } from '@/components/dashboard/EventHeader';
import { BudgetTracker } from '@/components/dashboard/BudgetTracker';
import { TimelineTracker } from '@/components/dashboard/TimelineTracker';
import { VendorTracker } from '@/components/dashboard/VendorTracker';
import { ChatSidebar } from '@/components/dashboard/ChatSidebar';
import { Badge } from '@/components/ui/badge';
import { Sparkles, DollarSign, Calendar, Users, MessageSquare } from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'budget' | 'timeline' | 'vendors'>('budget');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const plan = MOCK_EVENT_PLAN;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col">
      {/* Top Application Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-foreground">
                Celebration Copilot
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-muted-foreground">
                Reactive Event Planner
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium hidden sm:inline-flex">
              Static Prototype
            </Badge>

            {/* Mobile Chat Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileChatOpen(!mobileChatOpen)}
              className="lg:hidden p-2 rounded-md border border-border bg-card text-foreground hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>{mobileChatOpen ? 'View Plan' : 'Planning AI'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Hero Event Overview Header */}
        <EventHeader plan={plan} />

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Planner Panel (8 columns) */}
          <main className={`lg:col-span-8 space-y-4 ${mobileChatOpen ? 'hidden lg:block' : 'block'}`}>
            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 border-b border-border pb-2 overflow-x-auto" aria-label="Dashboard sections">
              <button
                type="button"
                onClick={() => setActiveTab('budget')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'budget'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Budget Breakdown
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Milestone Timeline
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vendors')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'vendors'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Vendor Checklist
              </button>
            </nav>

            {/* Active Tab View */}
            {activeTab === 'budget' && (
              <BudgetTracker
                items={plan.items}
                totalCap={plan.totalCap}
                currency={plan.currency}
              />
            )}

            {activeTab === 'timeline' && (
              <TimelineTracker
                milestones={plan.milestones}
                eventDate={plan.eventDate}
              />
            )}

            {activeTab === 'vendors' && (
              <VendorTracker vendors={plan.vendors} />
            )}
          </main>

          {/* Conversational Copilot Sidebar (4 columns) */}
          <aside className={`lg:col-span-4 sticky top-20 ${mobileChatOpen ? 'block' : 'hidden lg:block'}`}>
            <ChatSidebar
              initialMessages={plan.chatHistory}
              currency={plan.currency}
            />
          </aside>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-4 text-center text-xs text-muted-foreground">
        <p>
          Celebration Copilot • Deterministic Reactive State Engine • Prototype with Typed Mock Data
        </p>
      </footer>
    </div>
  );
}
