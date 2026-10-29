/**
 * In-memory sliding-window rate limiter.
 * Protects AI proposal routes against upstream quota exhaustion (e.g. Gemini 2.5 Flash free tier 15 RPM).
 * Pure TypeScript, zero external dependencies.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

const rateLimitStore = new Map<string, number[]>();

export const DEFAULT_RATE_LIMIT = 15;
export const DEFAULT_WINDOW_MS = 60_000; // 1 minute
export const MAX_STORE_ENTRIES = 5_000; // Upper bound to protect memory from bot scans

/**
 * Normalizes an identifier into a consistent map key.
 */
function normalizeIdentifier(identifier: string): string {
  return identifier.trim() || 'unknown';
}

/**
 * Checks whether an incoming request from an identifier (e.g. client IP) is within the rate limit.
 * Uses a sliding-window algorithm based on recorded timestamps.
 *
 * @param identifier Client identifier (IP address or session ID)
 * @param limit Maximum allowed requests within the time window (default: 15)
 * @param windowMs Duration of sliding window in milliseconds (default: 60,000ms / 1 min)
 * @param now Current timestamp in ms (default: Date.now())
 */
export function checkRateLimit(
  identifier: string,
  limit: number = DEFAULT_RATE_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
  now: number = Date.now()
): RateLimitResult {
  const effectiveWindowMs = windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS;

  if (limit <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: effectiveWindowMs,
    };
  }

  const key = normalizeIdentifier(identifier);
  const windowStart = now - effectiveWindowMs;

  let timestamps = rateLimitStore.get(key);

  if (timestamps) {
    timestamps = timestamps.filter((t) => t > windowStart);
    if (timestamps.length === 0) {
      rateLimitStore.delete(key);
      timestamps = undefined;
    } else {
      rateLimitStore.set(key, timestamps);
    }
  }

  const currentCount = timestamps ? timestamps.length : 0;

  if (currentCount >= limit) {
    const oldestTimestamp = timestamps?.[0] ?? now;
    const resetMs = Math.max(1, oldestTimestamp + effectiveWindowMs - now);
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  const updated = timestamps ? [...timestamps, now].sort((a, b) => a - b) : [now];
  rateLimitStore.set(key, updated);

  // Periodic capacity guard to avoid unbounded memory growth under high volume / bot scans
  if (rateLimitStore.size > MAX_STORE_ENTRIES) {
    for (const [storedKey, storedTimestamps] of rateLimitStore.entries()) {
      const active = storedTimestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        rateLimitStore.delete(storedKey);
      } else {
        rateLimitStore.set(storedKey, active);
      }
    }
    // If still over capacity after active sweep, evict the oldest entry
    if (rateLimitStore.size > MAX_STORE_ENTRIES) {
      const oldestKey = rateLimitStore.keys().next().value;
      if (oldestKey !== undefined) {
        rateLimitStore.delete(oldestKey);
      }
    }
  }

  const remaining = Math.max(0, limit - updated.length);
  const oldestTimestamp = updated[0];
  const resetMs = Math.max(1, oldestTimestamp + effectiveWindowMs - now);

  return {
    allowed: true,
    remaining,
    resetMs,
  };
}

/**
 * Resets the rate limit map.
 * If an identifier is specified, clears only that identifier.
 * If omitted (undefined), clears all entries.
 */
export function resetRateLimit(identifier?: string): void {
  if (identifier !== undefined) {
    const key = normalizeIdentifier(identifier);
    rateLimitStore.delete(key);
  } else {
    rateLimitStore.clear();
  }
}
