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

  it('returns 422 when AI proposes an invalid calendar date in SET_DETAILS', async () => {
    vi.spyOn(provider, 'generatePlannerProposal').mockResolvedValueOnce({
      summary: 'Reschedule to invalid date',
      operations: [
        {
          type: 'SET_DETAILS',
          eventDate: '2026-13-45',
        },
      ],
    });

    const req = new NextRequest('http://localhost:3000/api/planner', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Reschedule celebration',
        currentPlan: basePlan,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('AI proposed invalid schema');
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

  describe('Rate Limiter Anonymity Isolation (SEC-004)', () => {
    it('isolates Cloudflare cf-connecting-ip and true-client-ip headers', async () => {
      const cfIp = '192.0.2.111';
      const trueIp = '192.0.2.222';

      // Exhaust cf-connecting-ip
      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/planner', {
          method: 'POST',
          body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': cfIp,
          },
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
      }

      // 16th cf-connecting-ip request must be blocked
      const blockedReq = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': cfIp,
        },
      });
      expect((await POST(blockedReq)).status).toBe(429);

      // true-client-ip request must be isolated and allowed
      const allowedReq = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'true-client-ip': trueIp,
        },
      });
      expect((await POST(allowedReq)).status).toBe(200);
    });

    it('isolates anonymous guests using copilot_guest_id header and cookie', async () => {
      const guestAlpha = 'guest-alpha-123';
      const guestBeta = 'guest-beta-456';

      // Exhaust guest Alpha
      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/planner', {
          method: 'POST',
          body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
          headers: {
            'Content-Type': 'application/json',
            'copilot_guest_id': guestAlpha,
          },
        });
        expect((await POST(req)).status).toBe(200);
      }

      // 16th request for Alpha is blocked
      const blockedAlpha = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'copilot_guest_id': guestAlpha,
        },
      });
      expect((await POST(blockedAlpha)).status).toBe(429);

      // Guest Beta via header is unaffected
      const allowedBeta = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'copilot_guest_id': guestBeta,
        },
      });
      expect((await POST(allowedBeta)).status).toBe(200);

      // Guest Gamma via cookie is unaffected
      const allowedGammaCookie = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'copilot_guest_id=guest-gamma-789',
        },
      });
      expect((await POST(allowedGammaCookie)).status).toBe(200);
    });

    it('isolates anonymous guests using x-session-id', async () => {
      const sessionA = 'session-token-aaa';
      const sessionB = 'session-token-bbb';

      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/planner', {
          method: 'POST',
          body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': sessionA,
          },
        });
        expect((await POST(req)).status).toBe(200);
      }

      const blockedSessionA = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionA,
        },
      });
      expect((await POST(blockedSessionA)).status).toBe(429);

      const allowedSessionB = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionB,
        },
      });
      expect((await POST(allowedSessionB)).status).toBe(200);
    });

    it('isolates anonymous guests via client metadata hash without IP or session header', async () => {
      const uaA = 'Custom-Browser-A/1.0';
      const langA = 'en-US';

      const uaB = 'Custom-Browser-B/2.0';
      const langB = 'fr-CA';

      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/planner', {
          method: 'POST',
          body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
          headers: {
            'Content-Type': 'application/json',
            'user-agent': uaA,
            'accept-language': langA,
          },
        });
        expect((await POST(req)).status).toBe(200);
      }

      // Exhausted client A
      const blockedA = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'user-agent': uaA,
          'accept-language': langA,
        },
      });
      expect((await POST(blockedA)).status).toBe(429);

      // Client B with distinct User-Agent / Language is unaffected
      const allowedB = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'user-agent': uaB,
          'accept-language': langB,
        },
      });
      expect((await POST(allowedB)).status).toBe(200);
    });

    it('unmasks cf-connecting-ip when x-forwarded-for contains placeholder unknown', async () => {
      const cfIpA = '198.51.100.10';
      const cfIpB = '198.51.100.20';

      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/planner', {
          method: 'POST',
          body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': 'unknown',
            'cf-connecting-ip': cfIpA,
          },
        });
        expect((await POST(req)).status).toBe(200);
      }

      // 16th attempt for cfIpA should be blocked (429)
      const blocked = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': 'unknown',
          'cf-connecting-ip': cfIpA,
        },
      });
      expect((await POST(blocked)).status).toBe(429);

      // cfIpB should still succeed
      const allowed = new NextRequest('http://localhost:3000/api/planner', {
        method: 'POST',
        body: JSON.stringify({ message: 'Plan update', currentPlan: basePlan }),
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': 'unknown',
          'cf-connecting-ip': cfIpB,
        },
      });
      expect((await POST(allowed)).status).toBe(200);
    });
  });
});
