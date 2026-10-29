# Celebration Copilot: Quality & Architecture Audit

> **Evaluation Date:** 2026-10-29  
> **Evaluator:** Hybrid Principal Architect, Hackathon Judge, Application Security Engineer & QA Lead  
> **Status:** Phase 1 Complete (Baseline Established)  
> **Tracked Repository Footprint:** 579,976 bytes (~566 KB) — strictly within the 5.0 MB budget  
> **Automated Test Suite:** 58 / 58 passing across 7 test suites in Vitest  

---

## 1. Executive Verdict (Baseline)

Celebration Copilot establishes an exceptionally strong engineering foundation: strict TypeScript typing, pure deterministic integer arithmetic for budget totals, UTC calendar offset math, robust Zod discriminated unions for mutation allowlists, and multi-tenant Supabase PostgreSQL Row-Level Security with compare-and-swap (CAS) revision control.

However, a ruthless architectural inspection identified **two critical data-integrity flaws**:
1. **Premature Cloud Persistence on Proposal Generation (P0):** The `/api/planner` route commits proposals to Supabase PostgreSQL *during proposal generation*, before the host reviews the proposal diff in the UI and clicks "Apply to Plan". If the host dismisses the proposal, the database row has already been modified.
2. **State Clobbering in Header Form Multi-Mutation (P1):** In `EventHeader.tsx`, editing date, guest count, and budget ceiling fires three sequential `dispatchMutation` calls within the same React state closure. The final call overwrites the earlier mutations, causing date and guest count updates to be lost.

---

## 2. Baseline Scorecard (Weighted Rubric)

| Criterion | Weight | Baseline Score | Weighted Points | Evidence & Summary Assessment |
| :--- | :---: | :---: | :---: | :--- |
| **Code Quality** | 25% | **7.5 / 10** | 18.75 / 25 | Strict TypeScript (no `any`), pure domain engine, zero lint errors. Penalized for React closure mutation clobbering in `EventHeader` and duplicate types in `mock-data.ts`. |
| **Problem Statement Alignment** | 25% | **7.0 / 10** | 17.50 / 25 | Local-first offline planning works out of the box with deterministic simulation. Penalized because "Dismiss Proposal" fails to protect remote DB state, and guest mode lacks a sign-in CTA. |
| **Security** | 20% | **7.5 / 10** | 15.00 / 20 | Strict RLS `auth.uid() = user_id`, atomic CAS stored procedure `update_event_plan`, server secret isolation. Penalized for untrusted proposer boundary leak (premature DB write) and lack of route rate limiting. |
| **Efficiency** | 15% | **8.5 / 10** | 12.75 / 15 | Tracked repo size is 566 KB (< 5.0 MB limit). Next.js Turbopack build in ~900ms. Sub-millisecond arithmetic. Penalized for multi-call database updates on header save. |
| **Testing** | 8% | **8.0 / 10** | 6.40 / 8 | 58 tests passing across domain, route, context, and integration suites. Penalized for persistence test asserting premature DB commit. |
| **Accessibility** | 7% | **7.5 / 10** | 5.25 / 7 | ARIA live regions in chat, semantic landmarks, keyboard submission (Enter/Shift+Enter). Penalized for unlabeled inputs in inline table editing. |
| **TOTAL** | **100%** | — | **75.65 / 100** | **Baseline Grade: Strong Foundation with Fixable Flaws (76/100)** |

---

## 3. Prioritized Findings Register

### [P0] SEC-001 / DATA-001: Premature Cloud Mutation During Proposal Generation
* **Severity:** Critical (Data Integrity & Architectural Invariant Failure)
* **File:** [`src/app/api/planner/route.ts`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/app/api/planner/route.ts#L155-L190)
* **Evidence:** In `POST /api/planner`, if `userId` is present, the handler automatically calls `await persistEventAtomic(targetEventId, userId, expectedRevision, result.plan)` *before returning the proposal to the client*.
* **Impact:** A proposal is an *untrusted proposal*, not an accepted plan. If the user clicks "Dismiss" in `ChatSidebar.tsx` or closes the browser tab, the event in Supabase has already been updated to the proposed plan, and revision has bumped. If the user subsequently modifies a line item, the CAS update fails with a concurrency error.
* **Remediation:** Remove premature persistence from proposal generation. Decouple proposal generation from commitment. Persist to Supabase only when the user explicitly accepts the proposal (or via a dedicated accept/sync action).

---

### [P1] DATA-002: React Closure State Clobbering in Multi-Mutation Header Save
* **Severity:** High (Data Loss in Core Workflow)
* **File:** [`src/components/dashboard/EventHeader.tsx`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/components/dashboard/EventHeader.tsx#L98-L127) & [`src/context/EventPlanContext.tsx`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/context/EventPlanContext.tsx#L158-L220)
* **Evidence:** When saving the Event Header modal:
  ```typescript
  dispatchMutation({ type: 'SET_DETAILS', eventDate, location });
  dispatchMutation({ type: 'UPDATE_GUEST_COUNT', guestCount });
  dispatchMutation({ type: 'UPDATE_TARGET_BUDGET', totalCap });
  ```
  Because `dispatchMutation` accesses `plan` from its callback closure, each call acts on the un-updated `plan`. The 3rd call (`UPDATE_TARGET_BUDGET`) overwrites the previous two calls in React state. Date and guest count edits are silently discarded.
* **Remediation:** Add atomic batch mutation capability (`dispatchBatchMutations(mutations: PlanMutation[])`) or expand `SET_DETAILS` to accept `guestCount` and `totalCap` in a single atomic dispatch.

---

### [P2] ALIGN-001: Missing Sign-In Navigation & Overzealous Middleware Redirect
* **Severity:** Medium (User Journey & Product Alignment)
* **File:** [`src/app/page.tsx`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/app/page.tsx#L40-L72) & [`src/lib/supabase/middleware.ts`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/lib/supabase/middleware.ts#L39-L52)
* **Evidence:** The top navbar contains a "Sign Out" button when authenticated, but **zero** "Sign In / Cloud Sync" CTA when in guest mode. Furthermore, `middleware.ts` forces a redirect of `/` to `/login` whenever Supabase credentials exist, preventing users from testing the promised offline-first guest workflow.
* **Remediation:** Make `/` accessible to guest users by default; provide an explicit "Sign In" button in the navbar for guest users to connect their cloud account and sync their local plan.

---

### [P2] A11Y-001: Inline Table Editing Inputs Lack Accessible Labels
* **Severity:** Medium (Accessibility)
* **File:** [`src/components/dashboard/BudgetTracker.tsx`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/components/dashboard/BudgetTracker.tsx#L398-L431)
* **Evidence:** The four inline editing input fields in `BudgetTracker.tsx` rely solely on placeholder text (`placeholder="Name"`, `placeholder="Category"`, `placeholder="Estimated"`, `placeholder="Actual"`) without `aria-label` or `<label>` elements.
* **Remediation:** Add descriptive `aria-label` attributes to all inline table editing inputs.

---

### [P3] CQ-001: Duplicate Domain Interfaces in Mock Data
* **Severity:** Low (Code Quality & Maintainability)
* **File:** [`src/lib/mock-data.ts`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/lib/mock-data.ts#L1-L56)
* **Evidence:** `mock-data.ts` re-declares `MockBudgetItem`, `MockMilestone`, `MockVendorItem`, and `MockEventPlan` instead of importing and adhering to the canonical types from `src/domain/event-plan.schema.ts`.
* **Remediation:** Re-export and type `MOCK_EVENT_PLAN` using canonical `EventPlan`.

---

### [P3] SEC-002: Missing Public AI Route Rate Limiting
* **Severity:** Low (Denial of Service / Quota Depletion)
* **File:** [`src/app/api/planner/route.ts`](file:///home/shreyas/Documents/Project/celebrationCopilot/src/app/api/planner/route.ts)
* **Evidence:** `POST /api/planner` does not enforce per-IP rate limiting, allowing rapid automated requests to exhaust Google Gemini free-tier RPM limits.
* **Remediation:** Implement an in-memory sliding-window IP rate limiter on `/api/planner` (e.g. 15 requests / minute).

---

## 4. Community Wisdom Grounding

Before designing fixes, real-world postmortems from the DEV community were reviewed:
* 🛡️ **Shared Cache & RLS Leaks:** In Next.js App Router, combining server authentication with dynamic headers requires strict `Cache-Control: private, no-cache, no-store, must-revalidate` to prevent edge proxies from caching authenticated responses ([Toritic, DEV](https://dev.to/toritic/3-production-security-pitfalls-in-nextjs-app-router-and-how-to-fix-them-5g34)).
* 🛡️ **Untrusted Model Output vs Semantics:** Schema-constrained generation only guarantees syntactic parsing; it guarantees nothing about domain validity, authorization, or user intent ([Aiexplore369zoho, DEV](https://dev.to/aiexplore369zoho/structured-output-gives-you-syntax-it-doesnt-give-you-semantics-3c13)). Prematurely persisting model output without user approval violates the untrusted proposer pattern.
