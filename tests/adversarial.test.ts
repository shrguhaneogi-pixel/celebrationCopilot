import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventPlan, EventPlanSchema } from '@/domain/event-plan.schema';
import { PlanMutationSchema, SetDetailsMutationSchema } from '@/domain/proposal.schema';
import { applyProposal, applyMutation, computeDueDate, calculateTotals } from '@/domain/planning-engine';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';
import { persistEventAtomic } from '@/lib/supabase/events';

// Top-level mock for Supabase server client
const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      update: mockUpdate,
    }),
    rpc: mockRpc,
  })),
}));

describe('Adversarial Red Team Audit: Breaking Domain, AI, and Security Boundaries', () => {
  const basePlan: EventPlan = {
    id: 'plan-adv-001',
    version: 1,
    title: 'Adversarial Test Gala',
    eventType: 'Security Gala',
    eventDate: '2028-02-29', // Leap Year
    timezone: 'Asia/Kolkata',
    location: 'Fort Knox Vault',
    guestCount: 100,
    currency: 'INR',
    totalCap: 1000000,
    items: [
      {
        id: 'item-target-1',
        name: 'Gold Plated Cutlery',
        category: 'Catering',
        estimatedCost: 100000,
        actualCost: 95000,
        status: 'committed',
      },
    ],
    milestones: [
      {
        id: 'ms-target-1',
        title: 'Initial Contract Signing',
        offsetDays: -30,
        dueDate: '2028-01-30',
        category: 'planning',
        completed: false,
      },
    ],
    vendors: [
      {
        id: 'ven-target-1',
        name: 'Apex Security Services',
        category: 'Security',
        priority: 'high',
        status: 'booked',
        suggestedQuestions: ['What is the armed escort protocol?'],
      },
    ],
    createdAt: '2026-10-29T10:00:00.000Z',
    updatedAt: '2026-10-29T10:00:00.000Z',
  };

  const mockTenantUserId = '11111111-1111-4111-a111-111111111111';
  const maliciousAttackerId = '22222222-2222-4222-a222-222222222222';
  const mockEventUuid = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimit();
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockTenantUserId } },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });
  });

  // =========================================================================
  // 1. DATE ARITHMETIC & CALENDAR ANOMALIES
  // =========================================================================
  describe('Calendar & Leap Year Boundary Stress', () => {
    it('accurately computes leap year transitions', () => {
      // Leap day: 2028-02-29 - 1 day should be 2028-02-28
      expect(computeDueDate('2028-02-29', -1)).toBe('2028-02-28');
      // Leap day + 1 day should be 2028-03-01
      expect(computeDueDate('2028-02-29', 1)).toBe('2028-03-01');
      // 2027 (non-leap): 2027-02-28 + 1 day should be 2027-03-01
      expect(computeDueDate('2027-02-28', 1)).toBe('2027-03-01');
    });

    it('safely handles malformed date strings and offsetDays without crashing or throwing RangeError', () => {
      expect(computeDueDate('not-a-date', 5)).toBeNull();
      expect(computeDueDate('', 5)).toBeNull();
      expect(computeDueDate(null, 5)).toBeNull();
      expect(computeDueDate('99999-99-99', 5)).toBeNull();
      expect(computeDueDate('2026-13-45', 5)).toBeNull();
      expect(computeDueDate('2027-02-29', 5)).toBeNull();
      expect(computeDueDate('2026-11-20', NaN)).toBeNull();
      expect(computeDueDate('2026-11-20', Infinity)).toBeNull();
      expect(computeDueDate('2026-11-20', -Infinity)).toBeNull();
      expect(computeDueDate('2026-11-20', 1.5)).toBeNull();
      expect(computeDueDate('2026-11-20', 1e16)).toBeNull();
    });

    it('handles extreme offsetDays without runtime exceptions', () => {
      // 10 years before and after
      const farPast = computeDueDate('2028-02-29', -3650);
      expect(farPast).toBeDefined();
      expect(farPast?.startsWith('2018-')).toBe(true);

      const farFuture = computeDueDate('2028-02-29', 3650);
      expect(farFuture).toBeDefined();
      expect(farFuture?.startsWith('2038-')).toBe(true);
    });

    it('strictly enforces real-world calendar dates and rejects impossible dates or non-leap anomalies', () => {
      // Invalid month/day (2026-13-45) must be rejected
      expect(
        SetDetailsMutationSchema.safeParse({ type: 'SET_DETAILS', eventDate: '2026-13-45' }).success
      ).toBe(false);

      // Non-leap Feb 29 (2027-02-29) must be rejected
      expect(
        SetDetailsMutationSchema.safeParse({ type: 'SET_DETAILS', eventDate: '2027-02-29' }).success
      ).toBe(false);

      // Leap Feb 29 (2028-02-29) must be accepted
      expect(
        SetDetailsMutationSchema.safeParse({ type: 'SET_DETAILS', eventDate: '2028-02-29' }).success
      ).toBe(true);

      // Century non-leap Feb 29 (2100-02-29) must be rejected
      expect(
        SetDetailsMutationSchema.safeParse({ type: 'SET_DETAILS', eventDate: '2100-02-29' }).success
      ).toBe(false);

      // EventPlanSchema must also reject invalid calendar date
      expect(EventPlanSchema.safeParse({ ...basePlan, eventDate: '2026-13-45' }).success).toBe(false);
      expect(EventPlanSchema.safeParse({ ...basePlan, eventDate: '2027-02-29' }).success).toBe(false);
      expect(EventPlanSchema.safeParse({ ...basePlan, eventDate: '2028-02-29' }).success).toBe(true);

      // MilestoneSchema must strictly reject impossible calendar due dates (e.g. 2026-02-31)
      const invalidMilestone = {
        ...basePlan.milestones[0],
        dueDate: '2026-02-31',
      };
      expect(EventPlanSchema.safeParse({ ...basePlan, milestones: [invalidMilestone] }).success).toBe(false);
    });
  });

  // =========================================================================
  // 2. ARITHMETIC INTEGER OVERFLOW & PRECISION DRIFT
  // =========================================================================
  describe('Arithmetic Integrity & Number Precision', () => {
    it('detects and blocks unsafe integer overflow in totals calculation', () => {
      const overflowPlan: EventPlan = {
        ...basePlan,
        items: [
          {
            id: 'item-overflow-1',
            name: 'Moon Trip',
            category: 'Travel',
            estimatedCost: Number.MAX_SAFE_INTEGER,
            actualCost: 0,
            status: 'projected',
          },
          {
            id: 'item-overflow-2',
            name: 'Mars Trip',
            category: 'Travel',
            estimatedCost: 100,
            actualCost: 0,
            status: 'projected',
          },
        ],
      };

      expect(() => calculateTotals(overflowPlan)).toThrow(/integer overflow/i);
    });

    it('rejects floating-point and negative numbers in schema parsing', () => {
      // Decimal cost should be rejected
      const decimalResult = PlanMutationSchema.safeParse({
        type: 'ADD_BUDGET_ITEM',
        name: 'Fractional Item',
        category: 'Decor',
        estimatedCost: 199.99,
      });
      expect(decimalResult.success).toBe(false);

      // Negative budget ceiling should be rejected
      const negativeResult = PlanMutationSchema.safeParse({
        type: 'UPDATE_TARGET_BUDGET',
        totalCap: -5000,
      });
      expect(negativeResult.success).toBe(false);

      // NaN should be rejected
      const nanResult = PlanMutationSchema.safeParse({
        type: 'UPDATE_GUEST_COUNT',
        guestCount: NaN,
      });
      expect(nanResult.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. PROMPT INJECTION & UN-ALLOWLISTED MUTATION ESCAPES
  // =========================================================================
  describe('AI Mutation Security & Injection Resilience', () => {
    it('blocks arbitrary un-allowlisted mutation types from bypassing schema', () => {
      const maliciousPayloads = [
        { type: 'DROP_DATABASE', target: 'events' },
        { type: 'EXECUTE_SHELL', cmd: 'rm -rf /' },
        { type: 'UPDATE_USER_ROLE', role: 'admin' },
        { type: 'EVAL_CODE', script: 'process.exit(1)' },
        { type: '__proto__', polluted: true },
      ];

      for (const payload of maliciousPayloads) {
        const parseRes = PlanMutationSchema.safeParse(payload);
        expect(parseRes.success).toBe(false);
      }
    });

    it('enforces atomic rollback when an invalid operation is embedded inside a valid proposal', () => {
      // 1 valid op, followed by 1 illegal op attempting to update a non-existent item
      const mixedProposal = {
        summary: 'Attempting mixed batch mutation',
        operations: [
          {
            type: 'UPDATE_GUEST_COUNT' as const,
            guestCount: 250,
          },
          {
            type: 'REMOVE_BUDGET_ITEM' as const,
            itemId: 'non-existent-ghost-item',
          },
        ],
      };

      const result = applyProposal(basePlan, mixedProposal);
      expect(result.success).toBe(false);

      // CRITICAL INVARIANT: The valid guestCount update must NOT be partially applied!
      if (!result.success) {
        expect(result.originalPlan.guestCount).toBe(100);
      }
    });

    it('prevents prototype pollution injection keys from corrupting plan state', () => {
      const pollutedOp = JSON.parse(`{
        "type": "SET_DETAILS",
        "title": "Clean Title",
        "__proto__": { "isAdmin": true },
        "constructor": { "prototype": { "polluted": true } }
      }`);

      const res = PlanMutationSchema.safeParse(pollutedOp);
      // Even if Zod parses with strip, applying it must not pollute Object prototype
      if (res.success) {
        const updated = applyMutation(basePlan, res.data);
        expect(Reflect.get(Object.prototype, 'isAdmin')).toBeUndefined();
        expect(Reflect.get(Object.prototype, 'polluted')).toBeUndefined();
        expect(updated.title).toBe('Clean Title');
      }
    });
  });

  // =========================================================================
  // 4. RATE LIMITER ADVERSARIAL STRESS & IP SPOOFING
  // =========================================================================
  describe('Rate Limiter Adversarial Attack Scenarios', () => {
    it('neutralizes IP spoofing attempts with malicious characters and path traversal', () => {
      const maliciousIps = [
        '../../../../etc/passwd',
        '<script>alert(1)</script>',
        '127.0.0.1; DROP TABLE events;',
        '   ',
        '',
        'undefined',
        'null',
      ];

      for (const ip of maliciousIps) {
        const result = checkRateLimit(ip);
        expect(result).toBeDefined();
        expect(typeof result.allowed).toBe('boolean');
        expect(typeof result.remaining).toBe('number');
      }
    });

    it('safely throttles rapid burst traffic at identical timestamps', () => {
      const ip = '10.99.88.77';
      const limit = 5;
      const windowMs = 10000;
      const t = 1700000000000;

      // 5 allowed
      for (let i = 0; i < limit; i++) {
        expect(checkRateLimit(ip, limit, windowMs, t).allowed).toBe(true);
      }

      // 6th rejected
      const blocked = checkRateLimit(ip, limit, windowMs, t);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  // =========================================================================
  // 5. SUPABASE CAS CONCURRENCY & TENANCY ISOLATION
  // =========================================================================
  describe('Supabase Multi-Tenant RLS & CAS Concurrency Simulation', () => {
    it('detects concurrency conflict when expectedRevision does not match current state', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null });
      const res = await persistEventAtomic(mockEventUuid, mockTenantUserId, 1, {
        ...basePlan,
        id: mockEventUuid,
      });
      expect(res.success).toBe(false);
      expect(res.conflict).toBe(true);
      expect(res.code).toBe('CAS_MISMATCH');
      expect(res.error).toBe('CAS_MISMATCH: The event was modified concurrently. Please refresh.');
      expect(mockRpc).toHaveBeenCalledWith('update_event_plan', expect.objectContaining({
        p_event_id: mockEventUuid,
        p_expected_version: 1,
      }));
    });

    it('strictly isolates tenant access: update with wrong userId is rejected without concurrency conflict', async () => {
      const res = await persistEventAtomic(mockEventUuid, maliciousAttackerId, 1, {
        ...basePlan,
        id: mockEventUuid,
      });
      expect(res.success).toBe(false);
      expect(res.conflict).toBeFalsy();
      expect(res.error).toContain('Unauthorized: user ID mismatch with authenticated session');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated caller when server session is missing', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'No session' },
      });
      const res = await persistEventAtomic(mockEventUuid, mockTenantUserId, 1, {
        ...basePlan,
        id: mockEventUuid,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthorized: authenticated session required');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('safely handles corrupted database payloads without throwing unhandled exceptions', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ id: 'not-a-valid-uuid', corrupted: true }],
        error: null,
      });
      const res = await persistEventAtomic(mockEventUuid, mockTenantUserId, 1, {
        ...basePlan,
        id: mockEventUuid,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Database payload corrupted');
    });

    it('successfully persists event when session and version are valid (happy path)', async () => {
      const validPlan = { ...basePlan, id: mockEventUuid, version: 2 };
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: mockEventUuid,
            user_id: mockTenantUserId,
            title: validPlan.title,
            event_date: validPlan.eventDate,
            budget_limit: validPlan.totalCap,
            plan: validPlan,
            version: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      });
      const res = await persistEventAtomic(mockEventUuid, mockTenantUserId, 1, {
        ...basePlan,
        id: mockEventUuid,
      });
      expect(res.success).toBe(true);
      expect(res.record?.id).toBe(mockEventUuid);
      expect(res.record?.version).toBe(2);
    });
  });
});
