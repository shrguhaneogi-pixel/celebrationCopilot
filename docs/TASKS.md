# Celebration Copilot: Implementation Tasks & Roadmap

> **Status:** Active Roadmap & Stage-Gate Ledger  
> **Rule:** No phase or task can be marked complete without concrete, reproducible evidence.

---

## Stage-Gate Summary Table

| Phase | Description | Owner / Role | Status | Evidence / Verification Artifact |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | Workspace Bootstrap & Size Gates | Lead Architect | **COMPLETE** | Commit `6b08e07`; `./scripts/check-size.sh` PASSED (297 KB tracked). |
| **Phase 1** | Pure Domain Model & State Engine | Domain Engineer | **COMPLETE** | 6/6 Vitest unit tests passed (`src/lib/domain/__tests__/engine.test.ts`). |
| **Phase 2** | Reactive UI Baseline (No-AI State) | Frontend Engineer| **COMPLETE** | Commit `9b35d69`; LocalStorage persistence verified. |
| **Phase 3** | AI Mutation Proposal Pipeline | AI Engineer | **COMPLETE** | Commit `6b32f48`; Route tests passing (`route.test.ts`); `next build` 0 errors. |
| **Phase 4** | Supabase Auth, Persistence & RLS | Fullstack Engineer| **PENDING** | Awaiting Supabase project URL & anon key configuration. |
| **Phase 5** | Public Deployment & Hackathon Polish | Release Engineer | **PENDING** | Blocked by Phase 4 completion. |

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

---

## Phase 1: Pure Domain Model & Deterministic State Engine

* **Objective:** Create the canonical `EventPlan` data structures, Zod mutation schemas, and pure deterministic calculation functions.
* **Dependencies:** Phase 0.
* **Tasks:**
  - [x] **TASK-101:** Define canonical `EventPlan`, `BudgetItem`, `Milestone`, and `VendorChecklistItem` interfaces in `src/lib/domain/types.ts`.  
    *Evidence:* TypeScript compiles with `"strict": true`.
  - [x] **TASK-102:** Implement Zod discriminated union `PlanMutationSchema` and `EventPlanProposalSchema` in `src/lib/domain/mutations.ts`.  
    *Evidence:* Type narrowing verified in TypeScript.
  - [x] **TASK-103:** Implement pure state engine in `src/lib/domain/engine.ts`:
    - `applyProposal(currentPlan, proposal)`: atomic updates, version increment, ID existence checking.
    - `calculateTotals(plan)`: integer-cent arithmetic for projected, committed, actual, and variance.
    - `computeDueDate(eventDate, offsetDays)`: UTC date arithmetic.  
    *Evidence:* Complete unit test suite.
  - [x] **TASK-104:** Write automated unit tests in `src/lib/domain/__tests__/engine.test.ts`.  
    *Evidence:* Ran `npm test` -> 6/6 tests passing in 21ms.

---

## Phase 2: Reactive UI Baseline (No-AI Offline Workflow)

* **Objective:** Build a responsive, accessible web UI that allows creating, editing, and tracking celebration plans entirely offline without external AI keys.
* **Dependencies:** Phase 1.
* **Tasks:**
  - [x] **TASK-201:** Implement `src/hooks/useEventPlan.ts` with LocalStorage hydration and pure mutation dispatch.  
    *Evidence:* State persists across page refreshes.
  - [x] **TASK-202:** Implement `Header.tsx` with event date, guest counter, budget ceiling, and allocation progress bar.  
    *Evidence:* Visual progress bar reflects integer variance percentage.
  - [x] **TASK-203:** Implement `BudgetTable.tsx` with inline line-item editing and payment status management (`projected`, `quoted`, `committed`, `paid`).  
    *Evidence:* Editing actual costs recalculates committed and projected totals instantly.
  - [x] **TASK-204:** Implement `TimelineView.tsx` with relative offset badges and chronological sorting.  
    *Evidence:* Adjusting event date in header updates timeline due dates immediately.
  - [x] **TASK-205:** Implement `VendorChecklist.tsx` with priority tags, booking statuses, and one-click question clipboard copy.  
    *Evidence:* Question copy button changes to "Copied!" with feedback toast.

---

## Phase 3: Conversational AI Mutation Pipeline

* **Objective:** Build the conversational AI proposal pipeline using Vercel AI SDK, strict Zod parsing, and an interactive review interface.
* **Dependencies:** Phase 2.
* **Tasks:**
  - [x] **TASK-301:** Create Next.js route handler `/api/plan/propose` using Vercel AI SDK `generateObject` with Google Gemini 2.5 Flash and offline fallback simulation.  
    *Evidence:* `src/app/api/plan/propose/route.ts` created and verified.
  - [x] **TASK-302:** Enforce `Cache-Control: private, no-cache, no-store, must-revalidate` on API route.  
    *Evidence:* Tested via `route.test.ts` checking response headers.
  - [x] **TASK-303:** Implement `ChatPanel.tsx` with quick prompt chips, latency tracking badge, and proposal diff review card.  
    *Evidence:* Applied proposals mutate state cleanly; dismissed proposals do not touch state.
  - [x] **TASK-304:** Write automated route handler unit tests in `src/app/api/plan/propose/__tests__/route.test.ts`.  
    *Evidence:* 2/2 tests passing; overall test suite 8/8 passing.
  - [x] **TASK-305:** Verify production build with `npm run build`.  
    *Evidence:* Production build exited with code 0 (`Compiled successfully in 4.4s`, static pages 5/5 generated).

---

## Phase 4: Supabase Auth, Persistence & RLS (Next Phase)

* **Objective:** Add optional cloud account synchronization, authentication, and PostgreSQL JSONB storage with Row-Level Security.
* **Dependencies:** Phase 3.
* **Blocked By:** Requires user to provide or connect Supabase credentials.
* **Tasks:**
  - [ ] **TASK-401:** Create Supabase migration script defining `public.event_plans` table with `user_id`, `version`, `data JSONB`, and timestamps.
  - [ ] **TASK-402:** Apply PostgreSQL Row-Level Security policy enforcing direct tenant ownership (`auth.uid() = user_id`).
  - [ ] **TASK-403:** Configure `@supabase/ssr` server and client utilities (`src/lib/supabase/`).
  - [ ] **TASK-404:** Implement sync reconciliation between `localStorage` and Supabase with optimistic concurrency locking (`WHERE version = :expected_version`).
  - [ ] **TASK-405:** Add user authentication modal / sign-in bar in UI.

---

## Phase 5: Public Deployment & Hackathon Polish

* **Objective:** Deploy to public web URL, verify production latency, and draft DEV challenge submission write-up.
* **Dependencies:** Phase 4.
* **Tasks:**
  - [ ] **TASK-501:** Deploy to Vercel production environment with environment variables.
  - [ ] **TASK-502:** Run live verification script (`scripts/verify-ai.ts`) against deployed production endpoint.
  - [ ] **TASK-503:** Verify repository size remains under 5 MB using `npm run check-size`.
  - [ ] **TASK-504:** Draft DEV challenge post following DEV Community Guidelines and `ai_disclosure_level: some_ai`.
