# Celebration Copilot: Project Specification

> **Status:** Active MVP Specification  
> **Last Verified:** 2026-10-29  
> **Target Environment:** Public Web Application (Next.js 15, Tailwind CSS v4, TypeScript)  
> **Primary Repository Limit:** Under 5 MB tracked (Strict organizer upper bound: < 10 MB)  
> **AI Mutation Latency Goal:** Under 2,500 ms (measured roundtrip)

---

## 1. Overview & Pitch

**Celebration Copilot** is a reactive event-planning web application designed to help event hosts, party organizers, and couples plan milestones, budgets, and vendor checklists collaboratively with generative AI.

The core differentiator is an isolated, **deterministic state engine** that safely evaluates and applies AI-proposed mutations to an event plan without corrupting unrelated line items, hallucinating arithmetic sums, or drifting event-relative schedules.

---

## 2. Target Users & Problem Definition

### 2.1 Target Users
* **Private Event Hosts:** Individuals organizing birthdays, anniversaries, graduations, and family reunions who need structured budgeting and checklists without complex spreadsheets.
* **Couples & Wedding Planners:** Users tracking multi-category vendor commitments and event-relative deadlines (e.g., "book photographer 90 days before wedding").
* **Community Organizers:** Hackathon organizers, meetup leaders, and club coordinators planning gatherings with strict budget ceilings and volunteer milestone tracking.

### 2.2 The User Problem
1. **Spreadsheet Fragility:** Traditional spreadsheets require manual formula maintenance. A single broken cell formula results in undetected budget overruns and timeline confusion.
2. **Naive AI State Overwrites:** Standard generative AI chat tools lack persistent domain isolation. When asked to "add a DJ to the budget", an LLM routinely outputs an entirely new event plan, overwriting existing user edits, dropping unmentioned items, or generating invalid dates.
3. **Floating-Point Arithmetic Hallucinations:** Language models are not calculators; when asked to calculate total costs, remaining balances, or tax allocations, they frequently hallucinate mathematically incorrect sums.
4. **Vendor Overwhelm:** Planners are unsure what specific questions to ask prospective vendors (e.g., cancellation policies, backup equipment, delivery windows).

---

## 3. The Solution & The Reactive Differentiator

Celebration Copilot decouples **conversational planning intent** from **state mutation and arithmetic execution**:

```
[Conversational Intent]  --->  [AI: Untrusted Proposer]
                                         │ (Emits atomic mutation deltas)
                                         ▼
                               [Zod Validation Allowlist]
                                         │ (Rejects invalid shapes)
                                         ▼
                               [Pure TypeScript State Engine]
                                  • Monotonic Version Check
                                  • Integer Math (Cents)
                                  • Relative Date Resolution
                                         │
                                         ▼
                               [Updated Canonical EventPlan]
```

### The Reactive Differentiator Defined
1. **Untrusted Proposer Model:** The Large Language Model (LLM) is strictly forbidden from directly updating state or calculating totals. It is treated as an untrusted agent whose only output is an array of discrete, typed mutation proposals (`EventPlanProposal`).
2. **Schema Allowlist Enforcement:** Every proposed mutation must match a strict Zod discriminated union schema (`ADD_BUDGET_ITEM`, `UPDATE_BUDGET_ITEM`, `REMOVE_BUDGET_ITEM`, `ADD_MILESTONE`, etc.). Any unrecognized property or unallowed mutation is stripped or rejected immediately.
3. **Deterministic Math Engine:** Totals (`projectedTotal`, `committedTotal`, `actualTotal`, `remainingBudget`) are **never persisted** or set by the AI. They are computed on-the-fly using pure TypeScript integer arithmetic (in cents) to guarantee zero floating-point drift.
4. **Adaptive Event-Relative Timeline:** Milestones are defined relative to the celebration date (`offsetDays: -60` for 60 days before the event). If the event date shifts from June to October, all target calendar dates are deterministically recomputed without hallucinating invalid calendar days.

---

## 4. MVP Inclusions vs. Exclusions

### 4.1 Inclusions (In Scope)
* **Conversational Plan Modifier:** A chat interface accepting plain-English revision requests and presenting structured, reviewable proposal diffs before application.
* **Reactive Budget Tracker:** Real-time line item table supporting inline editing of categories, estimated costs, actual costs, and commitment statuses (`projected`, `quoted`, `committed`, `paid`).
* **Adaptive Milestone Timeline:** Chronologically sorted timeline with offset badges, category tags, completion checkboxes, and dynamic due date derivation.
* **Prioritized Vendor Checklist:** Categorized vendor tracking with priority tags (`high`, `medium`, `low`), contact statuses, and copyable interview question cheat sheets.
* **Offline-First Resilience:** Full local planning capabilities powered by `localStorage` without requiring an active internet connection or external API keys.
* **Deterministic Fallback Simulator:** Built-in offline keyword simulator allowing complete testing of conversational workflows even when no AI API key is present.
* **Optimistic Concurrency Guards:** Monotonically increasing `version` integers to detect and prevent overwrite collisions.

### 4.2 Exclusions (Explicitly Out of Scope)
* **Real-Money Payment Processing:** No integration with Stripe, PayPal, or banking gateways. Costs are tracked for planning purposes only.
* **Live Vendor Booking / APIs:** No automated booking, scraping, or real-time booking engine integration.
* **Python / FastAPI Microservices:** All backend logic runs within Next.js App Router Route Handlers.
* **Multi-Agent Orchestration Frameworks:** No LangChain, CrewAI, or AutoGen. A single, direct Vercel AI SDK integration is used.
* **Native Mobile Applications:** Desktop- and mobile-responsive web browser application only.
* **Live Geocoding & Mapping:** Deferred until core state engine and persistence layers are fully verified.

---

## 5. Explicit Labels & Transparency

To comply with transparent product design and DEV community guidelines:

* **Planning Estimates Only:** All monetary figures, catering breakdowns, and rental figures suggested by the AI are **planning approximations**, not binding commercial quotes.
* **Simulated Vendor Data:** Vendor recommendations and suggested questions are generated as structural templates for host guidance. Celebration Copilot does not endorse or contract third-party vendors.
* **AI Disclosure:** In accordance with DEV guidelines, any articles or demos published about this project declare `ai_disclosure_level: some_ai`, acknowledging AI assistance for coding and proposal simulation.

---

## 6. User Stories & Acceptance Criteria

### US-1: Conversational Plan Revision
* **As an** event organizer,  
* **I want to** type natural requests like "Add a live jazz trio and a milestone to book them 3 months early",  
* **So that** I can rapidly flesh out my event without filling out dozens of forms.
* **Acceptance Criteria:**
  1. The assistant must return an `EventPlanProposal` containing discrete mutations within 2,500 ms (measured).
  2. The UI must render an interactive proposal preview card highlighting added costs and deadlines.
  3. Clicking "Apply to Plan" updates the active plan; clicking "Dismiss" leaves state untouched.

### US-2: Deterministic Budget Tracking
* **As a** host managing a tight budget,  
* **I want to** see total projected costs, committed payments, and remaining funds update instantly as line items change,  
* **So that** I never accidentally exceed my budget ceiling.
* **Acceptance Criteria:**
  1. All line item additions, deletions, and updates must execute via the deterministic engine.
  2. Totals must calculate accurately to the cent ($0.01) with zero floating-point rounding errors.
  3. If projected costs exceed `totalCap`, an alert banner and over-budget indicator must display immediately.

### US-3: Adaptive Event-Relative Timeline
* **As a** planner adjusting an event date,  
* **I want to** change the celebration date and have all milestones update their target dates automatically,  
* **So that** I do not have to manually recalculate dozens of deadlines.
* **Acceptance Criteria:**
  1. Changing `eventDate` in the header immediately recalculates all milestone `dueDate` fields using UTC date arithmetic.
  2. Milestones with negative offsets display correct calendar dates preceding the event.
  3. Marking a milestone complete updates timeline progress percentage deterministically.

### US-4: Offline & Failure Resilience
* **As a** user operating in poor network conditions or without an API key,  
* **I want to** create and modify plans locally,  
* **So that** my data is never lost or blocked by third-party downtime.
* **Acceptance Criteria:**
  1. All changes automatically persist to browser `localStorage`.
  2. If the API is unreachable or returns a 500 error, an error message is displayed and local state remains intact.
  3. The offline simulator handles standard conversational queries when `GOOGLE_GENERATIVE_AI_API_KEY` is omitted.

---

## 7. SMART Goals & Metrics

1. **AI Roundtrip Latency (Measurable):** Measured response time for `/api/plan/propose` under 2,500 ms under normal network conditions.
2. **Tracked Git Repository Size (Strict Boundary):** Tracked repository size must remain strictly under 5.0 MB (measured at ~362 KB; organizer upper limit is 10 MB).
3. **Unit Test Pass Rate (Quality):** 100% test pass rate across all pure domain functions, invariants, and route handlers.
4. **Accessibility (Usability):** Keyboard-navigable inputs, ARIA-accessible tab panels, and WCAG AA color contrast compliance across light and dark tokens.

---

## 8. Alignment with DEV Challenge & Hackathon Criteria

Per the DevRelay Knowledge Base (verified 2026-09-30, sourced from `dev.to/page/official-hackathon-rules`):

* **Technical Execution:** Demonstrates rigorous software architecture by replacing unstructured LLM state replacement with a verified, type-safe mutation pipeline.
* **Open-Source Innovation:** Fully functional without proprietary lock-in. Built entirely with free and open-source tools (Next.js, TypeScript, Tailwind CSS v4, Zod, Vitest).
* **Testability for Judges:** Works immediately upon cloning. No mandatory paid API keys or complicated database configurations required to evaluate the core interactive MVP.
* **Writing & Transparency:** Complete documentation suite (`PROJECT_SPEC.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `TASKS.md`, `AGENTS.md`) detailing rationale, constraints, and verifiable boundaries.
