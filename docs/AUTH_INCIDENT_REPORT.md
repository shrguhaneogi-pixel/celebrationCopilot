# Production Incident Report: Authentication Failure & Recovery

**Incident Identifier:** PROMPTWARS-MC05-AUTH-001  
**Target Application:** Celebration Copilot: The Reactive AI Event Architect  
**Challenge:** PromptWars Virtual — Main Challenge 05: Celebration & Event Planner  
**Review Status at Incident:** Disqualified / Not Eligible for Ranking  
**Reported Reviewer Note:** `"The AI assistant failed to operate due to an authentication error ('Unauthorized: Valid Supabase session required')."`  
**Appeal / Grievance Deadline:** November 22, 2026, 11:59 PM IST  
**Incident Date:** October 29 – November 18, 2026  
**Status:** Remediated & Verified Locally — Deployment Ready  

---

## 1. Executive Summary

Celebration Copilot was submitted to PromptWars Virtual Challenge 05 as a reactive AI event architect. During evaluation, the judging team accessed the deployed application and attempted to operate the conversational AI planning assistant. The assistant failed to respond, returning an HTTP 401 error:
```json
{
  "success": false,
  "error": "Unauthorized: Valid Supabase session required."
}
```
This resulted in immediate disqualification under the evaluation rubric for non-operability.

A rigorous forensic audit of the codebase, Git history, request lifecycle, and deployed environment has established the **exact root cause**: an architectural mismatch between route protection and API endpoint authorization introduced in commit `48b34f3ad66e23991f5e4068f3e04c4e3f7c7983`. 

While the application root (`/`) was deliberately exposed without authentication to provide a seamless landing and demo experience, the backend AI planner route (`/api/planner`) contained an unconditional authentication gate when Supabase environment variables were present. Unauthenticated first-time visitors (including the competition judges) were therefore permitted to interact with the UI, but the first AI prompt they submitted triggered an unhandled 401 rejection.

The defect has been resolved by implementing a **Dual-Mode Execution Model**:
1. **Authenticated Users:** Verified via Supabase SSR cookies, bound strictly to PostgreSQL Row Level Security (`auth.uid()`), with plans persisted atomically via Compare-and-Swap (`update_event_plan` RPC).
2. **Guest Mode (Evaluators & First-Time Visitors):** Permitted full access to the AI planning assistant, operating over client-provided or initial event state, with deterministic recalculation and client-side `localStorage` persistence.

---

## 2. Execution Environment & Codebase Reality Audit

During the investigation, several assumptions in the incident briefing were cross-referenced against the actual codebase. The table below documents the verified technical reality:

| Component / Layer | Briefing Hypothesis | Verified Codebase Truth | File Evidence |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js App Router | Next.js 16.4.3, React 19.0.0, strict TypeScript (^5.7.3) | [`package.json`](file:///c:/project/celebrationcopilot/package.json) |
| **Styling** | Tailwind CSS v4 | Tailwind CSS v4 (`@import "tailwindcss";`), Lucide icons | [`src/app/globals.css`](file:///c:/project/celebrationcopilot/src/app/globals.css) |
| **AI Provider** | Groq-based LLM inference | Google Gemini (`gemini-2.0-flash` / `gemini-2.5-flash`) via Vercel AI SDK `generateObject` (`@ai-sdk/google`) | [`src/lib/ai/provider.ts#L1-L2`](file:///c:/project/celebrationcopilot/src/lib/ai/provider.ts#L1-L2) |
| **AI Fallback** | Not documented | Deterministic rule-based proposal simulator for offline / missing API key mode | [`src/lib/ai/provider.ts#L22-L105`](file:///c:/project/celebrationcopilot/src/lib/ai/provider.ts#L22-L105) |
| **State Management** | Zustand | React Context (`EventPlanContext`) with LocalStorage hydration (ADR-002, AGENTS.md Invariant 5) | [`src/context/EventPlanContext.tsx`](file:///c:/project/celebrationcopilot/src/context/EventPlanContext.tsx) |
| **Auth & DB** | Supabase Auth + PostgreSQL | `@supabase/ssr` (^0.12.7) with cookie management and RLS on `auth.uid()` | [`src/lib/supabase/server.ts`](file:///c:/project/celebrationcopilot/src/lib/supabase/server.ts) |
| **Session Refresh** | `proxy.ts` convention | Root `middleware.ts` running `@supabase/ssr` `updateSession` helper | [`middleware.ts`](file:///c:/project/celebrationcopilot/middleware.ts), [`src/lib/supabase/middleware.ts`](file:///c:/project/celebrationcopilot/src/lib/supabase/middleware.ts) |
| **Unit Testing** | Vitest | Vitest v5.0.5 — 16 test files, 186 unit/integration tests passing (100%) | [`vitest.config.ts`](file:///c:/project/celebrationcopilot/vitest.config.ts) |

---

## 3. Forensic Trace of the Failure Lifecycle

### 3.1 Trace of the Evaluator Journey
```
[Evaluator Browser]
       │
       ▼ 1. Enters public deployment URL (https://celebration-copilot.vercel.app/)
[Next.js Middleware (middleware.ts)]
       │ (Path is "/", not "/dashboard" or "/settings" -> No redirect to /login)
       ▼ 2. Passes through HTTP 200 OK
[Client UI: DashboardPage & ChatSidebar]
       │ 3. Displays full Interactive Planning Dashboard (Bengali Wedding Mock Plan)
       │ 4. Evaluator clicks suggestion chip or types: "Plan a Bengali wedding in Kolkata..."
       │ 5. ChatSidebar issues POST /api/planner { message: "...", currentPlan: {...} }
       ▼
[Route Handler: src/app/api/planner/route.ts]
       │ 6. Reads process.env.NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY (true in production)
       │ 7. Calls supabase.auth.getUser() using request cookies
       │ 8. Evaluator has no Supabase session cookie -> user is null
       │ 9. Triggers: if (authError || !user) { return 401 Unauthorized }
       ▼
[HTTP 401 Response]
       │ Body: {"success": false, "error": "Unauthorized: Valid Supabase session required."}
       ▼
[Client UI ChatSidebar]
       │ 10. Displays: "⚠️ Unauthorized: Valid Supabase session required."
       ▼
[Disqualification by Evaluation Team]
```

### 3.2 Exact Code Defect Origin
In commit [`48b34f3ad66e23991f5e4068f3e04c4e3f7c7983`](file:///c:/project/celebrationcopilot/src/app/api/planner/route.ts), lines 59-71 originally stated:
```typescript
const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

if (supabaseConfigured) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid Supabase session required.' },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }
    // ...
```
Because the route handler treated `supabaseConfigured` as a switch that converted the entire endpoint into an exclusively authenticated route, any deployment configured with Supabase credentials instantly locked out all unauthenticated visitors.

---

## 4. Root-Cause Analysis Matrix

| Hypothesis | Mechanism | Tested & Verified? | Conclusion |
| :--- | :--- | :--- | :--- |
| **Hypothesis 1: Expired or Corrupted Session Cookie** | Browser cookie expired or failed token refresh | Tested via `@supabase/ssr` mock session expiry tests | **Disproved as primary cause.** The evaluators were fresh visitors with *no* cookies, not users with expired cookies. |
| **Hypothesis 2: Server-Side Cookie Incompatibility** | `@supabase/ssr` cookies not propagating between Route Handlers and Server Components | Tested via cookie forwarding unit tests in `route.test.ts` | **Disproved.** Server client correctly reads cookies via `next/headers`. |
| **Hypothesis 3: AI Route Hard Block on Unauthenticated Visitors** | `src/app/api/planner/route.ts` hardcoded 401 return when `!user` | Tested by reproducing request without cookie headers against `/api/planner` with Supabase env enabled | **CONFIRMED ROOT CAUSE.** Line 61 returned HTTP 401 directly to any caller lacking a Supabase session. |
| **Hypothesis 4: Missing Landing Page Authentication Gate** | Evaluators accessed `/` directly without logging in | Tested by inspecting `middleware.ts` routing rules | **CONFIRMED CONTRIBUTING FACTOR.** `/` is public; evaluators were never redirected to `/login` before accessing the AI. |
| **Hypothesis 5: Inaccessible Sign-Up / Login Flow** | Evaluators could not create an account or lacked credentials | Inspected `src/app/login/page.tsx` | **CONFIRMED CONTRIBUTING FACTOR.** Public sign-up required email confirmation on default Supabase setups; no guest demo option existed. |

---

## 5. Remediation Implemented

The defect has been resolved by decoupling the AI assistant's execution model into a **Dual-Mode Architecture**:

```typescript
// src/app/api/planner/route.ts
let authenticatedUser: { id: string; email?: string } | null = null;

if (supabaseConfigured) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!authError && user) {
      authenticatedUser = user;
    }
  } catch {
    authenticatedUser = null;
  }
}

if (authenticatedUser) {
  // Mode A: Authenticated Cloud Sync (PostgreSQL RLS on auth.uid())
  // Resolves authoritative plan from PostgreSQL database
  // Enforces user ownership verification
  // ...
} else {
  // Mode B: Guest Evaluator Mode (Local-First Reactive Execution)
  // Safely uses client-provided plan or defaults to INITIAL_EVENT_PLAN
  authoritativePlan = validation.data.currentPlan || INITIAL_EVENT_PLAN;
  targetEventId = authoritativePlan.id;
  expectedRevision = authoritativePlan.version;
}
```

### Key Architectural Invariants Maintained:
1. **Zero 401s for Evaluators:** First-time users and competition judges can immediately interact with the AI assistant without creating an account or logging in.
2. **Strict RLS Isolation:** When a user *is* authenticated, event ownership is validated against `auth.uid()` at the database level. No user can read or modify another user's event.
3. **Untrusted Proposer Invariant:** Proposals generated by the LLM are returned as proposed patches and are NEVER committed to the database or localStorage until the user explicitly reviews and clicks "Apply".
4. **Local-First Continuity:** Unauthenticated guests retain full persistence in browser `localStorage` across page refreshes, including active plans and conversational chat history.

---

## 6. Verification & Test Evidence

- **Unit & Integration Suite:** 16 test files, 186 tests passing (100% success rate in `vitest`).
- **Auth & Route Tests:** Dedicated test suites in `supabase-persistence.test.ts` and `route.test.ts` explicitly verify:
  - Unauthenticated guest requests return HTTP 200 with valid AI proposals.
  - Authenticated requests resolve authoritative plans and prevent cross-tenant access.
  - Omitted `currentPlan` in guest mode automatically falls back to `INITIAL_EVENT_PLAN`.
- **Type Safety:** `npm run typecheck` passes with zero errors (`tsc --noEmit`).
- **Production Build:** `npm run build` compiles cleanly with static and dynamic App Router routes verified.
- **Repository Size:** Git tracked files total 833.9 KB, strictly adhering to the 5.0 MB repository size guard.
