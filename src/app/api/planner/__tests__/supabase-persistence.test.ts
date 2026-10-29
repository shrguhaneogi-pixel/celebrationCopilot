import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { EventPlan } from '@/domain/event-plan.schema';
import * as supabaseServer from '@/lib/supabase/server';
import * as eventsDb from '@/lib/supabase/events';
import * as provider from '@/lib/ai/provider';

describe('POST /api/planner - Supabase SSR Auth, RLS, & Atomic Concurrency', () => {
  const mockUserId = '11111111-1111-4111-a111-111111111111';
  const otherUserId = '22222222-2222-4222-a222-222222222222';
  const mockEventId = '123e4567-e89b-12d3-a456-426614174000';

  const authoritativeDbPlan: EventPlan = {
    id: mockEventId,
    version: 1,
    title: 'Authentic DB Wedding',
    eventType: 'Wedding',
    eventDate: '2026-12-15',
    timezone: 'Asia/Kolkata',
    location: 'Leela Palace',
    guestCount: 200,
    currency: 'INR',
    totalCap: 1500000,
    items: [
      {
        id: 'item-venue',
        name: 'Grand Ballroom',
        category: 'venue',
        estimatedCost: 600000,
        actualCost: 0,
        status: 'projected',
      },
    ],
    milestones: [
      {
        id: 'ms-venue',
        title: 'Book Ballroom',
        offsetDays: -90,
        dueDate: '2026-09-16',
        category: 'venue',
        completed: true,
      },
    ],
    vendors: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with HTTP 401 Unauthorized', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    // Mock server supabase returning unauthenticated user
    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: null },
          error: { message: 'Invalid JWT' },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Increase guests to 250',
        eventId: mockEventId,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Unauthorized');
  });

  it('loads authoritative plan from database and ignores client-supplied plan without committing before approval', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    // Authenticated user session
    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: mockUserId, email: 'owner@celebration.com' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    // Mock authoritative DB fetch returning DB plan with guestCount = 200
    vi.spyOn(eventsDb, 'getAuthoritativeEvent').mockResolvedValueOnce({
      id: mockEventId,
      plan: authoritativeDbPlan,
      revision: 1,
    });

    const persistSpy = vi.spyOn(eventsDb, 'persistEventAtomic');

    // Client passes a forged currentPlan with guestCount = 999
    const clientForgedPlan = { ...authoritativeDbPlan, guestCount: 999 };

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Increase guests to 250',
        eventId: mockEventId,
        currentPlan: clientForgedPlan,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.plan.guestCount).toBe(250);
    expect(data.revision).toBe(1); // Unchanged until approved!

    // Verify AI received the authoritative DB plan (200), NOT client-supplied forged plan (999)
    expect(eventsDb.getAuthoritativeEvent).toHaveBeenCalledWith(mockEventId, mockUserId);
    // Invariant: persistEventAtomic must NOT be called during proposal generation
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('rejects access when user attempts to access an event belonging to another user (RLS guard)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    // Authenticated as User 2
    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: otherUserId, email: 'attacker@celebration.com' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    // DB fetch returns null because RLS policy (auth.uid() = user_id) blocks reading User 1's event
    vi.spyOn(eventsDb, 'getAuthoritativeEvent').mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Steal event details',
        eventId: mockEventId,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Event not found or access denied');
    expect(eventsDb.getAuthoritativeEvent).toHaveBeenCalledWith(mockEventId, otherUserId);
  });

  it('detects a revision race and reports conflict when atomic compare-and-swap encounters stale revision via RPC', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValueOnce({
        data: null, // CAS failed: 0 rows updated
        error: null,
      }),
    };

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
      mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
    );

    const result = await eventsDb.persistEventAtomic(
      mockEventId,
      mockUserId,
      1, // Expected revision 1
      authoritativeDbPlan
    );

    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.code).toBe('CAS_MISMATCH');
    expect(result.error).toBe('CAS_MISMATCH: The event was modified concurrently. Please refresh.');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_event_plan', {
      p_event_id: mockEventId,
      p_plan: expect.objectContaining({ version: 2 }),
      p_expected_version: 1,
    });
  });

  it('successfully updates event via update_event_plan RPC when authenticated and version matches', async () => {
    const updatedPlan: EventPlan = {
      ...authoritativeDbPlan,
      version: 2,
    };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: mockEventId,
            user_id: mockUserId,
            title: updatedPlan.title,
            event_date: updatedPlan.eventDate,
            budget_limit: updatedPlan.totalCap,
            plan: updatedPlan,
            version: 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        error: null,
      }),
    };

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
      mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
    );

    const result = await eventsDb.persistEventAtomic(
      mockEventId,
      mockUserId,
      1,
      authoritativeDbPlan
    );

    expect(result.success).toBe(true);
    expect(result.record?.id).toBe(mockEventId);
    expect(result.record?.version).toBe(2);
    expect(result.record?.plan.version).toBe(2);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_event_plan', {
      p_event_id: mockEventId,
      p_plan: expect.objectContaining({ version: 2 }),
      p_expected_version: 1,
    });
  });

  it('rejects update when caller has no authenticated Supabase session', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Session expired' },
        }),
      },
      rpc: vi.fn(),
    };

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
      mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
    );

    const result = await eventsDb.persistEventAtomic(
      mockEventId,
      mockUserId,
      1,
      authoritativeDbPlan
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized: authenticated session required');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('rejects update when client-provided userId does not match session auth.uid()', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      rpc: vi.fn(),
    };

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
      mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
    );

    const result = await eventsDb.persistEventAtomic(
      mockEventId,
      otherUserId,
      1,
      authoritativeDbPlan
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized: user ID mismatch with authenticated session');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('safely handles corrupted database returns without blind type casting or unhandled exceptions', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValueOnce({
        data: [{ id: 'not-a-valid-uuid', corrupted: true }],
        error: null,
      }),
    };

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
      mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
    );

    const result = await eventsDb.persistEventAtomic(
      mockEventId,
      mockUserId,
      1,
      authoritativeDbPlan
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database payload corrupted');
  });

  it('preserves database state without writing when AI proposal violates domain invariants', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-anon-key');

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: { id: mockUserId, email: 'owner@celebration.com' } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>);

    vi.spyOn(eventsDb, 'getAuthoritativeEvent').mockResolvedValueOnce({
      id: mockEventId,
      plan: authoritativeDbPlan,
      revision: 1,
    });

    // Mock AI returning an operation targeting an invalid missing item
    vi.spyOn(provider, 'generatePlannerProposal').mockResolvedValueOnce({
      summary: 'Invalid mutation proposal',
      operations: [
        {
          type: 'REMOVE_BUDGET_ITEM',
          itemId: 'ghost-item-does-not-exist',
        },
      ],
    });

    const persistSpy = vi.spyOn(eventsDb, 'persistEventAtomic');

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Remove missing item',
        eventId: mockEventId,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('does not exist in the plan');

    // Invariant: persistEventAtomic must NOT be called on invariant failure!
    expect(persistSpy).not.toHaveBeenCalled();
  });

  describe('getEventById helper', () => {
    it('returns event record when authenticated owner requests it', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: mockEventId,
                    user_id: mockUserId,
                    plan: authoritativeDbPlan,
                    revision: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
        mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
      );

      const record = await eventsDb.getEventById(mockEventId, mockUserId);
      expect(record).not.toBeNull();
      expect(record?.id).toBe(mockEventId);
      expect(record?.user_id).toBe(mockUserId);
    });

    it('returns null when caller is unauthenticated or user ID mismatches', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No auth session' },
          }),
        },
      };

      vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
        mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
      );

      const record = await eventsDb.getEventById(mockEventId);
      expect(record).toBeNull();
    });

    it('throws descriptive error when database returns corrupted payload in getEventById', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValueOnce({
                  data: {
                    id: 'not-a-uuid',
                    user_id: mockUserId,
                    plan: { corrupted: true },
                    revision: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
        mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
      );

      await expect(eventsDb.getEventById(mockEventId, mockUserId)).rejects.toThrow(
        /Database corrupted/
      );
    });
  });

  describe('persistEventAtomic API & Schema Rigor', () => {
    it('supports 2-argument signature persistEventAtomic(plan, expectedVersion)', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValueOnce({
          data: [
            {
              id: mockEventId,
              user_id: mockUserId,
              title: authoritativeDbPlan.title,
              event_date: authoritativeDbPlan.eventDate,
              budget_limit: authoritativeDbPlan.totalCap,
              plan: { ...authoritativeDbPlan, version: 2 },
              version: 2,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      };

      vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
        mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
      );

      const result = await eventsDb.persistEventAtomic(authoritativeDbPlan, 1);

      expect(result.success).toBe(true);
      expect(result.record?.id).toBe(mockEventId);
      expect(result.record?.version).toBe(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('update_event_plan', {
        p_event_id: mockEventId,
        p_plan: expect.objectContaining({ version: 2 }),
        p_expected_version: 1,
      });
    });

    it('returns structured CAS_MISMATCH when RPC returns explicit version mismatch error object', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValueOnce({
          data: null,
          error: {
            message: 'concurrency conflict: expected version 1 does not match stored revision',
            code: 'CAS_MISMATCH',
          },
        }),
      };

      vi.spyOn(supabaseServer, 'createClient').mockResolvedValueOnce(
        mockSupabase as unknown as Awaited<ReturnType<typeof supabaseServer.createClient>>
      );

      const result = await eventsDb.persistEventAtomic(
        mockEventId,
        mockUserId,
        1,
        authoritativeDbPlan
      );

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.code).toBe('CAS_MISMATCH');
      expect(result.error).toBe('CAS_MISMATCH: The event was modified concurrently. Please refresh.');
    });

    it('strictly validates PersistedEventRecordSchema and rejects malformed fields', () => {
      const validRecord = {
        id: mockEventId,
        user_id: mockUserId,
        title: 'Authentic DB Wedding',
        event_date: '2026-12-15',
        budget_limit: 1500000,
        plan: authoritativeDbPlan,
        version: 1,
        created_at: '2026-10-29T10:00:00.000Z',
        updated_at: '2026-10-29T10:00:00.000Z',
      };

      const validResult = eventsDb.PersistedEventRecordSchema.safeParse(validRecord);
      expect(validResult.success).toBe(true);

      // Rejects non-UUID id
      expect(
        eventsDb.PersistedEventRecordSchema.safeParse({
          ...validRecord,
          id: 'invalid-not-uuid',
        }).success
      ).toBe(false);

      // Rejects non-integer budget_limit
      expect(
        eventsDb.PersistedEventRecordSchema.safeParse({
          ...validRecord,
          budget_limit: 1500.5,
        }).success
      ).toBe(false);

      // Rejects non-positive version
      expect(
        eventsDb.PersistedEventRecordSchema.safeParse({
          ...validRecord,
          version: 0,
        }).success
      ).toBe(false);
    });
  });
});
