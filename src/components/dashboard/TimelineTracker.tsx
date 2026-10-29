'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Milestone, MilestoneCategory } from '@/domain/event-plan.schema';
import { MockMilestone } from '@/lib/mock-data';
import { useEventPlan } from '@/context/EventPlanContext';
import { CheckCircle2, Clock, CalendarClock, Plus, Trash2, AlertCircle } from 'lucide-react';

interface TimelineTrackerProps {
  milestones?: (Milestone | MockMilestone)[];
  eventDate?: string | null;
}

export function TimelineTracker({
  milestones: propMilestones,
  eventDate: propEventDate,
}: TimelineTrackerProps) {
  let contextPlan: ReturnType<typeof useEventPlan>['plan'] | undefined;
  let contextMetrics: ReturnType<typeof useEventPlan>['derivedMetrics'] | undefined;
  let dispatchMutation: ReturnType<typeof useEventPlan>['dispatchMutation'] | undefined;

  try {
    const context = useEventPlan();
    contextPlan = context.plan;
    contextMetrics = context.derivedMetrics;
    dispatchMutation = context.dispatchMutation;
  } catch {
    // Fallback if rendered outside context
  }

  const milestones = contextPlan ? contextPlan.milestones : (propMilestones || []);
  const eventDate = contextPlan ? contextPlan.eventDate : (propEventDate ?? null);

  const completedCount = contextMetrics
    ? contextMetrics.completedMilestones
    : milestones.filter((m) => m.completed).length;

  const progressPercent = contextMetrics
    ? contextMetrics.timelineProgressPercent
    : milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  // Add Milestone State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOffset, setNewOffset] = useState('');
  const [newCategory, setNewCategory] = useState<MilestoneCategory>('planning');
  const [addError, setAddError] = useState<string | null>(null);

  const handleToggleComplete = (milestone: Milestone | MockMilestone) => {
    if (!dispatchMutation) return;
    dispatchMutation({
      type: 'UPDATE_MILESTONE',
      milestoneId: milestone.id,
      completed: !milestone.completed,
    });
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchMutation) return;

    if (!newTitle.trim() || newOffset.trim() === '') {
      setAddError('Title and relative offset days are required.');
      return;
    }

    const offsetNum = parseInt(newOffset, 10);
    if (isNaN(offsetNum) || offsetNum < -3650 || offsetNum > 3650) {
      setAddError('Offset must be an integer between -3650 and +3650 days.');
      return;
    }

    const res = dispatchMutation({
      type: 'ADD_MILESTONE',
      title: newTitle.trim(),
      offsetDays: offsetNum,
      category: newCategory,
    });

    if (!res.success) {
      setAddError(res.error || 'Failed to add milestone.');
      return;
    }

    setNewTitle('');
    setNewOffset('');
    setNewCategory('planning');
    setAddError(null);
    setShowAddForm(false);
  };

  const handleDeleteMilestone = (milestoneId: string) => {
    if (!dispatchMutation) return;
    dispatchMutation({
      type: 'REMOVE_MILESTONE',
      milestoneId,
    });
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Adaptive Milestone Timeline
            </CardTitle>
            <CardDescription>
              All target deadlines are automatically computed from the celebration date ({eventDate || 'Date TBD'}).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="font-mono text-xs">
              {completedCount}/{milestones.length} Completed ({progressPercent}%)
            </Badge>
            {dispatchMutation && (
              <Button
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="h-8 text-xs cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Milestone</span>
              </Button>
            )}
          </div>
        </div>

        {/* Add Milestone Form */}
        {showAddForm && (
          <form onSubmit={handleCreateMilestone} className="mt-4 p-3 bg-muted/30 rounded-lg border border-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="sm:col-span-2">
                <label htmlFor="new-milestone-title" className="font-semibold block mb-1">
                  Milestone Title *
                </label>
                <Input
                  id="new-milestone-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Confirm Catering Menu"
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <label htmlFor="new-milestone-offset" className="font-semibold block mb-1">
                  Offset Days (- before, 0 event day) *
                </label>
                <Input
                  id="new-milestone-offset"
                  type="number"
                  min="-3650"
                  max="3650"
                  value={newOffset}
                  onChange={(e) => setNewOffset(e.target.value)}
                  placeholder="-30"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            {addError && (
              <div role="alert" className="text-xs text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{addError}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" className="h-7 text-xs px-3 cursor-pointer">
                Save Milestone
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(false)}
                className="h-7 text-xs px-3 cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="space-y-3">
          {milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No milestones scheduled yet.</p>
          ) : (
            milestones.map((ms) => {
              const isEventDay = ms.offsetDays === 0;
              const offsetLabel = isEventDay ? 'Event Day' : `${ms.offsetDays}d`;

              return (
                <div
                  key={ms.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border transition-colors ${
                    ms.completed
                      ? 'bg-muted/40 border-border/80'
                      : 'bg-card border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span
                      className={`inline-flex items-center justify-center font-mono text-xs font-bold px-2 py-1 rounded min-w-[54px] border ${
                        isEventDay
                          ? 'bg-primary text-primary-foreground border-primary'
                          : ms.completed
                          ? 'bg-muted text-muted-foreground border-border'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {offsetLabel}
                    </span>

                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          ms.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {ms.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>Due: {ms.dueDate || 'Pending'}</span>
                        <span>•</span>
                        <span className="capitalize">{ms.category}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {dispatchMutation ? (
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(ms)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded border cursor-pointer transition-colors ${
                          ms.completed
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                        }`}
                        title="Toggle completion status"
                        aria-label={`Mark milestone "${ms.title}" as ${ms.completed ? 'upcoming' : 'completed'}`}
                      >
                        {ms.completed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Mark Done</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        {ms.completed ? 'Completed' : 'Upcoming'}
                      </span>
                    )}

                    {dispatchMutation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMilestone(ms.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Delete milestone"
                        aria-label={`Delete milestone ${ms.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
