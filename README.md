# Celebration Copilot 🎉

> **Deterministic, Reactive Event Planning Powered by Safe Generative AI Proposals**
> Plan celebrations, manage multi-category budgets, track event-relative milestones, and organize vendor checklists without broken spreadsheet formulas or AI state hallucinations.

[![Build & Test](https://github.com/shrguhaneogi-pixel/celebrationCopilot/actions/workflows/ci.yml/badge.svg)](https://github.com/shrguhaneogi-pixel/celebrationCopilot/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tracked Size](https://img.shields.io/badge/Tracked%20Size-550%20KB%20%2F%20%3C%205.0%20MB-success)](scripts/check-size.sh)
[![Tests Passing](https://img.shields.io/badge/Tests-58%2F58%20Passed-brightgreen)](tests/domain.test.ts)

---

## 1. The Problem

Event hosts, couples, and community organizers consistently encounter three major pitfalls with existing tools:

1. **Spreadsheet Fragility:** A single corrupted formula in Excel or Google Sheets leads to undetected budget deficits, incorrect currency conversions, and drifting milestone schedules.
2. **Naive AI State Overwrites:** Asking conventional LLM chat assistants to *"Add a DJ for $800"* typically results in the AI returning an entirely new, hallucinated plan—silently wiping out existing custom line items, losing IDs, and replacing specific user notes.
3. **Floating-Point Arithmetic Hallucinations:** Large language models are probabilistic token predictors, not algebraic calculators. When tasked with summing totals, computing tax buffers, or balancing variances, LLMs frequently produce mathematically invalid figures.

---

## 2. The Core Differentiator: Isolated Deterministic Architecture

Celebration Copilot decouples **conversational planning intent** from **state mutation and financial calculations**.

The AI is treated as an **untrusted proposer** that never directly modifies application state, executes database operations, or computes financial sums:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BROWSER / CLIENT                                │
│                                                                             │
│  User Chat Prompt: "Add an acoustic trio for $1,200 and a booking milestone"│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST /api/planner
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER: NEXT.JS APP ROUTER                          │
│                                                                             │
│  1. Inbound Validation: Zod schema validates { prompt, currentPlan }        │
│  2. AI Inference Boundary: Vercel AI SDK generateObject()                   │
│     • Model: Google Gemini 2.0 Flash (@ai-sdk/google)                       │
│     • Output Constrained: PlanMutationSchema discriminated union            │
│  3. Fallback Engine: Automatic deterministic keyword simulator if offline  │
│  4. Headers: Cache-Control: private, no-cache, no-store, must-revalidate    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Untrusted Proposal Deltas
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC PLANNING ENGINE (Pure TS)                  │
│                                                                             │
│  5. Interactive Diff Preview: User reviews changes before acceptance        │
│  6. applyProposal(currentPlan, proposal):                                   │
│     ├── Structural Zod Validation: Rejects invalid or unknown shapes        │
│     ├── ID Existence Verification: Guards against dangling updates          │
│     ├── Monotonic Version Bump: Plan version incremented (version + 1)      │
│     └── Pure Derived Math:                                                  │
│         • projectedTotal = sum(items.estimatedCost)                         │
│         • committedTotal = sum(items[committed/paid].actualCost)            │
│         • remainingBudget = totalCap - projectedTotal                       │
│         • milestone.dueDate = eventDate + offsetDays (UTC)                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Updated Canonical EventPlan
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE & SYNCHRONIZATION                        │
│                                                                             │
│  • Local-First: Immediate persistence to browser localStorage               │
│  • Optional Cloud: Supabase PostgreSQL JSONB with Row-Level Security       │
│    atomic compare-and-swap: update_event_plan(id, revision, data)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Guarantees
* **Integer Arithmetic:** All monetary fields (`estimatedCost`, `actualCost`, `totalCap`) are stored and computed in integer cents to guarantee zero IEEE 754 floating-point drift.
* **Deterministic Calendar Dates:** Milestones specify relative offsets (`offsetDays: -45` for 45 days before the event). If the event date shifts, all milestone due dates are recalculated deterministically via UTC date arithmetic.
* **Atomic Rollback:** If any mutation in a proposed batch fails validation, the entire batch is rejected, leaving the canonical plan in a clean, uncorrupted state.

---

## 3. Tech Stack

| Layer | Technology | Rationale & Specifications |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.4.3 (App Router) | React 19, Turbopack, unified full-stack architecture with zero serverless cold-start fragmentation. |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`) | High-performance CSS engine with modern `@import "tailwindcss";` syntax. |
| **Icons** | Lucide React (`lucide-react`) | Lightweight SVG icons keeping tracked repository size strictly under 5.0 MB. |
| **Schema Validation** | Zod (`^4.6.7`) | Runtime schema validation and discriminated union mutation types. |
| **AI Runtime** | Vercel AI SDK (`ai` `^7.0.156`, `@ai-sdk/google`) | Structured object generation via `gemini-2.0-flash` with zero-cost free-tier quota and automated offline fallback simulation. |
| **Database & Auth** | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | PostgreSQL document store with Row-Level Security (`auth.uid() = user_id`) and atomic compare-and-swap stored procedure. |
| **Testing** | Vitest (`^5.0.5`) + Testing Library | Sub-second pure domain unit tests, integration tests, and JSDOM component suites. |

---

## 4. Quick Start & Local Setup

### Prerequisites
* **Node.js:** v20.x or v22.x LTS
* **npm:** v10.x or higher

### 1. Clone & Install
```bash
git clone https://github.com/shrguhaneogi-pixel/celebrationCopilot.git
cd celebrationCopilot
npm install
```

### 2. Run Locally (Zero Configuration)
The application is **offline-first by default**. You can immediately start the development server without setting any API keys or creating cloud accounts:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. All features—including conversational planning (powered by the built-in deterministic fallback simulator) and local persistence (powered by `localStorage`)—work out of the box!

---

## 5. Optional Cloud Configuration (AI & Supabase)

To enable live Google Gemini AI inference and cloud PostgreSQL database synchronization, create a `.env.local` file:

```bash
cp .env.example .env.local
```

Populate the variables in `.env.local`:
```env
# Google AI Studio API Key (Server-Only: Never expose to browser)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here

# Supabase Project Configuration (Public: Governed by RLS)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Database Schema & RLS Setup
If using Supabase, apply the SQL migration located in `supabase/migrations/0001_init.sql` using the Supabase SQL Editor:

```sql
-- Creates public.events with user ownership and CAS atomic function
-- Enforces: auth.uid() = user_id for SELECT, INSERT, UPDATE, DELETE
-- Stored procedure: update_event_plan(p_event_id, p_expected_revision, p_new_plan)
```

The migration enforces strict multi-tenant isolation: authenticated users can only view, insert, update, or delete their own event plans.

---

## 6. Verification & Test Suite

Celebration Copilot adheres to rigorous automated quality gates. Every test, lint, and size check can be verified locally:

```bash
# 1. Run all unit and integration tests (58/58 passing)
npm test

# 2. Verify tracked repository size is strictly under 5.0 MB
npm run check-size

# 3. Static type checking (TypeScript strict mode)
npm run typecheck

# 4. Linting check (ESLint flat config)
npm run lint

# 5. Production build compilation (Turbopack)
npm run build
```

---

## 7. Two-Minute Evaluator Demo Script

Follow this step-by-step walkthrough to evaluate the application in under 2 minutes:

1. **Launch the Application:**
   Run `npm run dev` and navigate to [http://localhost:3000](http://localhost:3000). Notice the default celebration plan loaded with a budget bar, categorized line items, milestone timeline, and vendor checklist.
2. **Review Deterministic Arithmetic:**
   Look at the header's **Total Budget**, **Projected Cost**, and **Committed** counters. Every figure is dynamically calculated from discrete integer cents.
3. **Trigger a Conversational Proposal:**
   In the bottom-right chat input, type:
   `"Add a jazz trio for $1,200 and a milestone to book them 60 days before the party"`
   Press Enter.
4. **Inspect the Interactive Proposal Diff:**
   A proposal card appears in the chat showing:
   * ➕ Add Budget Item: *"Jazz Trio"* ($1,200.00 in Entertainment).
   * ➕ Add Milestone: *"Book Jazz Trio"* (60 days before event).
5. **Apply the Changes:**
   Click **"Apply to Plan"**. Notice that:
   * The budget automatically updates by exactly $1,200.00 without touching unmentioned items.
   * The milestone is automatically inserted and sorted chronologically into the timeline with its exact UTC calendar due date computed.
6. **Test Manual Editing:**
   Click the **"Edit"** button on any line item to change its actual cost or mark it as `"Committed"`. The committed total bar updates in real time.
7. **Verify Event Date Reactivity:**
   Click **"Edit Details"** in the header and shift the event date forward by two months. All milestone calendar dates adjust instantaneously while preserving their relative day offsets.

---

## 8. Truthful Limitations & Architecture Boundaries

* **Planning Estimates Only:** All monetary figures and vendor quotes are planning approximations. Celebration Copilot does not process real financial payments, charge credit cards, or connect to banking rails.
* **Simulated Vendor Data:** Vendor interview questions and checklist templates are structural recommendations to assist event organizers. Celebration Copilot does not contract third-party vendors or scrape live vendor APIs.
* **Zero-Cost & Free-Tier Adherence:** Built entirely using free-tier tools (Google Gemini 2.0 Flash free quota, Supabase Free Tier, Vercel Hobby).
* **AI Disclosure:** In compliance with the DEV Community Guidelines, AI assistance was utilized during development for rapid code generation, test scaffolding, and structured proposal evaluation (`ai_disclosure_level: some_ai`).

---

## 9. Project Documentation Index

* [`AGENTS.md`](./AGENTS.md): Persistent agent invariants, security rules, and development protocols.
* [`docs/PROJECT_SPEC.md`](./docs/PROJECT_SPEC.md): Full product specification, user stories, and SMART goals.
* [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): Data contracts, Zod schemas, mutation boundaries, and concurrency guards.
* [`docs/DECISIONS.md`](./docs/DECISIONS.md): Architecture Decision Records (ADR-001 through ADR-007).
* [`docs/TASKS.md`](./docs/TASKS.md): Evidence-backed implementation stage-gate ledger.

---

## 10. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
