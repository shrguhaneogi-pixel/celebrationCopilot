import { createClient } from '@/lib/supabase/server';
import { EventPlan, EventPlanSchema } from '@/domain/event-plan.schema';
import { INITIAL_EVENT_PLAN } from '@/context/EventPlanContext';

export interface PersistedEventRecord {
  id: string;
  user_id: string;
  plan: EventPlan;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface PersistenceResult {
  success: boolean;
  conflict?: boolean;
  error?: string;
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
    const parsed = EventPlanSchema.safeParse(existing.plan);
    if (!parsed.success) {
      throw new Error(`Database corrupted: stored plan failed canonical schema: ${parsed.error.message}`);
    }
    return {
      id: existing.id,
      plan: parsed.data,
      revision: existing.revision,
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

  return {
    id: created.id,
    plan: seedPlan,
    revision: created.revision,
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

  const parsed = EventPlanSchema.safeParse(data.plan);
  if (!parsed.success) {
    throw new Error(`Authoritative plan validation failed: ${parsed.error.message}`);
  }

  return {
    id: data.id,
    plan: parsed.data,
    revision: data.revision,
  };
}

/**
 * Performs an atomic compare-and-swap (CAS) update to persist an approved plan.
 * Guarantees that stale requests cannot silently overwrite newer accepted plans.
 */
export async function persistEventAtomic(
  eventId: string,
  userId: string,
  expectedRevision: number,
  nextPlan: EventPlan
): Promise<PersistenceResult> {
  const supabase = await createClient();

  const nextRevision = expectedRevision + 1;
  const now = new Date().toISOString();

  const planWithVersion: EventPlan = {
    ...nextPlan,
    version: nextRevision,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from('events')
    .update({
      plan: planWithVersion,
      revision: nextRevision,
      updated_at: now,
    })
    .eq('id', eventId)
    .eq('user_id', userId)
    .eq('revision', expectedRevision) // Optimistic concurrency check!
    .select()
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data) {
    // 0 rows updated means revision !== expectedRevision or eventId doesn't belong to user
    return {
      success: false,
      conflict: true,
      error: `Conflict: Event was updated by another request (expected revision ${expectedRevision}).`,
    };
  }

  return {
    success: true,
    record: data as PersistedEventRecord,
  };
}
