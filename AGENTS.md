# Celebration Copilot: AI Agent Guidelines & Invariants

> **Audience:** Any AI coding assistant, subagent, or developer working in this repository.  
> **Mandate:** Preserve project invariants, state safety, and architectural boundaries.

---

## 1. Core Invariants (Non-Negotiable)

1. **The AI Is An Untrusted Proposer:**
   * Never prompt an LLM to generate, calculate, or overwrite the canonical `EventPlan`.
   * The AI may only output discrete, typed mutation proposals conforming to `EventPlanProposalSchema` (`src/lib/domain/mutations.ts`).
2. **Integer Currency Arithmetic (Zero Float Drift):**
   * All costs (`estimatedCost`, `actualCost`, `totalCap`) must be stored and computed as integer cents (e.g., $10.50 is stored as `1050`).
   * Never use floating-point arithmetic for budget calculations. Formatting occurs only at the UI presentation layer via `formatCurrency`.
3. **Derived Metrics Are Never Persisted:**
   * Totals (`projectedTotal`, `committedTotal`, `remainingBudget`, `variancePercentage`) and milestone calendar due dates are derived values.
   * Never store derived fields in the canonical plan or database JSONB. Always calculate them via pure selector functions in `src/lib/domain/engine.ts`.
4. **Adaptive Milestone Dates:**
   * Milestones are anchored by relative `offsetDays` from `eventDate`.
   * When `eventDate` updates, milestone `dueDate` timestamps must be recomputed deterministically using UTC date arithmetic.
5. **Monotonic Versioning & Optimistic Locking:**
   * Every batch of applied mutations must increment `plan.version` by 1.
   * Remote persistence must enforce `UPDATE ... WHERE id = :id AND version = :expected_version`.

---

## 2. Repository & Dependency Boundaries

* **Repository Size Guard:**
  * Tracked repository size must remain **under 5.0 MB** (strict organizer upper bound is 10 MB).
  * Always run `./scripts/check-size.sh` before staging commits.
  * Never commit raster images, binaries, mockups, or bundle dumps. Use vector SVGs via `lucide-react`.
* **Framework Boundaries:**
  * Next.js 15 App Router, TypeScript (strict mode), and Tailwind CSS v4 only.
  * Do **not** introduce Python, FastAPI, PyPy, or external backend microservices.
  * Do **not** add ORMs (Prisma, Drizzle) or payment processing libraries.
* **Secret Isolation:**
  * Secret keys (`GOOGLE_GENERATIVE_AI_API_KEY`, Supabase Service Role) must reside only in server-side modules (`src/app/api/`).
  * Never prefix backend secrets with `NEXT_PUBLIC_`.

---

## 3. Verification Protocol

Before completing any task:
1. Run `npm test` — all Vitest unit tests must pass with 100% success.
2. Run `npm run check-size` — must verify repository size is strictly under budget.
3. Run `npm run build` — must compile with 0 TypeScript or linting errors.
