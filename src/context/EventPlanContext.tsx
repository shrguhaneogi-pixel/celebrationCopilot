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
  location: MOCK_EVENT_PLAN.location,
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
  dispatchMutations: (mutations: PlanMutation[]) => MutationResult;
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
   * Dispatches an atomic batch of mutations through pure domain validation and state update.
   * Evaluates each mutation sequentially, recomputes dates, increments version by 1,
   * commits to React state, and performs a single CAS update to Supabase.
   * Preserves previous valid state on failure.
   */
  const dispatchMutations = useCallback(
    (mutations: PlanMutation[]): MutationResult => {
      if (mutations.length === 0) {
        return { success: true, plan };
      }

      try {
        // 1. Deep clone plan to guarantee non-mutability on failure
        let workingPlan = structuredClone(plan);

        // 2. Apply each mutation sequentially through deterministic domain engine
        for (const mutation of mutations) {
          workingPlan = applyMutation(workingPlan, mutation);
        }

        // 3. Recalculate milestone dates in case eventDate or offsets were altered
        workingPlan = recalculateMilestoneDates(workingPlan);

        // 4. Increment monotonic version counter
        workingPlan = {
          ...workingPlan,
          version: plan.version + 1,
          updatedAt: new Date().toISOString(),
        };

        // 5. Verify resulting plan against canonical schema invariants
        const validation = EventPlanSchema.safeParse(workingPlan);
        if (!validation.success) {
          const errMsg = `Domain schema validation failed: ${validation.error.message}`;
          setError(errMsg);
          return { success: false, error: errMsg };
        }

        const nextRevision = revision + 1;

        // 6. Commit state atomically once
        setPlan(validation.data);
        setRevision(nextRevision);
        setError(null);

        // 7. Single async sync to Supabase if authenticated and eventId exists
        if (typeof window !== 'undefined' && eventId) {
          try {
            const supabase = createClient();
            supabase
              .rpc('update_event_plan', {
                p_event_id: eventId,
                p_plan: validation.data,
                p_expected_version: revision,
              })
              .then(({ data: rpcData, error: syncErr }) => {
                if (syncErr) {
                  setError(`Remote sync error: ${syncErr.message}`);
                } else if (!rpcData || (Array.isArray(rpcData) && rpcData.length === 0)) {
                  setError('CAS Conflict: The remote event was modified concurrently. Please refresh.');
                }
              });
          } catch {
            // Ignore offline errors
          }
        }

        return { success: true, plan: validation.data };
      } catch (err: unknown) {
        const message =
          err instanceof DomainEngineError || err instanceof Error
            ? err.message
            : 'Unknown mutation error';
        setError(message);
        return { success: false, error: message };
      }
    },
    [plan, revision, eventId]
  );

  /**
   * Dispatches a single mutation by delegating to dispatchMutations.
   */
  const dispatchMutation = useCallback(
    (mutation: PlanMutation): MutationResult => dispatchMutations([mutation]),
    [dispatchMutations]
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
      const nextRevision = newRevision !== undefined ? newRevision : revision + 1;
      setPlan(validation.data);
      setRevision(nextRevision);
      setError(null);

      // 4. Async sync approved plan to Supabase if authenticated and eventId exists
      if (typeof window !== 'undefined' && eventId) {
        try {
          const supabase = createClient();
          supabase
            .rpc('update_event_plan', {
              p_event_id: eventId,
              p_plan: validation.data,
              p_expected_version: revision,
            })
            .then(({ data: rpcData, error: syncErr }) => {
              if (syncErr) {
                setError(`Remote sync error: ${syncErr.message}`);
              } else if (!rpcData || (Array.isArray(rpcData) && rpcData.length === 0)) {
                setError('CAS Conflict: The remote event was modified concurrently. Please refresh.');
              }
            });
        } catch {
          // Ignore offline errors
        }
      }

      return { success: true, plan: validation.data };
    },
    [plan.version, revision, eventId]
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
      dispatchMutations,
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
      dispatchMutations,
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
