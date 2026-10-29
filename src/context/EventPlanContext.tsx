'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { EventPlan, EventPlanSchema, DerivedEventMetrics } from '@/domain/event-plan.schema';
import { PlanMutation } from '@/domain/proposal.schema';
import { applyMutation, calculateTotals, recalculateMilestoneDates, DomainEngineError } from '@/domain/planning-engine';
import { createClient } from '@/lib/supabase/client';
import { MOCK_EVENT_PLAN } from '@/lib/mock-data';

export const INITIAL_EVENT_PLAN: EventPlan = {
  id: MOCK_EVENT_PLAN.id,
  version: 1,
  title: MOCK_EVENT_PLAN.title,
  eventType: MOCK_EVENT_PLAN.eventType,
  eventDate: MOCK_EVENT_PLAN.eventDate,
  timezone: 'Asia/Kolkata',
  location: MOCK_EVENT_PLAN.venue,
  guestCount: MOCK_EVENT_PLAN.guestCount,
  currency: MOCK_EVENT_PLAN.currency,
  totalCap: MOCK_EVENT_PLAN.totalCap,
  items: MOCK_EVENT_PLAN.items,
  milestones: MOCK_EVENT_PLAN.milestones,
  vendors: MOCK_EVENT_PLAN.vendors,
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
};

export interface MutationResult {
  success: boolean;
  error?: string;
  plan?: EventPlan;
}

export interface EventPlanContextType {
  plan: EventPlan;
  eventId: string | null;
  revision: number;
  userEmail: string | null;
  derivedMetrics: DerivedEventMetrics;
  isSubmitting: boolean;
  error: string | null;
  setIsSubmitting: (submitting: boolean) => void;
  clearError: () => void;
  dispatchMutation: (mutation: PlanMutation) => MutationResult;
  applyServerProposal: (newPlan: EventPlan, baseVersion: number, newRevision?: number) => MutationResult;
  resetPlan: () => void;
  signOut: () => Promise<void>;
}

const EventPlanContext = createContext<EventPlanContextType | null>(null);

const STORAGE_KEY = 'celebration_copilot_event_plan';

interface EventPlanProviderProps {
  children: React.ReactNode;
  initialPlan?: EventPlan;
  initialEventId?: string | null;
  initialRevision?: number;
  persistToLocalStorage?: boolean;
}

export function EventPlanProvider({
  children,
  initialPlan = INITIAL_EVENT_PLAN,
  initialEventId = null,
  initialRevision = 1,
  persistToLocalStorage = true,
}: EventPlanProviderProps) {
  const [plan, setPlan] = useState<EventPlan>(() => {
    if (typeof window !== 'undefined' && persistToLocalStorage) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const validation = EventPlanSchema.safeParse(parsed);
          if (validation.success) {
            return validation.data;
          }
        }
      } catch {
        // Fallback to initialPlan if localStorage is unreadable
      }
    }
    return initialPlan;
  });

  const [eventId, setEventId] = useState<string | null>(initialEventId);
  const [revision, setRevision] = useState<number>(initialRevision);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync session & authoritative event from Supabase on client mount
  useEffect(() => {
    let isMounted = true;

    async function loadSupabaseSession() {
      if (typeof window === 'undefined') return;
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user && isMounted) {
          setUserEmail(user.email || null);

          // Fetch user's authoritative event from PostgreSQL
          const { data, error: fetchErr } = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!fetchErr && data && isMounted) {
            const parsed = EventPlanSchema.safeParse(data.plan);
            if (parsed.success) {
              setPlan(parsed.data);
              setEventId(data.id);
              setRevision(data.revision);
            }
          }
        }
      } catch {
        // Supabase unconfigured or offline
      }
    }

    loadSupabaseSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync state to LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && persistToLocalStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } catch {
        // Handle storage quota issues gracefully
      }
    }
  }, [plan, persistToLocalStorage]);

  // Derived financial & progress metrics dynamically calculated from canonical plan
  const derivedMetrics = useMemo(() => calculateTotals(plan), [plan]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Dispatches a single mutation through pure domain validation and state update.
   * Preserves previous valid state on failure.
   */
  const dispatchMutation = useCallback(
    (mutation: PlanMutation): MutationResult => {
      try {
        // 1. Apply mutation through deterministic domain engine
        let nextPlan = applyMutation(plan, mutation);

        // 2. Recalculate milestone dates in case eventDate or offsets were altered
        nextPlan = recalculateMilestoneDates(nextPlan);

        // 3. Increment monotonic version counter
        nextPlan = {
          ...nextPlan,
          version: plan.version + 1,
          updatedAt: new Date().toISOString(),
        };

        // 4. Verify resulting plan against canonical schema invariants
        const validation = EventPlanSchema.safeParse(nextPlan);
        if (!validation.success) {
          const errMsg = `Domain schema validation failed: ${validation.error.message}`;
          setError(errMsg);
          return { success: false, error: errMsg };
        }

        const nextRevision = revision + 1;

        // 5. Commit state atomically
        setPlan(validation.data);
        setRevision(nextRevision);
        setError(null);

        // Async sync to Supabase if authenticated and eventId exists
        if (typeof window !== 'undefined' && eventId) {
          try {
            const supabase = createClient();
            supabase
              .from('events')
              .update({
                plan: validation.data,
                revision: nextRevision,
                updated_at: new Date().toISOString(),
              })
              .eq('id', eventId)
              .eq('revision', revision)
              .then(({ error: syncErr }) => {
                if (syncErr) {
                  setError(`Remote sync error: ${syncErr.message}`);
                }
              });
          } catch {
            // Ignore offline errors
          }
        }

        return { success: true, plan: validation.data };
      } catch (err: unknown) {
        const message = err instanceof DomainEngineError || err instanceof Error ? err.message : 'Unknown mutation error';
        setError(message);
        return { success: false, error: message };
      }
    },
    [plan, revision, eventId]
  );

  /**
   * Applies an AI proposal generated from the server, with client-side boundary validation
   * and optimistic concurrency verification against baseVersion.
   */
  const applyServerProposal = useCallback(
    (newPlan: EventPlan, baseVersion: number, newRevision?: number): MutationResult => {
      // 1. Client-Side Boundary Validation: Never trust server responses implicitly
      const validation = EventPlanSchema.safeParse(newPlan);
      if (!validation.success) {
        const errMsg = `Received invalid EventPlan from server: ${validation.error.message}`;
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      // 2. Concurrency check: Reject stale proposal if plan was modified while AI was inferring
      if (baseVersion !== plan.version) {
        const errMsg = `Conflict: Plan was modified (version ${plan.version}) while proposal for version ${baseVersion} was pending.`;
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      // 3. Commit state atomically
      setPlan(validation.data);
      if (newRevision !== undefined) {
        setRevision(newRevision);
      } else {
        setRevision((prev) => prev + 1);
      }
      setError(null);
      return { success: true, plan: validation.data };
    },
    [plan.version]
  );

  const resetPlan = useCallback(() => {
    setPlan(initialPlan);
    setRevision(1);
    setError(null);
    if (typeof window !== 'undefined' && persistToLocalStorage) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  }, [initialPlan, persistToLocalStorage]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      plan,
      eventId,
      revision,
      userEmail,
      derivedMetrics,
      isSubmitting,
      error,
      setIsSubmitting,
      clearError,
      dispatchMutation,
      applyServerProposal,
      resetPlan,
      signOut,
    }),
    [
      plan,
      eventId,
      revision,
      userEmail,
      derivedMetrics,
      isSubmitting,
      error,
      clearError,
      dispatchMutation,
      applyServerProposal,
      resetPlan,
      signOut,
    ]
  );

  return <EventPlanContext.Provider value={contextValue}>{children}</EventPlanContext.Provider>;
}

export function useEventPlan(): EventPlanContextType {
  const context = useContext(EventPlanContext);
  if (!context) {
    throw new Error('useEventPlan must be used within an EventPlanProvider');
  }
  return context;
}
