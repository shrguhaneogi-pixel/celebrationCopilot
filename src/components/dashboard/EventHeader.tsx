'use client';

import React, { useState } from 'react';
import { Calendar, MapPin, Users, Sparkles, AlertCircle, Edit2, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { MockEventPlan } from '@/lib/mock-data';
import { EventPlan } from '@/domain/event-plan.schema';
import { useEventPlan } from '@/context/EventPlanContext';

interface EventHeaderProps {
  plan?: (EventPlan | MockEventPlan) & { venue?: string };
}

export function EventHeader({ plan: propPlan }: EventHeaderProps) {
  // Try to use canonical context if inside EventPlanProvider
  let contextPlan: EventPlan | undefined;
  let contextMetrics: ReturnType<typeof useEventPlan>['derivedMetrics'] | undefined;
  let dispatchMutation: ReturnType<typeof useEventPlan>['dispatchMutation'] | undefined;

  try {
    const context = useEventPlan();
    contextPlan = context.plan;
    contextMetrics = context.derivedMetrics;
    dispatchMutation = context.dispatchMutation;
  } catch {
    // Graceful fallback if rendered outside provider
  }

  const activePlan = contextPlan || propPlan;

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(activePlan?.eventDate || '');
  const [editGuests, setEditGuests] = useState(String(activePlan?.guestCount ?? ''));
  const [editCap, setEditCap] = useState(String(activePlan?.totalCap ?? ''));
  const [editLocation, setEditLocation] = useState(
    activePlan ? ('location' in activePlan ? (activePlan.location as string) : (activePlan.venue || 'Location TBD')) : ''
  );
  const [editError, setEditError] = useState<string | null>(null);

  if (!activePlan) return null;

  // Compute metrics deterministically if not using context
  const projectedTotal = contextMetrics
    ? contextMetrics.projectedTotal
    : activePlan.items.reduce((sum, item) => sum + item.estimatedCost, 0);

  const remainingBudget = contextMetrics
    ? contextMetrics.remainingBudget
    : activePlan.totalCap - projectedTotal;

  const allocationPercent = contextMetrics
    ? contextMetrics.allocationPercent
    : Math.min(100, Math.round((projectedTotal / activePlan.totalCap) * 100));

  const isOverBudget = contextMetrics ? contextMetrics.isOverBudget : remainingBudget < 0;

  const displayLocation = 'location' in activePlan ? (activePlan.location as string) : (activePlan.venue || 'Location TBD');

  const handleStartEdit = () => {
    setEditDate(activePlan.eventDate || '');
    setEditGuests(String(activePlan.guestCount));
    setEditCap(String(activePlan.totalCap));
    setEditLocation(displayLocation);
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchMutation) {
      setIsEditing(false);
      return;
    }

    const guestsNum = parseInt(editGuests, 10);
    const capNum = parseInt(editCap, 10);

    if (isNaN(guestsNum) || guestsNum < 0) {
      setEditError('Guest count must be a non-negative integer.');
      return;
    }

    if (isNaN(capNum) || capNum < 0) {
      setEditError('Target budget ceiling must be a non-negative integer.');
      return;
    }

    // 1. Dispatch SET_DETAILS for date and location
    const detailsRes = dispatchMutation({
      type: 'SET_DETAILS',
      eventDate: editDate.trim() ? editDate.trim() : null,
      location: editLocation.trim(),
    });
    if (!detailsRes.success) {
      setEditError(detailsRes.error || 'Failed to update event details.');
      return;
    }

    // 2. Dispatch UPDATE_GUEST_COUNT
    const guestRes = dispatchMutation({
      type: 'UPDATE_GUEST_COUNT',
      guestCount: guestsNum,
    });
    if (!guestRes.success) {
      setEditError(guestRes.error || 'Failed to update guest count.');
      return;
    }

    // 3. Dispatch UPDATE_TARGET_BUDGET
    const capRes = dispatchMutation({
      type: 'UPDATE_TARGET_BUDGET',
      totalCap: capNum,
    });
    if (!capRes.success) {
      setEditError(capRes.error || 'Failed to update target budget ceiling.');
      return;
    }

    setIsEditing(false);
    setEditError(null);
  };

  return (
    <Card className="p-5 md:p-6 shadow-sm border-border bg-card">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {activePlan.title}
            </h1>
            <Badge variant="default" className="text-xs font-medium">
              <Sparkles className="w-3 h-3 mr-1" />
              {activePlan.eventType}
            </Badge>

            {dispatchMutation && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
                title="Edit event details manually"
                aria-label="Edit event details manually"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
            )}
          </div>

          {!isEditing ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                {displayLocation}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {activePlan.eventDate
                  ? new Date(activePlan.eventDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Date TBD'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                {activePlan.guestCount} Guests
              </span>
            </div>
          ) : (
            <form onSubmit={handleSaveEdit} className="mt-3 p-3 bg-muted/40 rounded-lg border border-border space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label htmlFor="edit-event-date" className="font-semibold block mb-1">
                    Event Date (YYYY-MM-DD)
                  </label>
                  <Input
                    id="edit-event-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="edit-guests" className="font-semibold block mb-1">
                    Guest Count
                  </label>
                  <Input
                    id="edit-guests"
                    type="number"
                    min="0"
                    max="100000"
                    value={editGuests}
                    onChange={(e) => setEditGuests(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="edit-cap" className="font-semibold block mb-1">
                    Target Budget ({activePlan.currency})
                  </label>
                  <Input
                    id="edit-cap"
                    type="number"
                    min="0"
                    value={editCap}
                    onChange={(e) => setEditCap(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
                <div>
                  <label htmlFor="edit-location" className="font-semibold block mb-1">
                    Location / Venue
                  </label>
                  <Input
                    id="edit-location"
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {editError && (
                <div role="alert" className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" className="h-7 text-xs px-3 cursor-pointer inline-flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7 text-xs px-3 cursor-pointer inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="flex md:flex-col items-baseline md:items-end justify-between md:justify-center border-t md:border-t-0 border-border pt-3 md:pt-0">
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            Target Budget Ceiling
          </span>
          <span className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            {formatCurrency(activePlan.totalCap, activePlan.currency)}
          </span>
        </div>
      </div>

      {/* Budget Allocation Progress */}
      <div className="pt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Allocated Planning Budget:{' '}
            <strong className="text-foreground font-semibold">
              {formatCurrency(projectedTotal, activePlan.currency)} ({allocationPercent}%)
            </strong>
          </span>
          {isOverBudget ? (
            <span className="text-destructive font-semibold inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Budget Exceeded by {formatCurrency(Math.abs(remainingBudget), activePlan.currency)}
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Remaining Buffer: {formatCurrency(remainingBudget, activePlan.currency)}
            </span>
          )}
        </div>

        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/50">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverBudget ? 'bg-destructive' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, allocationPercent)}%` }}
          />
        </div>
      </div>
    </Card>
  );
}
