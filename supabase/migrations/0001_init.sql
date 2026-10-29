-- 1. Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance & look-up index on owner
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);

-- 3. Enable and force Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;

-- 4. RLS Policy: SELECT (Read only own events)
DROP POLICY IF EXISTS "Users can only read own events" ON public.events;
CREATE POLICY "Users can only read own events"
ON public.events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. RLS Policy: INSERT (Insert only with caller's auth.uid())
DROP POLICY IF EXISTS "Users can only insert own events" ON public.events;
CREATE POLICY "Users can only insert own events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 6. RLS Policy: UPDATE (Update only own events; prevents owner reassignment)
DROP POLICY IF EXISTS "Users can only update own events" ON public.events;
CREATE POLICY "Users can only update own events"
ON public.events
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7. RLS Policy: DELETE (Delete only own events)
DROP POLICY IF EXISTS "Users can only delete own events" ON public.events;
CREATE POLICY "Users can only delete own events"
ON public.events
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 8. Atomic Concurrency Update Function (Compare-and-Swap)
CREATE OR REPLACE FUNCTION update_event_plan(
  p_event_id UUID,
  p_expected_revision INT,
  p_new_plan JSONB
)
RETURNS SETOF public.events
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.events
  SET plan = p_new_plan,
      revision = revision + 1,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_event_id
    AND user_id = auth.uid()
    AND revision = p_expected_revision
  RETURNING *;
END;
$$;
