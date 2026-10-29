import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { EventPlan } from '@/domain/event-plan.schema';
import * as supabaseServer from '@/lib/supabase/server';
import * as eventsDb from '@/lib/supabase/events';
import * as provider from '@/lib/ai/provider';

describe('POST /api/planner - Supabase SSR Auth, RLS, & Atomic Concurrency', () => {
  const mockUserId = 'user-uuid-1111-aaaa';
  const otherUserId = 'user-uuid-2222-bbbb';
  const mockEventId = '123e4567-e89b-12d3-a456-426614174000';

  const authoritativeDbPlan: EventPlan = {
    id: 'db-event-plan-1',
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

  it('detects a revision race and reports conflict when atomic compare-and-swap encounters stale revision', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValueOnce({
                    data: null, // CAS failed: 0 rows updated
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
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
    expect(result.error).toContain('Conflict: Event was updated by another request');
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
});
