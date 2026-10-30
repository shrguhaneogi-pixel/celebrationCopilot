// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { EventPlanProvider, useEventPlan, INITIAL_EVENT_PLAN } from '@/context/EventPlanContext';
import { EventPlan } from '@/domain/event-plan.schema';
import { PlanMutation, Proposal } from '@/domain/proposal.schema';
import { applyProposal, applyMutation, calculateTotals } from '@/domain/planning-engine';
import { checkRateLimit, resetRateLimit, extractClientIdentifierFromHeaders, DEFAULT_RATE_LIMIT } from '@/lib/rate-limiter';

const mockRpc = vi.fn().mockResolvedValue({ data: [{ id: 'mock-id' }], error: null });
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
    rpc: mockRpc,
  }),
}));

describe('Cross-Criterion Integration Collision Penetration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetRateLimit();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <EventPlanProvider persistToLocalStorage={false}>
      {children}
    </EventPlanProvider>
  );

  describe('Boundary 1: Security vs. Product Alignment (Guest Mode vs. CAS & Rate Limiting)', () => {
    it('allows offline guest users to execute rapid successive budget changes locally without triggering CAS RPCs or errors', () => {
      const { result } = renderHook(() => useEventPlan(), { wrapper });

      expect(result.current.eventId).toBeNull(); // Guest mode
      expect(result.current.error).toBeNull();

      const initialCount = result.current.plan.items.length;

      // Simulate 5 rapid local guest mutations
      act(() => {
        for (let i = 1; i <= 5; i++) {
          const res = result.current.dispatchMutation({
            type: 'ADD_BUDGET_ITEM',
            name: `Guest Item ${i}`,
            category: 'venue',
            estimatedCost: 15000,
            actualCost: 15000,
            status: 'projected',
          });
          expect(res.success).toBe(true);
        }
      });

      // Verify local version incremented by 5 and items added
      expect(result.current.plan.items.length).toBe(initialCount + 5);
      expect(result.current.plan.version).toBe(INITIAL_EVENT_PLAN.version + 5);
      expect(result.current.error).toBeNull();

      // In guest mode, cloud CAS RPC must NEVER be called
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('isolates guest IP/session rate-limiting buckets so one abusive guest cannot starve another', () => {
      const idUserA = extractClientIdentifierFromHeaders({
        cfConnectingIp: '203.0.113.10',
        userAgent: 'Browser-A',
      });
      const idUserB = extractClientIdentifierFromHeaders({
        cfConnectingIp: '203.0.113.20',
        userAgent: 'Browser-B',
      });

      // Exhaust User A's allowance (15 requests)
      for (let i = 0; i < DEFAULT_RATE_LIMIT; i++) {
        const check = checkRateLimit(idUserA);
        expect(check.allowed).toBe(true);
      }

      // User A's 16th request is blocked
      const blockedA = checkRateLimit(idUserA);
      expect(blockedA.allowed).toBe(false);
      expect(blockedA.resetMs).toBeGreaterThan(0);

      // User B must remain completely unblocked with full quota
      const checkB = checkRateLimit(idUserB);
      expect(checkB.allowed).toBe(true);
      expect(checkB.remaining).toBe(14);
    });
  });

  describe('Boundary 2: Performance vs. Accessibility (Derived Metrics Recalculation & Integrity)', () => {
    it('deterministically recalculates budget and timeline metrics after batch mutations without UI desync', () => {
      const { result } = renderHook(() => useEventPlan(), { wrapper });

      // Batch: Increase target budget and update guest count atomically
      act(() => {
        const res = result.current.dispatchMutations([
          {
            type: 'UPDATE_TARGET_BUDGET',
            totalCap: 1500000, // 15,00,000 INR
          },
          {
            type: 'UPDATE_GUEST_COUNT',
            guestCount: 300,
          },
        ]);
        expect(res.success).toBe(true);
      });

      expect(result.current.plan.totalCap).toBe(1500000);
      expect(result.current.plan.guestCount).toBe(300);
      expect(result.current.derivedMetrics.remainingBudget).toBe(
        1500000 - result.current.derivedMetrics.projectedTotal
      );
      expect(result.current.error).toBeNull();
    });
  });

  describe('Boundary 3: State Consistency (Atomic Proposal Batching & CAS Conflict Recovery)', () => {
    it('aborts an entire multi-mutation proposal atomically when any single operation fails', () => {
      const plan = structuredClone(INITIAL_EVENT_PLAN);

      const invalidProposal: Proposal = {
        summary: 'Invalid proposal testing atomic rollback',
        operations: [
          {
            type: 'SET_DETAILS',
            title: 'Valid New Event Title',
          },
          {
            type: 'UPDATE_BUDGET_ITEM',
            itemId: 'non-existent-item-id-99999', // Fails here
            estimatedCost: 80000,
          },
          {
            type: 'ADD_BUDGET_ITEM',
            name: 'Ghost Item',
            category: 'entertainment',
            estimatedCost: 10000,
          },
        ],
      };

      const outcome = applyProposal(plan, invalidProposal);

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.failedOperationIndex).toBe(1);
      }

      // Canonical state preservation: original plan must remain 100% untouched
      expect(plan.title).toBe(INITIAL_EVENT_PLAN.title);
      expect(plan.items.length).toBe(INITIAL_EVENT_PLAN.items.length);
    });

    it('rejects stale server proposal when baseVersion does not match current plan version', () => {
      const { result } = renderHook(() => useEventPlan(), { wrapper });

      // Stale proposal with baseVersion = 0 (current is 1)
      const stalePlan: EventPlan = {
        ...INITIAL_EVENT_PLAN,
        version: 2,
        title: 'Stale AI Proposal',
      };

      act(() => {
        const res = result.current.applyServerProposal(stalePlan, 0); // Stale base version
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Conflict: Plan was modified/i);
      });

      // Verification: current plan title not clobbered
      expect(result.current.plan.title).toBe(INITIAL_EVENT_PLAN.title);
    });
  });

  describe('Boundary 4: Code Quality vs. Testing (Calendar & Integer Arithmetic Invariants)', () => {
    it('strictly validates real-world leap years and rejects century non-leap years (2100-02-29)', () => {
      const plan = structuredClone(INITIAL_EVENT_PLAN);

      // Valid leap day: 2028-02-29
      const validLeapMutation: PlanMutation = {
        type: 'SET_DETAILS',
        eventDate: '2028-02-29',
      };
      const mutatedValid = applyMutation(plan, validLeapMutation);
      expect(mutatedValid.eventDate).toBe('2028-02-29');

      // Invalid century non-leap day: 2100-02-29
      const invalidMutation: PlanMutation = {
        type: 'SET_DETAILS',
        eventDate: '2100-02-29',
      };
      expect(() => applyMutation(plan, invalidMutation)).toThrow();
    });

    it('enforces integer boundary invariants and prevents overflow drift', () => {
      const plan = structuredClone(INITIAL_EVENT_PLAN);
      const metrics = calculateTotals(plan);

      expect(Number.isSafeInteger(metrics.projectedTotal)).toBe(true);
      expect(Number.isSafeInteger(metrics.actualTotal)).toBe(true);
      expect(Number.isSafeInteger(metrics.remainingBudget)).toBe(true);
      expect(metrics.allocationPercent).toBeGreaterThanOrEqual(0);
    });
  });
});
