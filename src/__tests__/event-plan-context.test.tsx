// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { EventPlanProvider, useEventPlan, INITIAL_EVENT_PLAN } from '@/context/EventPlanContext';
import { EventPlan } from '@/domain/event-plan.schema';
import { PlanMutation } from '@/domain/proposal.schema';

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

describe('EventPlanContext Canonical State & Manual Mutations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <EventPlanProvider persistToLocalStorage={false}>
      {children}
    </EventPlanProvider>
  );

  it('hydrates initial canonical plan and computes derived metrics deterministically', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });

    expect(result.current.plan.version).toBe(1);
    expect(result.current.plan.title).toBe(INITIAL_EVENT_PLAN.title);
    expect(result.current.plan.guestCount).toBe(INITIAL_EVENT_PLAN.guestCount);
    expect(result.current.plan.totalCap).toBe(INITIAL_EVENT_PLAN.totalCap);
    expect(result.current.derivedMetrics.remainingBudget).toBe(
      INITIAL_EVENT_PLAN.totalCap - result.current.derivedMetrics.projectedTotal
    );
    expect(result.current.error).toBeNull();
  });

  it('dispatches manual UPDATE_GUEST_COUNT mutation and increments version', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });

    act(() => {
      const res = result.current.dispatchMutation({
        type: 'UPDATE_GUEST_COUNT',
        guestCount: 250,
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.guestCount).toBe(250);
    expect(result.current.plan.version).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('dispatches manual UPDATE_TARGET_BUDGET and updates derived remainingBudget', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });

    act(() => {
      const res = result.current.dispatchMutation({
        type: 'UPDATE_TARGET_BUDGET',
        totalCap: 3000000,
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.totalCap).toBe(3000000);
    expect(result.current.derivedMetrics.remainingBudget).toBe(
      3000000 - result.current.derivedMetrics.projectedTotal
    );
  });

  it('adds, updates, and removes budget items with deterministic recalculations', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const initialItemCount = result.current.plan.items.length;
    const initialProjected = result.current.derivedMetrics.projectedTotal;

    // 1. Add budget item
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'ADD_BUDGET_ITEM',
        id: 'item-custom-dj',
        name: 'Live Folk Music & DJ',
        category: 'entertainment',
        estimatedCost: 75000,
        status: 'quoted',
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.items.length).toBe(initialItemCount + 1);
    expect(result.current.derivedMetrics.projectedTotal).toBe(initialProjected + 75000);

    // 2. Update budget item
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'UPDATE_BUDGET_ITEM',
        itemId: 'item-custom-dj',
        actualCost: 70000,
        status: 'committed',
      });
      expect(res.success).toBe(true);
    });

    const updatedItem = result.current.plan.items.find((i) => i.id === 'item-custom-dj');
    expect(updatedItem?.actualCost).toBe(70000);
    expect(updatedItem?.status).toBe('committed');

    // 3. Remove budget item
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'REMOVE_BUDGET_ITEM',
        itemId: 'item-custom-dj',
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.items.length).toBe(initialItemCount);
    expect(result.current.derivedMetrics.projectedTotal).toBe(initialProjected);
  });

  it('adds, updates status, and removes milestones', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const initialMilestones = result.current.plan.milestones.length;

    // Add milestone
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'ADD_MILESTONE',
        id: 'ms-rehearsal',
        title: 'Choreography Rehearsal',
        offsetDays: -2,
        category: 'entertainment',
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.milestones.length).toBe(initialMilestones + 1);

    // Update milestone
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'UPDATE_MILESTONE',
        milestoneId: 'ms-rehearsal',
        completed: true,
      });
      expect(res.success).toBe(true);
    });

    const ms = result.current.plan.milestones.find((m) => m.id === 'ms-rehearsal');
    expect(ms?.completed).toBe(true);

    // Remove milestone
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'REMOVE_MILESTONE',
        milestoneId: 'ms-rehearsal',
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.milestones.length).toBe(initialMilestones);
  });

  it('adds, updates status, and removes vendor tasks', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const initialVendors = result.current.plan.vendors.length;

    // Add vendor
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'ADD_VENDOR',
        id: 'vendor-florist-1',
        name: 'Bloom Floral Designs',
        category: 'decor',
        priority: 'high',
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.vendors.length).toBe(initialVendors + 1);

    // Update vendor
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'UPDATE_VENDOR',
        vendorId: 'vendor-florist-1',
        status: 'booked',
      });
      expect(res.success).toBe(true);
    });

    const vendor = result.current.plan.vendors.find((v) => v.id === 'vendor-florist-1');
    expect(vendor?.status).toBe('booked');

    // Remove vendor
    act(() => {
      const res = result.current.dispatchMutation({
        type: 'REMOVE_VENDOR',
        vendorId: 'vendor-florist-1',
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.vendors.length).toBe(initialVendors);
  });

  it('preserves canonical state on domain invariant failure and sets error message', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const prevVersion = result.current.plan.version;
    const prevItemsLength = result.current.plan.items.length;

    act(() => {
      const res = result.current.dispatchMutation({
        type: 'UPDATE_BUDGET_ITEM',
        itemId: 'non-existent-item-id-999',
        estimatedCost: 100000,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    // Invariant: plan must remain pristine
    expect(result.current.plan.version).toBe(prevVersion);
    expect(result.current.plan.items.length).toBe(prevItemsLength);
    expect(result.current.error).toContain('non-existent-item-id-999');

    // Clearing error
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it('accepts valid server proposal with matching baseVersion', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const currentVersion = result.current.plan.version;

    const modifiedPlan: EventPlan = {
      ...result.current.plan,
      version: currentVersion + 1,
      guestCount: 300,
      updatedAt: new Date().toISOString(),
    };

    act(() => {
      const res = result.current.applyServerProposal(modifiedPlan, currentVersion);
      expect(res.success).toBe(true);
    });

    expect(result.current.plan.guestCount).toBe(300);
    expect(result.current.plan.version).toBe(currentVersion + 1);
    expect(result.current.error).toBeNull();
  });

  it('rejects stale server proposal when baseVersion does not match current plan version', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const initialVersion = result.current.plan.version;

    // Mutate plan to bump version to 2
    act(() => {
      result.current.dispatchMutation({
        type: 'UPDATE_GUEST_COUNT',
        guestCount: 220,
      });
    });
    expect(result.current.plan.version).toBe(initialVersion + 1);

    // Stale proposal generated against initialVersion (version 1)
    const stalePlan: EventPlan = {
      ...result.current.plan,
      guestCount: 350,
      version: 5,
    };

    act(() => {
      const res = result.current.applyServerProposal(stalePlan, initialVersion);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Conflict: Plan was modified');
    });

    // State preserved! Guest count remains 220, not overwritten by stale 350
    expect(result.current.plan.guestCount).toBe(220);
    expect(result.current.error).toContain('Conflict');
  });

  it('rejects malformed server plan at the client validation boundary', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const currentVersion = result.current.plan.version;

    // Malformed plan violating Zod schema (missing required fields)
    const malformedPlan = {
      id: 'bad-plan',
      // missing version, title, eventType, etc.
    } as unknown as EventPlan;

    act(() => {
      const res = result.current.applyServerProposal(malformedPlan, currentVersion);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Received invalid EventPlan');
    });

    // Canonical state preserved
    expect(result.current.plan.id).toBe(INITIAL_EVENT_PLAN.id);
  });

  it('resets plan cleanly when resetPlan is invoked', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });

    act(() => {
      result.current.dispatchMutation({
        type: 'UPDATE_GUEST_COUNT',
        guestCount: 500,
      });
    });
    expect(result.current.plan.guestCount).toBe(500);

    act(() => {
      result.current.resetPlan();
    });

    expect(result.current.plan.guestCount).toBe(INITIAL_EVENT_PLAN.guestCount);
    expect(result.current.plan.version).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('dispatches atomic batch of mutations via dispatchMutations without closure clobbering', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const initialVersion = result.current.plan.version;

    const mutations: PlanMutation[] = [
      {
        type: 'SET_DETAILS',
        eventDate: '2027-02-14',
        location: 'Udaipur City Palace',
      },
      {
        type: 'UPDATE_GUEST_COUNT',
        guestCount: 350,
      },
      {
        type: 'UPDATE_TARGET_BUDGET',
        totalCap: 4500000,
      },
    ];

    act(() => {
      const res = result.current.dispatchMutations(mutations);
      expect(res.success).toBe(true);
    });

    // All 3 updates applied atomically; version incremented once
    expect(result.current.plan.version).toBe(initialVersion + 1);
    expect(result.current.plan.eventDate).toBe('2027-02-14');
    expect(result.current.plan.location).toBe('Udaipur City Palace');
    expect(result.current.plan.guestCount).toBe(350);
    expect(result.current.plan.totalCap).toBe(4500000);
    expect(result.current.derivedMetrics.remainingBudget).toBe(
      4500000 - result.current.derivedMetrics.projectedTotal
    );
    expect(result.current.error).toBeNull();
  });

  it('preserves state when any mutation in a batch fails', () => {
    const { result } = renderHook(() => useEventPlan(), { wrapper });
    const initialVersion = result.current.plan.version;
    const initialGuests = result.current.plan.guestCount;

    const mutations: PlanMutation[] = [
      {
        type: 'UPDATE_GUEST_COUNT',
        guestCount: 400,
      },
      {
        type: 'REMOVE_BUDGET_ITEM',
        itemId: 'non-existent-item-id-xyz',
      },
    ];

    act(() => {
      const res = result.current.dispatchMutations(mutations);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    // Invariant: Failed batch must not leave partial mutations applied
    expect(result.current.plan.version).toBe(initialVersion);
    expect(result.current.plan.guestCount).toBe(initialGuests);
    expect(result.current.error).toBeDefined();
  });

  it('invokes update_event_plan RPC when dispatching mutations on a cloud-persisted event', async () => {
    mockRpc.mockClear();
    mockRpc.mockResolvedValueOnce({ data: [{ id: 'cloud-event-123' }], error: null });

    const cloudWrapper = ({ children }: { children: React.ReactNode }) => (
      <EventPlanProvider
        persistToLocalStorage={false}
        initialEventId="cloud-event-123"
        initialRevision={1}
      >
        {children}
      </EventPlanProvider>
    );

    const { result } = renderHook(() => useEventPlan(), { wrapper: cloudWrapper });

    act(() => {
      const res = result.current.dispatchMutation({
        type: 'UPDATE_GUEST_COUNT',
        guestCount: 300,
      });
      expect(res.success).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('update_event_plan', {
      p_event_id: 'cloud-event-123',
      p_plan: expect.objectContaining({ guestCount: 300 }),
      p_expected_version: 1,
    });
  });

  it('handles CAS conflict error from update_event_plan RPC when remote event was modified concurrently', async () => {
    mockRpc.mockClear();
    // Simulate CAS conflict: 0 rows returned
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const cloudWrapper = ({ children }: { children: React.ReactNode }) => (
      <EventPlanProvider
        persistToLocalStorage={false}
        initialEventId="cloud-event-123"
        initialRevision={1}
      >
        {children}
      </EventPlanProvider>
    );

    const { result } = renderHook(() => useEventPlan(), { wrapper: cloudWrapper });

    await act(async () => {
      result.current.dispatchMutation({
        type: 'UPDATE_GUEST_COUNT',
        guestCount: 350,
      });
    });

    expect(result.current.error).toContain('CAS Conflict');
  });
});
