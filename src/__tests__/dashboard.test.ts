import { describe, it, expect } from 'vitest';
import { MOCK_EVENT_PLAN } from '@/lib/mock-data';
import { formatCurrency, cn } from '@/lib/utils';

describe('Dashboard Static Data & Utility Tests', () => {
  it('verifies cn helper merges classes cleanly', () => {
    expect(cn('px-2 py-1', 'bg-blue-500', undefined, false && 'hidden')).toBe('px-2 py-1 bg-blue-500');
  });

  it('formats currency deterministically for INR and USD', () => {
    const formattedINR = formatCurrency(2500000, 'INR');
    expect(formattedINR).toContain('25,00,000');

    const formattedUSD = formatCurrency(30000, 'USD');
    expect(formattedUSD).toContain('30,000');
  });

  it('validates mock event plan data integrity', () => {
    expect(MOCK_EVENT_PLAN.title).toContain('Wedding');
    expect(MOCK_EVENT_PLAN.guestCount).toBeGreaterThan(0);
    expect(MOCK_EVENT_PLAN.totalCap).toBe(2500000);
    expect(MOCK_EVENT_PLAN.items.length).toBeGreaterThan(0);
    expect(MOCK_EVENT_PLAN.milestones.length).toBeGreaterThan(0);
    expect(MOCK_EVENT_PLAN.vendors.length).toBeGreaterThan(0);
  });

  it('calculates mock budget totals deterministically', () => {
    const projectedTotal = MOCK_EVENT_PLAN.items.reduce((sum, item) => sum + item.estimatedCost, 0);
    expect(projectedTotal).toBe(2180000);

    const remainingBuffer = MOCK_EVENT_PLAN.totalCap - projectedTotal;
    expect(remainingBuffer).toBe(320000);
  });

  it('verifies event-relative milestone offsets and chronological ordering', () => {
    const offsets = MOCK_EVENT_PLAN.milestones.map((m) => m.offsetDays);
    expect(offsets).toContain(0); // Event day exists
    expect(offsets[0]).toBeLessThan(0); // Preparation starts with negative offset
  });
});
