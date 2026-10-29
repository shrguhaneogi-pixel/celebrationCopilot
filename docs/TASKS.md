# Celebration Copilot: Implementation Tasks & Roadmap

> **Status:** Stage-Gate Ledger (Phases 0–5 Complete)
> **Rule:** No phase or task can be marked complete without concrete, reproducible evidence.

---

## Stage-Gate Summary Table

| Phase | Description | Owner / Role | Status | Evidence / Verification Artifact |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Workspace Bootstrap & Size Gates | Lead Architect | **COMPLETE** | Commit `c2b71f9`; `./scripts/check-size.sh` PASSED (319 KB tracked); CI workflow passing. |
| **Phase 1** | Pure Domain Model & State Engine | Domain Engineer | **COMPLETE** | Commit `75c41ec`; 20/20 domain unit tests passing (27/27 overall suite); 400 KB tracked. |
| **Phase 2** | Reactive UI Baseline (No-AI State) | Frontend Engineer| **COMPLETE** | Commit `c1cadb7`; `EventPlanContext`, `Header`, `BudgetTracker`, `MilestoneTimeline`, `VendorChecklist`, and dialogs verified; 11 context unit tests passing. |
| **Phase 3** | AI Mutation Proposal Pipeline | AI Engineer | **COMPLETE** | Commit `c1cadb7`; Vercel AI SDK `@ai-sdk/google` (`gemini-2.0-flash`) + offline heuristic fallback in `/api/planner/route.ts`; 6 integration tests passing. |
| **Phase 4** | Supabase Auth, Persistence & RLS | Fullstack Engineer| **COMPLETE** | Commit `48b34f3`; `@supabase/ssr`, strict RLS migration `0001_init.sql`, atomic CAS `update_event_plan`, `/login` route; 5 persistence tests passing. |
| **Phase 5** | Release Hardening & Deployment Prep | Release Engineer | **COMPLETE** | Commits `b49f23e` & `3cfe39d`; 58/58 tests passing across 7 suites; tracked size 550 KB (< 5.0 MB); Next.js Turbopack build passing in 298ms; deployment spec verified. |

---

## Phase 0: Workspace Bootstrap & Invariant CI Gates

* **Objective:** Establish clean repository scaffolding, ESLint rules, Tailwind CSS v4 configuration, and git repository size verification under 5 MB.
* **Dependencies:** None.
* **Tasks:**
  - [x] **TASK-001:** Fast-forward local `main` with origin license (`81faed5`).
    *Evidence:* Git commit history shows fast-forward merge cleanly applied.
  - [x] **TASK-002:** Configure `.gitignore` to prevent committing `node_modules`, `.next`, coverage, or local secrets.
    *Evidence:* `.gitignore` created and verified.
  - [x] **TASK-003:** Create `scripts/check-size.sh` to enforce < 5 MB git repository limit.
    *Evidence:* Ran `./scripts/check-size.sh` -> Output: `Repository size check PASSED: Strictly within budget.`
  - [x] **TASK-004:** Configure `package.json`, `tsconfig.json`, `postcss.config.mjs`, and Tailwind CSS v4 in `src/app/globals.css`.
    *Evidence:* Successful `npm install` and Next.js compilation.
  - [x] **TASK-005:** Configure modern Flat Config ESLint (`eslint.config.mjs`), smoke test (`src/__tests__/smoke.test.ts`), and CI pipeline (`.github/workflows/ci.yml`).
    *Evidence:* Commit `c2b71f9`; `npm run check-size`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all passing.

---

## Phase 1: Pure Domain Model & Deterministic State Engine

* **Objective:** Create the canonical `EventPlan` data structures, Zod mutation schemas, and pure deterministic calculation functions.
* **Dependencies:** Phase 0.
* **Tasks:**
  - [x] **TASK-101:** Define canonical `EventPlan`, `BudgetItem`, `Milestone`, and `VendorTask` schemas and inferred types in `src/domain/event-plan.schema.ts`.
    *Evidence:* Strict Zod parsing and strict TypeScript compilation verified.
  - [x] **TASK-102:** Implement Zod discriminated union `PlanMutationSchema` and `ProposalSchema` in `src/domain/proposal.schema.ts`.
    *Evidence:* Type narrowing verified across 12 discrete mutation operations.
  - [x] **TASK-103:** Implement pure state engine in `src/domain/planning-engine.ts`:
    - `applyProposal(currentPlan, proposal)`: atomic updates, version increment, ID existence checking, and full rollback.
    - `calculateTotals(plan)`: integer minor unit arithmetic for projected, committed, actual, and variance.
    - `computeDueDate(eventDate, offsetDays)`: UTC date arithmetic.
    *Evidence:* Complete unit test suite passing in 33ms.
  - [x] **TASK-104:** Write automated unit tests in `tests/domain.test.ts` verifying 100% test pass rate across arithmetic precision, mutation safety, and invariant error boundaries.
    *Evidence:* Ran `npm test` -> 20/20 tests passing in `tests/domain.test.ts` (27/27 overall suite).

---

## Phase 2: Reactive UI Baseline (No-AI Offline Workflow)

* **Objective:** Build a responsive, accessible web UI that allows creating, editing, and tracking celebration plans entirely offline without external AI keys.
* **Dependencies:** Phase 1.
* **Tasks:**
  - [x] **TASK-201:** Implement `src/context/EventPlanContext.tsx` with LocalStorage hydration and pure mutation dispatch.
    *Evidence:* Unit tests in `src/__tests__/event-plan-context.test.tsx` (11 tests passing).
  - [x] **TASK-202:** Implement `Header.tsx` with event date, guest counter, budget ceiling, and allocation progress bar.
    *Evidence:* Rendered in main page and tested in dashboard tests.
  - [x] **TASK-203:** Implement `BudgetTracker.tsx` and `BudgetItemModal.tsx` with inline line-item editing and payment status management (`projected`, `quoted`, `committed`, `paid`).
    *Evidence:* Verified with 5 tests in `src/__tests__/dashboard.test.ts`.
  - [x] **TASK-204:** Implement `MilestoneTimeline.tsx` and `MilestoneModal.tsx` with relative offset badges, UTC due date computation, and chronological sorting.
    *Evidence:* Verified in `src/__tests__/dashboard.test.ts`.
  - [x] **TASK-205:** Implement `VendorChecklist.tsx` and `VendorModal.tsx` with priority tags, booking statuses, and one-click question clipboard copy.
    *Evidence:* Verified in `src/__tests__/dashboard.test.ts`.

---

## Phase 3: Conversational AI Mutation Pipeline

* **Objective:** Build the conversational AI proposal pipeline using Vercel AI SDK, strict Zod parsing, and an interactive review interface.
* **Dependencies:** Phase 2.
* **Tasks:**
  - [x] **TASK-301:** Create Next.js route handler `/api/planner/route.ts` using Vercel AI SDK `generateObject` with Google Gemini 2.0 Flash (`gemini-2.0-flash`) and offline heuristic fallback simulation.
    *Evidence:* Route handler unit tests in `src/app/api/planner/__tests__/route.test.ts` (6 tests passing).
  - [x] **TASK-302:** Enforce `Cache-Control: private, no-cache, no-store, must-revalidate` on API route.
    *Evidence:* Verified in `route.test.ts`.
  - [x] **TASK-303:** Implement `ChatSidebar.tsx` with quick prompt chips, latency tracking badge, and proposal diff review card.
    *Evidence:* End-to-end integration tests in `src/__tests__/chat-integration.test.tsx` (6 tests passing).
  - [x] **TASK-304:** Write automated route handler unit tests in `src/app/api/planner/__tests__/route.test.ts`.
    *Evidence:* 6/6 tests passing covering prompt parsing, mutation allowlist validation, and error states.
  - [x] **TASK-305:** Verify production build with `npm run build`.
    *Evidence:* Production build compiling in < 500ms.

---

## Phase 4: Supabase Auth, Persistence & RLS

* **Objective:** Add cloud account synchronization, authentication, and PostgreSQL JSONB storage with Row-Level Security.
* **Dependencies:** Phase 3.
* **Tasks:**
  - [x] **TASK-401:** Create Supabase migration script `supabase/migrations/0001_init.sql` defining `public.events` table with `user_id`, `revision`, `plan JSONB`, and timestamps.
    *Evidence:* Migration created with strict check constraints and owner indexes.
  - [x] **TASK-402:** Apply PostgreSQL Row-Level Security policy enforcing direct tenant ownership (`auth.uid() = user_id`) across SELECT, INSERT, UPDATE, and DELETE.
    *Evidence:* Tested and verified in `src/app/api/planner/__tests__/supabase-persistence.test.ts`.
  - [x] **TASK-403:** Configure `@supabase/ssr` server and client utilities (`src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`).
    *Evidence:* Cookie auth handling tested without deprecated auth helpers.
  - [x] **TASK-404:** Implement compare-and-swap stored procedure `update_event_plan(p_event_id, p_expected_revision, p_new_plan)` for atomic concurrency control.
    *Evidence:* 5/5 tests passing in `supabase-persistence.test.ts`.
  - [x] **TASK-405:** Add user authentication page `/login` with tabbed Sign In / Sign Up.
    *Evidence:* Accessible login route verified in production build route inventory.

---

## Phase 5: Release Hardening & Deployment Preparation

* **Objective:** Complete pre-flight audits, remove dead code, enforce repository size constraints, and prepare deployment spec.
* **Dependencies:** Phase 4.
* **Tasks:**
  - [x] **TASK-501:** Perform pre-release security and quality audit (Prompts 11–14).
    *Evidence:* Removed unused dependency `@ai-sdk/openai`; added CI build placeholder env vars.
  - [x] **TASK-502:** Verify repository size remains under 5.0 MB using `npm run check-size`.
    *Evidence:* 563,231 bytes (550 KB) tracked, strictly under the 5.0 MB limit.
  - [x] **TASK-503:** Full test suite execution across all domain, route, context, and integration suites.
    *Evidence:* 58 / 58 passing tests across 7 test suites in Vitest.
  - [x] **TASK-504:** Author production documentation: complete `README.md`, updated `docs/ARCHITECTURE.md`, `docs/PROJECT_SPEC.md`, and 2-minute judge demo script.
    *Evidence:* Verified and approved deployment plan in artifact `prompt_15_16_deployment_and_submission_plan.md`.
