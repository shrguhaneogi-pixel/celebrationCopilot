'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { EventPlanProvider, useEventPlan } from '@/context/EventPlanContext';
import { EventHeader } from '@/components/dashboard/EventHeader';
import { BudgetTracker } from '@/components/dashboard/BudgetTracker';
import { TimelineTracker } from '@/components/dashboard/TimelineTracker';
import { VendorTracker } from '@/components/dashboard/VendorTracker';
import { ChatSidebar } from '@/components/dashboard/ChatSidebar';
import { PlanExportModal } from '@/components/dashboard/PlanExportModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, DollarSign, Calendar, Users, MessageSquare, AlertCircle, X, RotateCcw, LogIn, LogOut, Download } from 'lucide-react';
import { MOCK_CHAT_HISTORY } from '@/lib/mock-data';

function DashboardContent() {
  const { plan, userEmail, signOut, error, clearError, resetPlan } = useEventPlan();
  const [activeTab, setActiveTab] = useState<'budget' | 'timeline' | 'vendors'>('budget');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col print:min-h-0 print:block print:bg-white print:text-black">
      {/* Top Application Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm print:hidden">
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
            {userEmail && (
              <span className="text-xs text-muted-foreground hidden md:inline-block px-1">
                {userEmail}
              </span>
            )}

            <Badge variant="outline" className="text-xs font-mono font-medium hidden sm:inline-flex">
              {userEmail ? 'Cloud Synced' : 'Local Mode'} • v{plan.version}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetPlan}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
              title="Reset plan to initial state"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">Reset</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              className="text-xs h-7 px-2.5 font-medium cursor-pointer inline-flex items-center gap-1.5"
              title="Export or print event plan"
              aria-label="Export Plan"
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setIsExportModalOpen(true);
                }
              }}
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Export Plan</span>
            </Button>

            {userEmail ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
                title="Sign out of your account"
                aria-label="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            ) : (
              <Link
                href="/login"
                role="button"
                className="text-xs h-7 px-2 font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                title="Sign in to your account"
                aria-label="Sign In"
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            )}

            {/* Mobile Chat Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileChatOpen(!mobileChatOpen)}
              className="lg:hidden p-2 rounded-md border border-border bg-card text-foreground hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>{mobileChatOpen ? 'View Plan' : 'Planning AI'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Invariant Error Banner */}
      {error && (
        <div role="alert" className="bg-destructive/10 border-b border-destructive/20 text-destructive text-xs py-2 px-4 flex items-center justify-between max-w-7xl mx-auto w-full print:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-destructive hover:opacity-80 p-1 cursor-pointer"
            aria-label="Dismiss error notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className={`flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 ${isExportModalOpen ? 'print:hidden' : ''}`}>
        {/* Hero Event Overview Header */}
        <EventHeader />

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
            {activeTab === 'budget' && <BudgetTracker />}
            {activeTab === 'timeline' && <TimelineTracker />}
            {activeTab === 'vendors' && <VendorTracker />}
          </main>

          {/* Conversational Copilot Sidebar (4 columns) */}
          <aside className={`lg:col-span-4 sticky top-20 ${mobileChatOpen ? 'block' : 'hidden lg:block'}`}>
            <ChatSidebar initialMessages={MOCK_CHAT_HISTORY} />
          </aside>
        </div>
      </div>

      {/* Plan Export & Printable View Modal */}
      <PlanExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-4 text-center text-xs text-muted-foreground print:hidden">
        <p>
          Celebration Copilot • Deterministic Reactive State Engine • One Canonical EventPlan
        </p>
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <EventPlanProvider>
      <DashboardContent />
    </EventPlanProvider>
  );
}
