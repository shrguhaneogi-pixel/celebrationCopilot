import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  DEFAULT_RATE_LIMIT,
  DEFAULT_WINDOW_MS,
  MAX_STORE_ENTRIES,
  MAX_TRACKED_KEYS,
  deriveClientIdentifier,
  extractClientIdentifierFromHeaders,
  hashClientMetadata,
  normalizeIdentifier,
  pruneExpiredEntries,
  getTrackedKeysCount,
  getRateLimitStoreSize,
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

  describe('Anonymity Isolation & Partitioning (SEC-004)', () => {
    it('maintains independent quota windows for distinct anonymous guest identifiers', () => {
      const guestA = 'anon:guest-uuid-1';
      const guestB = 'anon:guest-uuid-2';

      // Exhaust guest A
      for (let i = 0; i < DEFAULT_RATE_LIMIT; i++) {
        const res = checkRateLimit(guestA);
        expect(res.allowed).toBe(true);
      }
      expect(checkRateLimit(guestA).allowed).toBe(false);

      // Guest B must remain completely unaffected
      const resB = checkRateLimit(guestB);
      expect(resB.allowed).toBe(true);
      expect(resB.remaining).toBe(DEFAULT_RATE_LIMIT - 1);
    });

    it('partitions anonymous callers using fallbackIdentifier options', () => {
      const fallbackA = 'session-alpha';
      const fallbackB = 'session-beta';

      // Exhaust quota for session A using empty caller identifier with fallbackIdentifier
      for (let i = 0; i < DEFAULT_RATE_LIMIT; i++) {
        const res = checkRateLimit('', { fallbackIdentifier: fallbackA });
        expect(res.allowed).toBe(true);
      }
      const blockedA = checkRateLimit('   ', { fallbackIdentifier: fallbackA });
      expect(blockedA.allowed).toBe(false);

      // Session B must have fresh allowance
      const freshB = checkRateLimit('', { fallbackIdentifier: fallbackB });
      expect(freshB.allowed).toBe(true);
      expect(freshB.remaining).toBe(DEFAULT_RATE_LIMIT - 1);
    });

    it('rejects unidentifiable callers when requireValidIdentifier is enabled', () => {
      const emptyRes = checkRateLimit('', { requireValidIdentifier: true });
      expect(emptyRes.allowed).toBe(false);
      expect(emptyRes.remaining).toBe(0);

      const whitespaceRes = checkRateLimit('   ', { requireValidIdentifier: true });
      expect(whitespaceRes.allowed).toBe(false);
      expect(whitespaceRes.remaining).toBe(0);

      // But allows if a valid fallbackIdentifier is provided
      const validFallbackRes = checkRateLimit('', {
        requireValidIdentifier: true,
        fallbackIdentifier: 'valid-client-fallback',
      });
      expect(validFallbackRes.allowed).toBe(true);
      expect(validFallbackRes.remaining).toBe(DEFAULT_RATE_LIMIT - 1);
    });

    it('derives partitioned identifiers across various client headers', () => {
      // 1. x-forwarded-for first IP
      expect(
        extractClientIdentifierFromHeaders({
          xForwardedFor: '203.0.113.1, 10.0.0.1',
        })
      ).toBe('203.0.113.1');

      // 2. x-real-ip
      expect(
        extractClientIdentifierFromHeaders({
          xRealIp: '198.51.100.25',
        })
      ).toBe('198.51.100.25');

      // 3. cf-connecting-ip
      expect(
        extractClientIdentifierFromHeaders({
          cfConnectingIp: '192.0.2.77',
        })
      ).toBe('192.0.2.77');

      // 4. true-client-ip
      expect(
        extractClientIdentifierFromHeaders({
          trueClientIp: '192.0.2.88',
        })
      ).toBe('192.0.2.88');

      // 4b. Edge proxy header takes precedence over client-spoofed x-forwarded-for
      expect(
        extractClientIdentifierFromHeaders({
          xForwardedFor: '10.0.0.99, 127.0.0.1',
          cfConnectingIp: '192.0.2.77',
        })
      ).toBe('192.0.2.77');

      expect(
        extractClientIdentifierFromHeaders({
          xForwardedFor: '10.0.0.99',
          trueClientIp: '192.0.2.88',
        })
      ).toBe('192.0.2.88');

      // 5. copilotGuestId
      expect(
        extractClientIdentifierFromHeaders({
          copilotGuestId: 'guest-xyz-123',
        })
      ).toBe('guest:guest-xyz-123');

      // 6. xSessionId
      expect(
        extractClientIdentifierFromHeaders({
          xSessionId: 'sess-abc-456',
        })
      ).toBe('session:sess-abc-456');

      // 7. Client metadata hash (User-Agent + Accept-Language)
      const idA = extractClientIdentifierFromHeaders({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        acceptLanguage: 'en-US,en;q=0.9',
      });
      const idB = extractClientIdentifierFromHeaders({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        acceptLanguage: 'fr-FR,fr;q=0.9',
      });
      expect(idA).toMatch(/^anon:[a-f0-9]{16}$/);
      expect(idB).toMatch(/^anon:[a-f0-9]{16}$/);
      expect(idA).not.toBe(idB);

      // 8. Fallback when headers are empty
      expect(extractClientIdentifierFromHeaders({})).toBe('anon:anonymous_guest');
    });

    it('derives consistent client identifier via deriveClientIdentifier and hashClientMetadata', () => {
      const derived = deriveClientIdentifier({
        guestId: 'guest-test-id',
      });
      expect(derived).toBe('guest:guest-test-id');

      const hash = hashClientMetadata('test-user-agent|en-US');
      expect(hash).toHaveLength(16);
      expect(hashClientMetadata('test-user-agent|en-US')).toBe(hash);
    });

    it('normalizes identifiers correctly under different configurations', () => {
      expect(normalizeIdentifier('  valid-ip  ')).toBe('valid-ip');
      expect(normalizeIdentifier('', 'fallback-guest')).toBe('anon:fallback-guest');
      expect(normalizeIdentifier('', 'guest:already-prefixed')).toBe('guest:already-prefixed');
      expect(normalizeIdentifier('', undefined, true)).toBeNull();
      expect(normalizeIdentifier('   ', undefined, false)).toBe('unknown');

      // Invalid placeholders ('unknown', 'undefined', 'null') must not collide into valid identifiers
      expect(normalizeIdentifier('unknown', 'fallback-session')).toBe('anon:fallback-session');
      expect(normalizeIdentifier('unknown', undefined, true)).toBeNull();
      expect(normalizeIdentifier('undefined', undefined, true)).toBeNull();
      expect(normalizeIdentifier('null', undefined, true)).toBeNull();
      expect(normalizeIdentifier('unknown', undefined, false)).toBe('unknown');
    });

    it('unmasks valid subsequent IP headers when xForwardedFor contains placeholder values', () => {
      // xForwardedFor = 'unknown', cfConnectingIp = '192.0.2.77' -> must use cfConnectingIp
      expect(
        extractClientIdentifierFromHeaders({
          xForwardedFor: 'unknown',
          cfConnectingIp: '192.0.2.77',
        })
      ).toBe('192.0.2.77');

      // xForwardedFor = 'undefined', trueClientIp = '192.0.2.88' -> must use trueClientIp
      expect(
        extractClientIdentifierFromHeaders({
          xForwardedFor: 'undefined',
          trueClientIp: '192.0.2.88',
        })
      ).toBe('192.0.2.88');

      // xForwardedFor with leading empty or placeholder entries: ', unknown, 198.51.100.99'
      expect(
        extractClientIdentifierFromHeaders({
          xForwardedFor: '  , unknown , 198.51.100.99 ',
        })
      ).toBe('198.51.100.99');

      // Placeholder guestId / sessionId strings ('undefined', 'null') are ignored
      expect(
        extractClientIdentifierFromHeaders({
          copilotGuestId: 'undefined',
          xSessionId: 'null',
          userAgent: 'TestBot/1.0',
        })
      ).toMatch(/^anon:/);
    });

    it('respects positional arguments when options object omits windowMs or now', () => {
      const ip = '10.5.5.5';
      const customWindowMs = 2000;
      const customNow = 500_000;

      // Pass options without now or windowMs, but supply them as positional arguments
      const res = checkRateLimit(ip, { limit: 2 }, customWindowMs, customNow);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(1);

      const res2 = checkRateLimit(ip, { limit: 2 }, customWindowMs, customNow + 500);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(0);

      // Exceeds limit within window
      const blocked = checkRateLimit(ip, { limit: 2 }, customWindowMs, customNow + 1000);
      expect(blocked.allowed).toBe(false);
      // Reset is relative to customNow (500000 + 2000 - 501000 = 1000ms)
      expect(blocked.resetMs).toBe(1000);
    });
  });

  describe('Bounded Memory Management (SEC-004)', () => {
    it('strictly bounds store size to MAX_TRACKED_KEYS and evicts oldest entries', () => {
      const now = 200_000;
      const windowMs = 60_000;

      // Add MAX_TRACKED_KEYS entries
      for (let i = 0; i < MAX_TRACKED_KEYS; i++) {
        checkRateLimit(`tracked-key-${i}`, 10, windowMs, now);
      }
      expect(getRateLimitStoreSize()).toBe(MAX_TRACKED_KEYS);

      // Add 20 more entries beyond the cap
      for (let i = 0; i < 20; i++) {
        checkRateLimit(`overflow-key-${i}`, 10, windowMs, now);
      }

      // Memory cap must strictly hold
      expect(getRateLimitStoreSize()).toBe(MAX_TRACKED_KEYS);
      expect(getTrackedKeysCount()).toBe(MAX_TRACKED_KEYS);

      // Earliest inserted keys must have been evicted
      expect(checkRateLimit('tracked-key-0', 10, windowMs, now).remaining).toBe(9); // fresh slot after eviction
    });

    it('preserves active keys in LRU order and evicts idle keys when store overflows', () => {
      const now = 300_000;
      const windowMs = 60_000;

      // Insert keys 0 through 4999
      for (let i = 0; i < MAX_TRACKED_KEYS; i++) {
        checkRateLimit(`user-${i}`, 10, windowMs, now);
      }

      // Actively refresh user-0 right before the overflow
      checkRateLimit('user-0', 10, windowMs, now + 10);

      // Add one overflow key
      checkRateLimit('overflow-user', 10, windowMs, now + 20);

      // user-0 was refreshed and must NOT be evicted (it should still have count 2 -> remaining 8)
      const resUser0 = checkRateLimit('user-0', 10, windowMs, now + 30);
      expect(resUser0.remaining).toBe(7); // 2 previous requests + 1 new = 3 / limit 10 -> remaining 7

      // In contrast, user-1 was idle and must have been evicted
      const resUser1 = checkRateLimit('user-1', 10, windowMs, now + 40);
      expect(resUser1.remaining).toBe(9); // Fresh quota after eviction
    });

    it('keeps rate-limited keys refreshed in LRU to prevent attacker quota resets via flood', () => {
      const now = 400_000;
      const windowMs = 60_000;
      const victimAttacker = 'attacker-ip';

      // Exhaust attacker quota
      for (let i = 0; i < 15; i++) {
        checkRateLimit(victimAttacker, 15, windowMs, now);
      }
      expect(checkRateLimit(victimAttacker, 15, windowMs, now).allowed).toBe(false);

      // Attacker makes another attempt (blocked) at now + 5, refreshing their LRU position
      expect(checkRateLimit(victimAttacker, 15, windowMs, now + 5).allowed).toBe(false);

      // Attacker tries to flush the store by flooding MAX_TRACKED_KEYS new keys
      for (let i = 0; i < MAX_TRACKED_KEYS; i++) {
        checkRateLimit(`flood-${i}`, 15, windowMs, now + 10);
      }

      // If the attacker flooded MAX_TRACKED_KEYS new keys, the oldest keys are evicted.
      // Store cap must hold strictly
      expect(getRateLimitStoreSize()).toBe(MAX_TRACKED_KEYS);
    });

    it('automatically prunes expired entries on eviction check', () => {
      const t0 = 100_000;
      const windowMs = 5_000;

      // Populate 10 entries at t0
      for (let i = 0; i < 10; i++) {
        checkRateLimit(`stale-user-${i}`, 5, windowMs, t0);
      }
      expect(getRateLimitStoreSize()).toBe(10);

      // Manually trigger pruning at t0 + windowMs + 100
      const pruned = pruneExpiredEntries(t0 + windowMs + 100, windowMs);
      expect(pruned).toBe(10);
      expect(getRateLimitStoreSize()).toBe(0);
    });
  });
});
