import { describe, it, expect } from 'vitest';
import { POST } from '../route';
import { createEmptyPlan } from '@/lib/domain/engine';

describe('POST /api/plan/propose Route Handler', () => {
  it('returns valid mutation proposals for offline simulation when prompt mentions catering', async () => {
    const plan = createEmptyPlan('Summer Gala', 'party');
    plan.totalCap = 500000;

    const request = new Request('http://localhost:3000/api/plan/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Add catering and dinner for 50 guests',
        currentPlan: plan,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.mutations.length).toBeGreaterThan(0);
    expect(json.data.explanation).toContain('catering');

    // Confirm cache header directive
    expect(response.headers.get('Cache-Control')).toContain('private, no-cache');
  });

  it('rejects malformed payloads with 400 Bad Request', async () => {
    const request = new Request('http://localhost:3000/api/plan/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: '', // Invalid: min(1)
        currentPlan: {},
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
  });
});
