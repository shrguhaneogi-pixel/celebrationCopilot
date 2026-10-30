/**
 * In-memory sliding-window rate limiter with anonymity isolation and bounded memory management.
 * Protects AI proposal routes against upstream quota exhaustion (e.g. Gemini 2.5 Flash free tier 15 RPM).
 * Pure TypeScript, zero external dependencies.
 */

import { createHash } from 'node:crypto';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface CheckRateLimitOptions {
  limit?: number;
  windowMs?: number;
  now?: number;
  fallbackIdentifier?: string;
  requireValidIdentifier?: boolean;
}

export interface AnonymousClientMetadata {
  clientIp?: string;
  guestId?: string;
  sessionId?: string;
  userAgent?: string;
  acceptLanguage?: string;
}

export interface RequestIdentityHeaders {
  xForwardedFor?: string | null;
  xRealIp?: string | null;
  cfConnectingIp?: string | null;
  trueClientIp?: string | null;
  copilotGuestId?: string | null;
  xSessionId?: string | null;
  userAgent?: string | null;
  acceptLanguage?: string | null;
}

const rateLimitStore = new Map<string, number[]>();

export const DEFAULT_RATE_LIMIT = 15;
export const DEFAULT_WINDOW_MS = 60_000; // 1 minute
export const MAX_TRACKED_KEYS = 5_000; // Upper bound to protect memory from bot scans
export const MAX_STORE_ENTRIES = MAX_TRACKED_KEYS; // Backwards-compatible alias
export const PRUNE_THROTTLE_MS = 1_000; // Throttle full sweeps to at most once per second under load

let lastPruneTimestamp = 0;

/**
 * Computes a deterministic compact hash of client metadata.
 */
export function hashClientMetadata(metadata: string): string {
  return createHash('sha256').update(metadata).digest('hex').slice(0, 16);
}

/**
 * Extracts the first non-empty, non-placeholder IP from a comma-separated x-forwarded-for chain.
 */
function getFirstValidIpFromForwarded(header?: string | null): string | undefined {
  if (!header) return undefined;
  const parts = header.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (
      trimmed &&
      trimmed.toLowerCase() !== 'unknown' &&
      trimmed.toLowerCase() !== 'undefined' &&
      trimmed.toLowerCase() !== 'null'
    ) {
      return trimmed;
    }
  }
  return undefined;
}

/**
 * Extracts and partitions client identity for rate limiting from request headers.
 * Evaluates IP headers, then guest/session tokens, then client metadata hash,
 * preventing anonymous traffic from collapsing into a single collision bucket.
 */
export function extractClientIdentifierFromHeaders(headers: RequestIdentityHeaders): string {
  const forwardedIp = getFirstValidIpFromForwarded(headers.xForwardedFor);
  const realIp = headers.xRealIp?.trim();
  const cfConnectingIp = headers.cfConnectingIp?.trim();
  const trueClientIp = headers.trueClientIp?.trim();

  const ipCandidates = [forwardedIp, realIp, cfConnectingIp, trueClientIp];
  for (const candidate of ipCandidates) {
    if (
      candidate &&
      candidate.toLowerCase() !== 'unknown' &&
      candidate.toLowerCase() !== 'undefined' &&
      candidate.toLowerCase() !== 'null'
    ) {
      return candidate;
    }
  }

  const guestId = headers.copilotGuestId?.trim();
  if (guestId && guestId.toLowerCase() !== 'undefined' && guestId.toLowerCase() !== 'null') {
    return `guest:${guestId}`;
  }

  const sessionId = headers.xSessionId?.trim();
  if (sessionId && sessionId.toLowerCase() !== 'undefined' && sessionId.toLowerCase() !== 'null') {
    return `session:${sessionId}`;
  }

  const ua = headers.userAgent?.trim() || '';
  const lang = headers.acceptLanguage?.trim() || '';
  if (ua || lang) {
    return `anon:${hashClientMetadata(`${ua}|${lang}`)}`;
  }

  return 'anon:anonymous_guest';
}

/**
 * Derives a partitioned anonymous or client identifier from available request metadata.
 * Ensures anonymous clients do not collide into a single shared bucket.
 */
export function deriveClientIdentifier(metadata: AnonymousClientMetadata): string {
  return extractClientIdentifierFromHeaders({
    xForwardedFor: metadata.clientIp,
    copilotGuestId: metadata.guestId,
    xSessionId: metadata.sessionId,
    userAgent: metadata.userAgent,
    acceptLanguage: metadata.acceptLanguage,
  });
}

/**
 * Normalizes an identifier into a consistent map key.
 * If identifier is missing, whitespace, or invalid placeholder ('unknown', 'undefined', 'null'):
 * - If fallbackIdentifier is provided, partitions by that fallback.
 * - If requireValidIdentifier is true, returns null to indicate invalid identifier.
 * - Otherwise falls back to 'unknown'.
 */
export function normalizeIdentifier(
  identifier: string,
  fallbackIdentifier?: string,
  requireValidIdentifier?: boolean
): string | null {
  const trimmed = identifier ? identifier.trim() : '';
  const isInvalid =
    !trimmed ||
    trimmed.toLowerCase() === 'unknown' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === 'null';

  if (!isInvalid) {
    return trimmed;
  }

  const trimmedFallback = fallbackIdentifier ? fallbackIdentifier.trim() : '';
  const isFallbackInvalid =
    !trimmedFallback ||
    trimmedFallback.toLowerCase() === 'unknown' ||
    trimmedFallback.toLowerCase() === 'undefined' ||
    trimmedFallback.toLowerCase() === 'null';

  if (!isFallbackInvalid) {
    return trimmedFallback.startsWith('anon:') ||
      trimmedFallback.startsWith('guest:') ||
      trimmedFallback.startsWith('session:')
      ? trimmedFallback
      : `anon:${trimmedFallback}`;
  }

  if (requireValidIdentifier) {
    return null;
  }

  return 'unknown';
}

/**
 * Checks whether an incoming request from an identifier (e.g. client IP, guest ID, or session)
 * is within the rate limit.
 * Uses a sliding-window algorithm based on recorded timestamps.
 *
 * @param identifier Client identifier (IP address, session ID, or guest ID)
 * @param limitOrOptions Maximum allowed requests within the time window or an options object
 * @param windowMs Duration of sliding window in milliseconds (default: 60,000ms / 1 min)
 * @param now Current timestamp in ms (default: Date.now())
 * @param fallbackIdentifier Optional fallback identifier for anonymous partitioning
 */
export function checkRateLimit(
  identifier: string,
  limitOrOptions: number | CheckRateLimitOptions = DEFAULT_RATE_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS,
  now: number = Date.now(),
  fallbackIdentifier?: string
): RateLimitResult {
  let limit = DEFAULT_RATE_LIMIT;
  let effectiveWindowMs = DEFAULT_WINDOW_MS;
  let currentTimestamp = now;
  let fallback = fallbackIdentifier;
  let requireValid = false;

  if (typeof limitOrOptions === 'number') {
    limit = limitOrOptions;
    effectiveWindowMs = windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS;
    currentTimestamp = now;
  } else if (limitOrOptions && typeof limitOrOptions === 'object') {
    limit = limitOrOptions.limit ?? DEFAULT_RATE_LIMIT;
    const optWindow = limitOrOptions.windowMs ?? windowMs;
    effectiveWindowMs = optWindow > 0 ? optWindow : DEFAULT_WINDOW_MS;
    currentTimestamp = limitOrOptions.now ?? now;
    fallback = limitOrOptions.fallbackIdentifier ?? fallbackIdentifier;
    requireValid = limitOrOptions.requireValidIdentifier ?? false;
  }

  if (limit <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: effectiveWindowMs,
    };
  }

  const key = normalizeIdentifier(identifier, fallback, requireValid);

  if (key === null) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: effectiveWindowMs,
    };
  }

  const windowStart = currentTimestamp - effectiveWindowMs;

  let timestamps = rateLimitStore.get(key);

  if (timestamps) {
    timestamps = timestamps.filter((t) => t > windowStart);
    if (timestamps.length === 0) {
      rateLimitStore.delete(key);
      timestamps = undefined;
    }
  }

  const currentCount = timestamps ? timestamps.length : 0;

  if (currentCount >= limit) {
    const oldestTimestamp = timestamps?.[0] ?? currentTimestamp;
    const resetMs = Math.max(1, oldestTimestamp + effectiveWindowMs - currentTimestamp);
    // Keep rate-limited key in LRU so it is not prematurely evicted under flood
    if (timestamps) {
      rateLimitStore.delete(key);
      rateLimitStore.set(key, timestamps);
    }
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  const updated = timestamps ? [...timestamps, currentTimestamp].sort((a, b) => a - b) : [currentTimestamp];
  // True LRU: delete then set moves key to the most-recently-used end of the Map
  rateLimitStore.delete(key);
  rateLimitStore.set(key, updated);

  // Periodic capacity guard to avoid unbounded memory growth under high volume / bot scans
  if (rateLimitStore.size > MAX_TRACKED_KEYS) {
    if (Math.abs(currentTimestamp - lastPruneTimestamp) >= PRUNE_THROTTLE_MS) {
      pruneExpiredEntries(currentTimestamp, effectiveWindowMs);
      lastPruneTimestamp = currentTimestamp;
    }

    // Evict oldest (least recently used) keys until store size is within capacity
    while (rateLimitStore.size > MAX_TRACKED_KEYS) {
      const oldestKey = rateLimitStore.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      rateLimitStore.delete(oldestKey);
    }
  }

  const remaining = Math.max(0, limit - updated.length);
  const oldestTimestamp = updated[0];
  const resetMs = Math.max(1, oldestTimestamp + effectiveWindowMs - currentTimestamp);

  return {
    allowed: true,
    remaining,
    resetMs,
  };
}

/**
 * Prunes expired timestamps and entries whose windows have lapsed.
 * Returns the number of pruned entries deleted from the store.
 */
export function pruneExpiredEntries(now: number = Date.now(), windowMs: number = DEFAULT_WINDOW_MS): number {
  const effectiveWindowMs = windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS;
  const windowStart = now - effectiveWindowMs;
  let prunedCount = 0;
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const active = timestamps.filter((t) => t > windowStart);
    if (active.length === 0) {
      rateLimitStore.delete(key);
      prunedCount++;
    } else if (active.length !== timestamps.length) {
      rateLimitStore.set(key, active);
    }
  }
  return prunedCount;
}

/**
 * Returns the current number of tracked keys in the rate limiter store.
 */
export function getTrackedKeysCount(): number {
  return rateLimitStore.size;
}

/**
 * Alias for getTrackedKeysCount.
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}

/**
 * Resets the rate limit map.
 * If an identifier is specified, clears only that identifier (and any namespace prefixed variants).
 * If omitted (undefined), clears all entries.
 */
export function resetRateLimit(identifier?: string): void {
  lastPruneTimestamp = 0;
  if (identifier !== undefined) {
    const trimmed = identifier.trim();
    if (trimmed && trimmed.toLowerCase() !== 'unknown') {
      rateLimitStore.delete(trimmed);
      rateLimitStore.delete(`anon:${trimmed}`);
      rateLimitStore.delete(`guest:${trimmed}`);
      rateLimitStore.delete(`session:${trimmed}`);
    } else {
      rateLimitStore.delete('unknown');
      rateLimitStore.delete('anon:unknown');
      rateLimitStore.delete('guest:unknown');
      rateLimitStore.delete('session:unknown');
    }
  } else {
    rateLimitStore.clear();
  }
}
