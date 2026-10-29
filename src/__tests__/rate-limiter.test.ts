import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  DEFAULT_RATE_LIMIT,
  DEFAULT_WINDOW_MS,
  MAX_STORE_ENTRIES,
} from '@/lib/rate-limiter';

describe('In-Memory Sliding-Window Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it('allows requests within limit and reports correct remaining quota', () => {
    const ip = '192.168.1.1';
    for (let i = 1; i <= DEFAULT_RATE_LIMIT; i++) {
      const result = checkRateLimit(ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DEFAULT_RATE_LIMIT - i);
      expect(result.resetMs).toBeGreaterThan(0);
      expect(result.resetMs).toBeLessThanOrEqual(DEFAULT_WINDOW_MS);
    }
  });

  it('blocks requests exceeding limit with allowed: false and remaining: 0', () => {
    const ip = '192.168.1.2';
    // Exhaust allowance
    for (let i = 0; i < DEFAULT_RATE_LIMIT; i++) {
      checkRateLimit(ip);
    }

    // 16th attempt
    const blocked = checkRateLimit(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
    expect(blocked.resetMs).toBeLessThanOrEqual(DEFAULT_WINDOW_MS);
  });

  it('tracks distinct identifiers independently', () => {
    const ip1 = '10.0.0.1';
    const ip2 = '10.0.0.2';

    // Exhaust ip1
    for (let i = 0; i < DEFAULT_RATE_LIMIT; i++) {
      checkRateLimit(ip1);
    }
    expect(checkRateLimit(ip1).allowed).toBe(false);

    // ip2 should still have full quota
    const resultIp2 = checkRateLimit(ip2);
    expect(resultIp2.allowed).toBe(true);
    expect(resultIp2.remaining).toBe(DEFAULT_RATE_LIMIT - 1);
  });

  it('correctly rolls off expired timestamps in sliding window', () => {
    const ip = '10.0.0.3';
    const limit = 3;
    const windowMs = 1000;
    const baseTime = 1_000_000;

    // Send 3 requests at t = 1000000, 1000100, 1000200
    expect(checkRateLimit(ip, limit, windowMs, baseTime).allowed).toBe(true);
    expect(checkRateLimit(ip, limit, windowMs, baseTime + 100).allowed).toBe(true);
    expect(checkRateLimit(ip, limit, windowMs, baseTime + 200).allowed).toBe(true);

    // 4th request at t = 1000300 should be rejected
    const blocked = checkRateLimit(ip, limit, windowMs, baseTime + 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // resetMs should be baseTime + windowMs - (baseTime + 300) = 1000 - 300 = 700 ms
    expect(blocked.resetMs).toBe(700);

    // Advance time past the 1st request expiration (t = baseTime + 1001)
    // Oldest request at baseTime has rolled off, so one slot opens
    const allowedAfterRoll = checkRateLimit(ip, limit, windowMs, baseTime + 1001);
    expect(allowedAfterRoll.allowed).toBe(true);
    expect(allowedAfterRoll.remaining).toBe(0); // 2 existing in window + 1 new = 3 / limit 3 -> 0 remaining
  });

  it('resets rate limit cleanly for a specific identifier, whitespace identifier, or globally', () => {
    const ip1 = '172.16.0.1';
    const ip2 = '172.16.0.2';

    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip1);
      checkRateLimit(ip2);
    }

    // Reset only ip1
    resetRateLimit(ip1);
    expect(checkRateLimit(ip1).remaining).toBe(DEFAULT_RATE_LIMIT - 1);
    // ip2 still has count 5 (remaining = 15 - 6 = 9)
    expect(checkRateLimit(ip2).remaining).toBe(DEFAULT_RATE_LIMIT - 6);

    // Reset whitespace identifier normalized cleanly without clearing others
    checkRateLimit('   ');
    expect(checkRateLimit('   ').remaining).toBe(DEFAULT_RATE_LIMIT - 2);
    resetRateLimit('   ');
    expect(checkRateLimit('   ').remaining).toBe(DEFAULT_RATE_LIMIT - 1);
    // ip2 should be unaffected
    expect(checkRateLimit(ip2).remaining).toBe(DEFAULT_RATE_LIMIT - 7);

    // Reset with empty string clears only empty/unknown identifier without wiping all
    resetRateLimit('');
    expect(checkRateLimit('').remaining).toBe(DEFAULT_RATE_LIMIT - 1);
    expect(checkRateLimit(ip2).remaining).toBe(DEFAULT_RATE_LIMIT - 8);

    // Reset all globally when no arg passed
    resetRateLimit();
    expect(checkRateLimit(ip2).remaining).toBe(DEFAULT_RATE_LIMIT - 1);
  });

  it('handles empty or whitespace identifiers gracefully', () => {
    const result1 = checkRateLimit('   ');
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(DEFAULT_RATE_LIMIT - 1);

    const result2 = checkRateLimit('');
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(DEFAULT_RATE_LIMIT - 2);
  });

  it('handles limit <= 0 safely without runtime error', () => {
    const ip = '10.0.0.99';
    const zeroLimit = checkRateLimit(ip, 0, 60000);
    expect(zeroLimit.allowed).toBe(false);
    expect(zeroLimit.remaining).toBe(0);
    expect(zeroLimit.resetMs).toBe(60000);

    const negativeLimit = checkRateLimit(ip, -5, 60000);
    expect(negativeLimit.allowed).toBe(false);
    expect(negativeLimit.remaining).toBe(0);
    expect(negativeLimit.resetMs).toBe(60000);
  });

  it('handles concurrent requests arriving at identical millisecond timestamps', () => {
    const ip = '192.168.10.5';
    const limit = 4;
    const windowMs = 5000;
    const timestamp = 1_700_000_000_000;

    // 4 requests at the exact same millisecond
    for (let i = 1; i <= limit; i++) {
      const res = checkRateLimit(ip, limit, windowMs, timestamp);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - i);
      expect(res.resetMs).toBe(windowMs);
    }

    // 5th request at the exact same millisecond
    const blocked = checkRateLimit(ip, limit, windowMs, timestamp);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBe(windowMs);

    // Exactly at window boundary (timestamp + windowMs), all expired simultaneously
    const rolledOver = checkRateLimit(ip, limit, windowMs, timestamp + windowMs);
    expect(rolledOver.allowed).toBe(true);
    expect(rolledOver.remaining).toBe(limit - 1);
  });

  it('prunes expired entries and caps memory when store size exceeds MAX_STORE_ENTRIES', () => {
    const baseTime = 100_000;
    const windowMs = 1_000;

    // Fill store up to MAX_STORE_ENTRIES with unique keys at baseTime
    for (let i = 0; i < MAX_STORE_ENTRIES + 10; i++) {
      checkRateLimit(`scanner-ip-${i}`, 5, windowMs, baseTime);
    }

    // Advance time past windowMs so earlier entries are expired
    const newIp = 'new-visitor-ip';
    const result = checkRateLimit(newIp, 5, windowMs, baseTime + windowMs + 50);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('handles out-of-order timestamps or clock skew gracefully', () => {
    const ip = '10.0.0.77';
    const limit = 3;
    const windowMs = 10_000;

    // Initial request at t = 5000
    checkRateLimit(ip, limit, windowMs, 5000);
    // Clock drift back to t = 4000
    checkRateLimit(ip, limit, windowMs, 4000);
    // Request at t = 6000 (reaches limit 3)
    const third = checkRateLimit(ip, limit, windowMs, 6000);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    // 4th request at t = 6100 should be rejected
    const blocked = checkRateLimit(ip, limit, windowMs, 6100);
    expect(blocked.allowed).toBe(false);
    // Oldest timestamp is properly 4000 (due to sorting)
    // resetMs = 4000 + 10000 - 6100 = 7900 ms
    expect(blocked.resetMs).toBe(7900);
  });
});
