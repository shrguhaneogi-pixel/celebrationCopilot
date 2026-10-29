import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { EventPlan } from '@/domain/event-plan.schema';
import * as provider from '@/lib/ai/provider';
import { resetRateLimit } from '@/lib/rate-limiter';

describe('POST /api/planner Route Handler', () => {
  const basePlan: EventPlan = {
    id: 'test-plan-route',
    version: 1,
    title: 'Silver Jubilee',
    eventType: 'Anniversary',
    eventDate: '2026-11-20',
    timezone: 'Asia/Kolkata',
    location: 'Taj Bangalore',
    guestCount: 100,
    currency: 'INR',
    totalCap: 500000,
    items: [
      {
        id: 'item-1',
        name: 'Banquet Hall',
        category: 'Venue',
        estimatedCost: 150000,
        actualCost: 0,
        status: 'projected',
      },
    ],
    milestones: [
      {
        id: 'ms-1',
        title: 'Sign Contract',
        offsetDays: -60,
        dueDate: '2026-09-21',
        category: 'venue',
        completed: false,
      },
    ],
    vendors: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimit();
  });

  it('returns 400 when body is malformed JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: 'invalid-json{{{',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Malformed JSON');
  });

  it('returns 400 when request body fails Zod validation', async () => {
    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({ message: '', currentPlan: {} }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid request shape');
  });

  it('generates proposal and returns updated EventPlan on valid input', async () => {
    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Increase guests to 150',
        currentPlan: basePlan,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.plan.guestCount).toBe(150);
    expect(data.plan.version).toBe(2);
    expect(data.derivedMetrics).toBeDefined();
    expect(data.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.headers.get('Cache-Control')).toContain('private, no-cache');
  });

  it('returns 422 when AI proposes an operation that violates domain invariants', async () => {
    // Mock the provider to emit a proposal targeting a non-existent item
    vi.spyOn(provider, 'generatePlannerProposal').mockResolvedValueOnce({
      summary: 'Update missing item',
      operations: [
        {
          type: 'UPDATE_BUDGET_ITEM',
          itemId: 'non-existent-id-999',
          estimatedCost: 10000,
        },
      ],
    });

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Modify non-existent item',
        currentPlan: basePlan,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('does not exist in the plan');
    // Original plan preserved
    expect(data.originalPlan.version).toBe(1);
    expect(data.originalPlan.guestCount).toBe(100);
  });

  it('returns 429 when AI provider encounters rate limits', async () => {
    vi.spyOn(provider, 'generatePlannerProposal').mockRejectedValueOnce(
      new provider.AIProviderError('Rate limit exceeded', 429, true)
    );

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Add a DJ',
        currentPlan: basePlan,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.isRetryable).toBe(true);
  });

  it('returns 504 when AI inference times out', async () => {
    vi.spyOn(provider, 'generatePlannerProposal').mockRejectedValueOnce(
      new provider.AIProviderError('Inference timed out', 504, true)
    );

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Plan the whole wedding',
        currentPlan: basePlan,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(504);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('timed out');
  });

  it('returns 429 with Retry-After header when client IP exceeds rate limit', async () => {
    const ip = '198.51.100.42';

    // Exhaust 15 allowed requests within the 1-minute window
    for (let i = 0; i < 15; i++) {
      const req = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Increase guests to 150',
          currentPlan: basePlan,
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // 16th request from the same IP must be rejected with 429 and Retry-After header
    const blockedReq = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Increase guests to 160',
        currentPlan: basePlan,
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': ip,
      },
    });

    const blockedRes = await POST(blockedReq);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    expect(Number(blockedRes.headers.get('Retry-After'))).toBeGreaterThan(0);
    const data = await blockedRes.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('Too many requests');
  });

  it('correctly handles chained x-forwarded-for headers and preserves distinct IP quotas', async () => {
    const ipExhausted = '203.0.113.195';
    const ipFresh = '198.51.100.99';

    // Exhaust ipExhausted using chained x-forwarded-for header with spaces
    for (let i = 0; i < 15; i++) {
      const req = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({
          message: 'Update plan',
          currentPlan: basePlan,
        }),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': `  ${ipExhausted}  , 10.0.0.1, 192.168.1.1`,
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    // ipExhausted should be blocked
    const blockedReq = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Update plan again',
        currentPlan: basePlan,
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `${ipExhausted}, 10.0.0.1`,
      },
    });
    const blockedRes = await POST(blockedReq);
    expect(blockedRes.status).toBe(429);

    // ipFresh using x-real-ip fallback should succeed without interference
    const freshReq = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Update plan from other client',
        currentPlan: basePlan,
      }),
      headers: {
        'Content-Type': 'application/json',
        'x-real-ip': `  ${ipFresh}  `,
      },
    });
    const freshRes = await POST(freshReq);
    expect(freshRes.status).toBe(200);
  });
});
