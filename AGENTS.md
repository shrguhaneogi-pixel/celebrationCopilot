# AGENTS.md - System Rules

1. **INVARIANT 1:** There is one canonical EventPlan model. AI output is untrusted input.
2. **INVARIANT 2:** The LLM may only request operations explicitly defined in a typed `ProposalSchema` allowlist.
3. **INVARIANT 3:** Arithmetic (budgets) and event-relative dates are 100% deterministic. The LLM must NEVER calculate financial totals.
4. **INVARIANT 4:** Enforce Supabase event ownership on the server via `auth.uid()`. Never trust client-provided owner IDs.
5. **INVARIANT 5:** No `any` types. No forced type casting.
6. **INVARIANT 6:** Implement one bounded improvement at a time. Run tests before committing.

---

## 1. Project Context & Source of Truth

Celebration Copilot converts natural-language event-planning instructions into an editable event plan containing event details, a budget, milestones, and vendor tasks. Its core differentiator is safe, consistent propagation of relevant changes without state corruption or floating-point drift.

The repository source of truth consists of:
* [`AGENTS.md`](./AGENTS.md): Persistent agent invariants and operational rules.
* [`docs/PROJECT_SPEC.md`](./docs/PROJECT_SPEC.md): Product scope, user stories, SMART goals, and reactive differentiator.
* [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): Data contracts, mutation allowlists, security boundaries, and concurrency guards.
* [`docs/DECISIONS.md`](./docs/DECISIONS.md): Architecture Decision Records (ADRs).
* [`docs/TASKS.md`](./docs/TASKS.md): Evidence-backed implementation stage gates.

If two requirements conflict across these documents, stop and report the conflict immediately instead of silently choosing one.

---

## 2. Approved Default Stack

* **Fullstack Framework:** Next.js 15 App Router, React 19, and strict TypeScript in a single repository.
* **Styling & UI:** Tailwind CSS v4 (`@import "tailwindcss";`), shadcn/ui components, Lucide icons (`lucide-react`).
* **Schema & Validation:** Zod schemas (`src/lib/domain/mutations.ts`); TypeScript types inferred from schemas where practical.
* **Domain Engine:** Pure TypeScript functions for calculations and domain invariants (`src/lib/domain/engine.ts`).
* **State Management:** Built-in React state / hooks (`useEventPlan`) with LocalStorage hydration for local-first workflows. Do not add Zustand unless a measured need and an ADR justify it.
* **Persistence & Auth:** Supabase PostgreSQL and Supabase Auth (`@supabase/ssr`) when cloud persistence is implemented.
* **AI Runtime:** Exactly one runtime model provider initially (Google Gemini 2.5 Flash via Vercel AI SDK `generateObject`), verified for structured output compliance and zero-cost free-tier allowance.
* **Testing:** Vitest for pure domain unit tests and route handler tests; React Testing Library for component tests; Playwright for browser journeys when ready.
* **Repository CI:** GitHub Actions for automated linting, testing, and size checks in the public repository.

---

## 3. Architecture Invariants

1. **One Canonical Model:** There is exactly one canonical `EventPlan` model. Never create competing copies of event truth across components.
2. **Untrusted Proposer:** AI output is untrusted input and is a proposal, never an authority. The model cannot execute code, SQL, commands, bookings, or privileged operations.
3. **Allowlisted Operations:** The LLM may only request operations explicitly defined in `PlanMutationSchema` (`SET_DETAILS`, `ADD_BUDGET_ITEM`, `UPDATE_BUDGET_ITEM`, `REMOVE_BUDGET_ITEM`, `ADD_MILESTONE`, `UPDATE_MILESTONE`, `REMOVE_MILESTONE`, `ADD_VENDOR`, `UPDATE_VENDOR`, `REMOVE_VENDOR`).
4. **Validation Pipeline:** Always validate proposals structurally with Zod, verify identifiers and permissions, apply to a copy of the latest plan, recompute derived values, verify business invariants, and only then accept/persist.
5. **State Preservation on Failure:** When schema validation, invariant checking, or persistence fails, preserve the last accepted plan completely.
6. **Deterministic Arithmetic:** Arithmetic, totals, remaining budget, and event-relative dates are 100% deterministic. Never prompt the model to calculate sums or calendar offsets.
7. **Offline Usability:** Manual user edits must work seamlessly when runtime AI is unavailable or unconfigured.
8. **Server-Enforced Ownership:** Enforce event ownership on the server via `auth.uid()` and in PostgreSQL Row-Level Security policies. Never trust an owner ID supplied by the browser.
9. **Secret Isolation:** Keep credentials (`GOOGLE_GENERATIVE_AI_API_KEY`, Supabase Service Role) strictly server-only. Never commit real secrets or `.env` files, and never prefix backend keys with `NEXT_PUBLIC_`.
10. **Data Privacy:** Avoid unnecessary personal data and do not send real guest details or private contact info to external AI models.

---

## 4. Work Method & Quality Protocols

* **Inspect State First:** Inspect repository state before every change. Run `git status --short` and preserve unrelated modifications.
* **Plan Before Modifying:** Before implementation, write a clear, bounded plan naming exact files, intended behavior, dependencies, risks, acceptance criteria, tests, and rollback path.
* **Human Approval Gate:** If a task is security-sensitive, modifies the canonical data model, or touches multiple unrelated subsystems, stop for user approval after planning.
* **One Bounded Improvement:** Implement one bounded improvement at a time. Never mix unrelated refactors with feature work.
* **Official API Verification:** Verify package APIs against current official documentation. Never invent APIs, CLI flags, model IDs, SDK signatures, or configuration options.
* **No Deprecated APIs:** Use modern, supported framework primitives.
* **Type Safety & Integrity:** Avoid `any` types and forced type casting (`as unknown as ...`). Never use blanket lint suppression, skipped tests, or weakened validation.
* **Preserve Failing Tests:** Never resolve a test failure by deleting the test or weakening its assertions without evidence and approval.
* **Verification Protocol:** After implementation, run:
  1. `npm test` — all Vitest unit tests must pass with 100% success.
  2. `npm run check-size` — verify tracked files remain strictly under 5.0 MB.
  3. `npm run build` — must compile with 0 TypeScript or linting errors.
* **Review & Commit:** Review the full diff with `git diff --check`. Commit only after verification succeeds using one descriptive commit for the single improvement. Never push or publish without explicit authorization.

---

## 5. Cost & Repository Size Limits

* **Zero-Cost Mandate:** Do not introduce paid services, credits, paid dependencies, or billing-triggering paths without explicit user approval.
* **Repository Size Guard:** Tracked repository size must remain **strictly under 5.0 MB** (organizer upper limit is 10.0 MB). Always run `./scripts/check-size.sh` before staging commits.
* **No Binary Assets:** Never commit raster images, binaries, mockups, or bundle dumps. Use vector SVGs via `lucide-react`.
* **Clean Git Hygiene:** Strictly exclude `node_modules`, `.next`, `dist`, coverage reports, temporary logs, and real environment files from git tracking.

---

## 6. Report Format After Each Task

Every task completion report must provide:
1. **What changed and why.**
2. **Exact files changed.**
3. **Commands and tests actually run and their results.**
4. **Dependencies added or removed (and why).**
5. **Security, behavior, or size risks.**
6. **Outstanding assumptions and the next smallest task.**
7. **Proposed commit message** (create commit only after successful checks).
