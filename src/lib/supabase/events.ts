import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { EventPlan, EventPlanSchema } from '@/domain/event-plan.schema';
import { INITIAL_EVENT_PLAN } from '@/context/EventPlanContext';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function normalizeDbRecord(data: unknown): unknown {
  if (!isRecord(data)) return data;
  const plan = isRecord(data.plan) ? data.plan : {};
  return {
    ...data,
    title: typeof data.title === 'string' ? data.title : (typeof plan.title === 'string' ? plan.title : undefined),
    event_date: data.event_date !== undefined ? data.event_date : (plan.eventDate !== undefined ? plan.eventDate : null),
    budget_limit: typeof data.budget_limit === 'number' ? data.budget_limit : (typeof plan.totalCap === 'number' ? plan.totalCap : undefined),
    version: typeof data.version === 'number' ? data.version : (typeof data.revision === 'number' ? data.revision : (typeof plan.version === 'number' ? plan.version : undefined)),
  };
}

export const PersistedEventRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  event_date: z.string().nullable(),
  budget_limit: z.number().int(),
  plan: EventPlanSchema,
  version: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PersistedEventRecord = z.infer<typeof PersistedEventRecordSchema>;

export interface PersistenceResult {
  success: boolean;
  conflict?: boolean;
  error?: string;
  code?: string;
  record?: PersistedEventRecord;
}

/**
 * Loads the user's active event from PostgreSQL. If no event exists for the user,
 * seeds an initial canonical plan row under their auth.uid().
 */
export async function getOrCreateUserEvent(userId: string): Promise<{
  id: string;
  plan: EventPlan;
  revision: number;
}> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to load event for user ${userId}: ${fetchError.message}`);
  }

  if (existing) {
    const parsed = PersistedEventRecordSchema.safeParse(normalizeDbRecord(existing));
    if (!parsed.success) {
      throw new Error(`Database corrupted: stored plan failed canonical schema: ${parsed.error.message}`);
    }
    return {
      id: parsed.data.id,
      plan: parsed.data.plan,
      revision: parsed.data.version,
    };
  }

  // Seed default initial plan
  const seedPlan: EventPlan = {
    ...INITIAL_EVENT_PLAN,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { data: created, error: insertError } = await supabase
    .from('events')
    .insert({
      user_id: userId,
      plan: seedPlan,
      revision: 1,
    })
    .select()
    .single();

  if (insertError || !created) {
    throw new Error(`Failed to seed event for user ${userId}: ${insertError?.message || 'No row returned'}`);
  }

  const parsedCreated = PersistedEventRecordSchema.safeParse(normalizeDbRecord(created));
  if (!parsedCreated.success) {
    throw new Error(`Database corrupted: seeded event failed canonical schema: ${parsedCreated.error.message}`);
  }

  return {
    id: parsedCreated.data.id,
    plan: parsedCreated.data.plan,
    revision: parsedCreated.data.version,
  };
}

/**
 * Loads an authoritative event by ID, enforcing ownership check against auth.uid().
 * Never trusts client-supplied state.
 */
export async function getAuthoritativeEvent(eventId: string, userId: string): Promise<{
  id: string;
  plan: EventPlan;
  revision: number;
} | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const parsed = PersistedEventRecordSchema.safeParse(normalizeDbRecord(data));
  if (!parsed.success) {
    throw new Error(`Authoritative plan validation failed: ${parsed.error.message}`);
  }

  return {
    id: parsed.data.id,
    plan: parsed.data.plan,
    revision: parsed.data.version,
  };
}

/**
 * Loads an authoritative event record by ID, enforcing ownership check against auth.uid().
 * Rejects unauthenticated callers or caller ID mismatches.
 */
export async function getEventById(
  eventId: string,
  userId?: string
): Promise<PersistedEventRecord | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  if (userId && userId !== user.id) {
    return null;
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const parsed = PersistedEventRecordSchema.safeParse(normalizeDbRecord(data));
  if (!parsed.success) {
    throw new Error(`Database corrupted: event ${eventId} failed schema validation: ${parsed.error.message}`);
  }

  return parsed.data;
}

/**
 * Performs an atomic compare-and-swap (CAS) update to persist an approved plan.
 * Calls the PostgreSQL update_event_plan stored procedure with server-side auth.uid() enforcement.
 */
export async function persistEventAtomic(
  plan: EventPlan,
  expectedVersion: number
): Promise<PersistenceResult>;
export async function persistEventAtomic(
  eventId: string,
  userId: string | undefined,
  expectedRevision: number,
  nextPlan: EventPlan
): Promise<PersistenceResult>;
export async function persistEventAtomic(
  eventIdOrPlan: string | EventPlan,
  userIdOrExpectedVersion?: string | number,
  expectedRevisionOrPlan?: number | EventPlan,
  nextPlanArg?: EventPlan
): Promise<PersistenceResult> {
  const supabase = await createClient();

  // 1. Verify authenticated session via server auth.uid() (INVARIANT 4)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: 'Unauthorized: authenticated session required',
    };
  }

  // Normalize parameters
  let eventId: string;
  let userId: string | undefined;
  let expectedVersion: number;
  let plan: EventPlan;

  if (typeof eventIdOrPlan === 'object' && eventIdOrPlan !== null) {
    plan = eventIdOrPlan;
    eventId = plan.id;
    expectedVersion = typeof userIdOrExpectedVersion === 'number' ? userIdOrExpectedVersion : plan.version;
    userId = undefined;
  } else if (typeof userIdOrExpectedVersion === 'number') {
    eventId = eventIdOrPlan;
    userId = undefined;
    expectedVersion = userIdOrExpectedVersion;
    if (typeof expectedRevisionOrPlan === 'object' && expectedRevisionOrPlan !== null) {
      plan = expectedRevisionOrPlan;
    } else if (nextPlanArg) {
      plan = nextPlanArg;
    } else {
      return {
        success: false,
        error: 'Invalid arguments: EventPlan is required',
      };
    }
  } else {
    eventId = eventIdOrPlan;
    userId = typeof userIdOrExpectedVersion === 'string' ? userIdOrExpectedVersion : undefined;
    expectedVersion = typeof expectedRevisionOrPlan === 'number' ? expectedRevisionOrPlan : 1;
    if (nextPlanArg) {
      plan = nextPlanArg;
    } else if (typeof expectedRevisionOrPlan === 'object' && expectedRevisionOrPlan !== null) {
      plan = expectedRevisionOrPlan;
    } else {
      return {
        success: false,
        error: 'Invalid arguments: EventPlan is required',
      };
    }
  }

  // Enforce server-side ownership match if client provided userId
  if (userId && userId !== user.id) {
    return {
      success: false,
      error: 'Unauthorized: user ID mismatch with authenticated session',
    };
  }

  const targetEventId = eventId || plan.id;
  const nextRevision = expectedVersion + 1;
  const now = new Date().toISOString();

  const planWithVersion: EventPlan = {
    ...plan,
    id: targetEventId,
    version: nextRevision,
    updatedAt: now,
  };

  // 2. Invoke stored procedure update_event_plan for atomic CAS
  const { data, error } = await supabase.rpc('update_event_plan', {
    p_event_id: planWithVersion.id,
    p_plan: planWithVersion,
    p_expected_version: expectedVersion,
  });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const isConflict =
      error.code === 'CAS_MISMATCH' ||
      msg.includes('cas_mismatch') ||
      msg.includes('concurrency') ||
      msg.includes('conflict') ||
      msg.includes('version mismatch') ||
      msg.includes('revision mismatch') ||
      (error.code === 'P0001' && (msg.includes('version') || msg.includes('revision') || msg.includes('cas')));

    if (isConflict) {
      return {
        success: false,
        conflict: true,
        code: 'CAS_MISMATCH',
        error: 'CAS_MISMATCH: The event was modified concurrently. Please refresh.',
      };
    }

    return {
      success: false,
      error: error.message,
    };
  }

  const recordData = Array.isArray(data) ? data[0] : data;

  if (!recordData) {
    // 0 rows updated means revision !== expectedRevision or event doesn't belong to auth.uid()
    return {
      success: false,
      conflict: true,
      code: 'CAS_MISMATCH',
      error: 'CAS_MISMATCH: The event was modified concurrently. Please refresh.',
    };
  }

  // 3. Invariant 5: Strict validation without forced type casting (no 'as PersistedEventRecord')
  const parsed = PersistedEventRecordSchema.safeParse(normalizeDbRecord(recordData));
  if (!parsed.success) {
    return {
      success: false,
      error: `Database payload corrupted: ${parsed.error.message}`,
    };
  }

  return {
    success: true,
    record: parsed.data,
  };
}
