# Celebration Copilot: System Architecture Specification

> **Status:** Active Architectural Design (As-Built Verified)
> **Last Verified:** 2026-10-29
> **Stack:** Next.js 16 App Router, React 19, TypeScript (Strict), Tailwind CSS v4, Zod, Vercel AI SDK 7.0, Supabase (PostgreSQL + Auth SSR)

---

## 1. System Context & Request Lifecycle

Celebration Copilot enforces a unidirectional, validated dataflow. The AI never has direct access to the database, application state, or arithmetic operations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER CLIENT                                  │
│                                                                             │
│  [User Conversational Prompt]                                               │
│               │                                                             │
│               ▼                                                             │
│     POST /api/planner (with current plan summary)                           │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ HTTPS (JSON)
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER: NEXT.JS APP ROUTER                          │
│                                                                             │
│  1. Inbound Request Validation                                              │
│     └── Zod schema validates { prompt, currentPlan }                        │
│                                                                             │
│  2. AI Inference Boundary                                                   │
│     └── Vercel AI SDK: generateObject({ model: google('gemini-2.0-flash') })│
│     └── Constrained output strictly enforcing ProposalSchema                │
│     └── Automated fallback to deterministic heuristic simulator if offline  │
│                                                                             │
│  3. Response Headers                                                        │
│     └── Cache-Control: private, no-cache, no-store, must-revalidate         │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ HTTPS (JSON Proposal)
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BROWSER: DETERMINISTIC ENGINE                         │
│                                                                             │
│  4. User Review & Approval                                                  │
│     └── UI renders visual proposal diff (added items, cost deltas, offsets) │
│     └── User clicks "Apply to Plan" (or dismisses proposal)                 │
│                                                                             │
│  5. Pure State Engine: applyProposal(currentPlan, proposal)                 │
│     ├── Concurrency Check: Matches active plan.version                      │
│     ├── Invariant Verification:                                             │
│     │   • ID existence for UPDATE/REMOVE mutations                          │
│     │   • Non-negative costs and guest counts                               │
│     │   • Valid ISO date strings (YYYY-MM-DD)                               │
│     ├── Atomic Application: Valid deltas applied; invalid deltas rejected   │
│     ├── Version Bump: Increment monotonic version counter (version + 1)     │
│     └── Isolated Math Recalculation:                                        │
│         • projectedTotal = sum(items.estimatedCost)                         │
│         • committedTotal = sum(items[committed/paid].actualCost)            │
│         • remainingBudget = totalCap - projectedTotal                       │
│         • milestone.dueDate = eventDate + offsetDays (UTC)                  │
│                                                                             │
│  6. State Synchronization                                                   │
│     ├── Immediate: Local React State + Browser LocalStorage                 │
│     └── Cloud Sync (Optional/Authenticated):                                │
│         Supabase Postgres RPC update_event_plan(id, revision, data)         │
│         guarded by Row-Level Security (auth.uid() = user_id)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Data Model vs. Derived Fields

To eliminate redundancy and prevent state desynchronization, the system strictly separates **persisted ground truth** from **deterministically derived values**.

### 2.1 The Canonical `EventPlan` (Ground Truth)
Stored in state and persisted to database JSONB:

```typescript
export interface EventPlan {
  id: string;             // UUID v4
  version: number;        // Monotonically increasing counter
  title: string;          // User-defined title
  eventType: string;      // Category (e.g., 'birthday', 'wedding')
  eventDate: string | null; // ISO 8601 YYYY-MM-DD
  guestCount: number;     // Integer >= 0
  currency: string;       // ISO 4217, default 'USD'
  totalCap: number;       // Budget ceiling in integer cents
  items: BudgetItem[];    // Discrete budget line items
  milestones: Milestone[];// Relative milestones
  vendors: VendorChecklistItem[]; // Categorized vendors & questions
  createdAt: string;      // ISO 8601 timestamp
  updatedAt: string;      // ISO 8601 timestamp
}
```

### 2.2 Derived Fields (Calculated on Demand)
Derived metrics are **never saved to the database** and **never generated by the AI**. They are computed dynamically by pure selector functions in `src/domain/planning-engine.ts`:

| Derived Field | Source Computation | Rationale |
| :--- | :--- | :--- |
| `projectedTotal` | $\sum \text{items.estimatedCost}$ | Guarantees exact integer sum; zero floating-point drift. |
| `committedTotal` | $\sum \text{items}[\text{status} \in \{\text{committed}, \text{paid}\}].\text{actualCost}$ | Tracks legally committed funds in real-time. |
| `actualTotal` | $\sum (\text{actualCost} \parallel \text{estimatedCost})$ | Best estimate of final expenditure. |
| `remainingBudget`| $\text{totalCap} - \text{projectedTotal}$ | Identifies variance against ceiling immediately. |
| `isOverBudget` | $\text{remainingBudget} < 0$ | Boolean trigger for UI warning banners. |
| `variancePercentage` | $\lfloor (\text{projectedTotal} / \text{totalCap}) \times 100 \rfloor$ | Visual progress bar value. |
| `milestone.dueDate` | $\text{eventDate} + \text{offsetDays}$ | Calendar target deterministically derived via UTC arithmetic. |
| `timelineProgress` | $\lfloor (\text{completedMilestones} / \text{totalMilestones}) \times 100 \rfloor$ | Milestone completion percentage. |

---

## 3. The Proposal Mutation Boundary

The LLM is constrained to outputting proposals matching the Zod schema allowlist (`src/domain/proposal.schema.ts`):

```typescript
export const PlanMutationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SET_DETAILS'),
    title: z.string().min(1).max(100).optional(),
    eventType: z.string().min(1).max(50).optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    guestCount: z.number().int().nonnegative().optional(),
    totalCap: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('ADD_BUDGET_ITEM'),
    category: BudgetCategorySchema,
    name: z.string().min(1).max(100),
    estimatedCost: z.number().int().nonnegative(),
    notes: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal('UPDATE_BUDGET_ITEM'),
    itemId: z.string(),
    name: z.string().min(1).max(100).optional(),
    category: BudgetCategorySchema.optional(),
    estimatedCost: z.number().int().nonnegative().optional(),
    actualCost: z.number().int().nonnegative().optional(),
    status: z.enum(['projected', 'quoted', 'committed', 'paid']).optional(),
    notes: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal('REMOVE_BUDGET_ITEM'),
    itemId: z.string(),
  }),
  z.object({
    type: z.literal('ADD_MILESTONE'),
    title: z.string().min(1).max(100),
    offsetDays: z.number().int(),
    category: z.enum(['planning', 'booking', 'execution', 'post_event']),
  }),
  z.object({
    type: z.literal('UPDATE_MILESTONE'),
    milestoneId: z.string(),
    title: z.string().min(1).max(100).optional(),
    offsetDays: z.number().int().optional(),
    completed: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('REMOVE_MILESTONE'),
    milestoneId: z.string(),
  }),
  z.object({
    type: z.literal('ADD_VENDOR'),
    category: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    priority: z.enum(['high', 'medium', 'low']),
    suggestedQuestions: z.array(z.string().min(1).max(200)).max(5),
  }),
  z.object({
    type: z.literal('UPDATE_VENDOR'),
    vendorId: z.string(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    status: z.enum(['not_started', 'contacted', 'quoted', 'booked']).optional(),
    suggestedQuestions: z.array(z.string().min(1).max(200)).max(5).optional(),
  }),
  z.object({
    type: z.literal('REMOVE_VENDOR'),
    vendorId: z.string(),
  }),
]);
```

---

## 4. Invariant Checking & Error Recovery

### 4.1 Invariant Rules
The pure engine (`src/domain/planning-engine.ts`) enforces the following invariants:
1. **Target ID Existence:** An `UPDATE_BUDGET_ITEM`, `REMOVE_BUDGET_ITEM`, `UPDATE_MILESTONE`, `REMOVE_MILESTONE`, `UPDATE_VENDOR`, or `REMOVE_VENDOR` mutation must specify an ID that exists in the current plan. If the ID does not exist, the mutation is added to `rejectedMutations` and the plan is untouched.
2. **Integer Currency Non-Negativity:** `estimatedCost`, `actualCost`, and `totalCap` must be non-negative integers representing cents.
3. **Monotonic Versioning:** Every successful batch of mutations increments `plan.version` by exactly 1 and updates `updatedAt` with an ISO timestamp.
4. **Chronological Milestone Sorting:** Any addition or offset update automatically sorts `plan.milestones` ascending by `offsetDays`.

### 4.2 Optimistic Concurrency Control
When persisting to cloud storage (Supabase PostgreSQL), atomic updates are managed through the `update_event_plan` stored procedure:
```sql
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
```
If the affected row count is 0, a concurrent modification conflict is detected, preventing silent overwrite of remote state.

---

## 5. Security & Boundary Isolation

### 5.1 Client vs. Server Code Separation
* **Client Boundary:** UI components, React context (`EventPlanContext`), and LocalStorage operations operate solely on serialized `EventPlan` structures. No secret API keys are ever bundled or exposed to the client.
* **Server Boundary:** `/api/planner` runs exclusively on the Node.js runtime. Secrets (`GOOGLE_GENERATIVE_AI_API_KEY`) are accessed via `process.env`.

### 5.2 Cache & Cookie Directives
In accordance with Next.js App Router security patterns, all endpoints delivering user-specific plans or handling auth tokens enforce strict private caching directives:
```typescript
response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
response.headers.set('Pragma', 'no-cache');
response.headers.set('Expires', '0');
```

### 5.3 PostgreSQL Row-Level Security (RLS)
Supabase policies verify direct tenant ownership on every query:
```sql
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read own events"
ON public.events FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update own events"
ON public.events FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete own events"
ON public.events FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```
*(Avoids the vulnerable `USING (auth.uid() IS NOT NULL)` anti-pattern).*
