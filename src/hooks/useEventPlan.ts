'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { EventPlan, EventPlanCalculations } from '@/lib/domain/types';
import {
  createEmptyPlan,
  applyProposal,
  calculateTotals,
} from '@/lib/domain/engine';
import { EventPlanProposal, PlanMutation } from '@/lib/domain/mutations';

const STORAGE_KEY = 'celebration_copilot_active_plan';

export function useEventPlan() {
  const [plan, setPlan] = useState<EventPlan>(() => createEmptyPlan());
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastRejected, setLastRejected] = useState<Array<{ mutation: unknown; reason: string }>>([]);

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.version === 'number') {
          setPlan(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved plan from localStorage', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } catch (e) {
        console.error('Failed to persist plan to localStorage', e);
      }
    }
  }, [plan, isHydrated]);

  // Execute a proposal (single or multiple mutations) through the deterministic engine
  const executeProposal = useCallback((proposal: EventPlanProposal) => {
    setPlan((current) => {
      const { nextPlan, rejectedMutations } = applyProposal(current, proposal);
      setLastRejected(rejectedMutations);
      return nextPlan;
    });
  }, []);

  // Helper for direct discrete mutations
  const dispatchMutation = useCallback((mutation: PlanMutation, explanation = 'Manual update') => {
    executeProposal({
      explanation,
      mutations: [mutation],
    });
  }, [executeProposal]);

  const resetPlan = useCallback(() => {
    const empty = createEmptyPlan();
    setPlan(empty);
    setLastRejected([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const calculations: EventPlanCalculations = useMemo(() => {
    return calculateTotals(plan);
  }, [plan]);

  return {
    plan,
    calculations,
    isHydrated,
    lastRejected,
    executeProposal,
    dispatchMutation,
    resetPlan,
  };
}
