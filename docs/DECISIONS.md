# Celebration Copilot: Architecture Decision Records (ADRs)

> **Status:** Canonical Project Decisions  
> **Last Verified:** 2026-10-29  
> **Standards:** RFC 2119 Key Words; ADR Format

---

## ADR-001: Next.js App Router for Unified Full-Stack Architecture

* **Status:** Accepted
* **Context:** The application requires a fast web UI, type-safe API route handlers, server-side secret isolation for AI keys, and minimal deployment overhead under 5 MB.
* **Decision:** Use **Next.js 15 (App Router)** with React 19 and TypeScript as a unified frontend and backend framework.
* **Consequences:** Eliminates context switching across multiple languages; enables Server Actions and standard Node.js Route Handlers.
* **Alternatives Rejected:**
  * *Python / FastAPI Split:* Rejected due to increased deployment surface, cold-start latency, multi-repository management, and unnecessary polyglot complexity for a lightweight MVP.
  * *Static Client + External Express Server:* Rejected due to lack of co-located serverless route optimization and unnecessary infrastructure fragmentation.

---

## ADR-002: Zod Runtime Schema Validation & Discriminated Union Mutations

* **Status:** Accepted
* **Context:** AI generation output is untrusted and can produce invalid JSON shapes, extraneous fields, or missing keys if left unconstrained.
* **Decision:** Enforce **Zod (`^3.24.2`)** schemas at all API and engine boundaries. Represent plan mutations as a discriminated union (`PlanMutationSchema`) with a `type` discriminator.
* **Consequences:** Guarantees runtime type safety; automatically narrows TypeScript types during engine execution; strips unexpected fields injected by LLM hallucinations.
* **Alternatives Rejected:**
  * *Unconstrained Text Output / Regex Parsing:* Rejected due to high failure rate, brittleness, and vulnerability to prompt injection.
  * *JSON Schema without TypeScript Integration:* Rejected because manual TypeScript type synchronization inevitably leads to schema drift.

---

## ADR-003: Pure TypeScript Deterministic State Engine

* **Status:** Accepted
* **Context:** AI models frequently hallucinate arithmetic totals, drift event dates, and overwrite unmentioned user edits when generating full event plans.
* **Decision:** Build a pure TypeScript state engine (`applyProposal`) that treats the AI as an untrusted proposer. All state updates are atomic deltas. All mathematical totals and date offsets are calculated deterministically by pure functions using integer currency cents.
* **Consequences:** 100% guarantee against floating-point arithmetic errors ($0.10 + $0.20 \neq $0.30000000000000004); 100% testable without mocking network or AI services.
* **Alternatives Rejected:**
  * *Full-State LLM Generation:* Rejected because LLMs overwrite custom user line items, fail to preserve existing IDs, and produce inconsistent calculations.
  * *Client-Side Floating-Point Math:* Rejected due to IEEE 754 precision drift accumulating across multi-item budgets.

---

## ADR-004: Single Model Provider: Google Gemini 2.5 Flash via Vercel AI SDK

* **Status:** Accepted (with Groq Cloud as tested standby)
* **Context:** The application needs low latency (<2,500ms), reliable structured JSON output adherence, and a $0 free tier allowance for public demonstration.
* **Decision:** Use **Google Gemini (`gemini-2.5-flash`)** via the Vercel AI SDK (`ai` + `@ai-sdk/google`).
* **Consequences:** 
  * Generous free-tier quota: 15 RPM, 250,000–1,000,000 TPM, and 1,500 RPD, which avoids rate-limit freezing during rapid multi-turn chat testing.
  * Vercel AI SDK standardizes structured object generation (`generateObject`) and allows zero-rewrite provider switching.
* **Alternatives Evaluated & Rejected:**
  * *Groq Cloud (`llama-3.3-70b-versatile`):* Evaluated. While inference latency is exceptional (~300–600ms), Groq's free-tier token cap is **12,000 TPM** per organization. Sending the plan context (~2,200 tokens) causes a 429 rate freeze after only 4–5 consecutive messages. Kept as an optional standby for users who require zero data training.
  * *Direct Vendor SDKs (`@google/genai` or `groq-sdk`):* Rejected to avoid redundant SDK layers and vendor lock-in.
* **Unresolved Terms:** Google AI Studio free tier logs prompts for model improvement and human review. Users must not enter sensitive personal identifying information (PII) on the free tier.

---

## ADR-005: Supabase PostgreSQL with JSONB Document Storage & Strict RLS

* **Status:** Accepted for Phase 4
* **Context:** Once the local-first planning workflow is validated, users need secure cloud persistence and authentication without complex relational schema migrations during early MVP iteration.
* **Decision:** Store the canonical `EventPlan` as a validated **JSONB** document in a PostgreSQL table with a monotonic `version` integer, protected by Supabase Auth and Row-Level Security (`auth.uid() = user_id`).
* **Consequences:** Fast iteration on plan structure without SQL migration bottlenecks; atomic document writes; optimistic concurrency locking using `version`.
* **Alternatives Rejected:**
  * *Deeply Normalized Relational Tables (10+ tables):* Rejected for early MVP due to excessive join overhead, foreign key cascade complexities, and migration churn.
  * *MongoDB Atlas:* Rejected to avoid adding another third-party platform when Supabase provides integrated Auth and Postgres.
* **Unresolved Terms:** Supabase Free Tier automatically pauses projects after 7 consecutive days of inactivity. Mitigated by keeping `localStorage` as the immediate primary offline store.

---

## ADR-006: Vitest for Pure Domain & Route Testing

* **Status:** Accepted
* **Context:** The deterministic state engine and API route handlers require rapid, automated unit testing with native TypeScript and ESM support.
* **Decision:** Use **Vitest (`^3.0.7`)** as the test runner.
* **Consequences:** Tests execute in milliseconds (<1,000ms for entire suite); native ESM and TypeScript path alias support (`@/*`) without Babel or ts-jest transformation overhead.
* **Alternatives Rejected:**
  * *Jest:* Rejected due to complex ESM configuration, slower cold starts, and heavy dependency tree adding to repository size.

---

## ADR-007: Deferring Live Geocoding & Mapping to Post-MVP

* **Status:** Accepted
* **Context:** Event planning often involves venue locations. However, integrating third-party mapping libraries (e.g. Mapbox, Leaflet, Google Maps) introduces external API keys, bundle weight, and network dependencies.
* **Decision:** Exclude map components from the core MVP. Defer until the deterministic budgeting, scheduling, and persistence layers pass all stage gates.
* **Consequences:** Keeps initial client bundle First Load JS under 115 kB; eliminates paid mapping API dependency risks.
* **Alternatives Rejected:**
  * *Premature Mapbox / Google Maps Integration:* Rejected due to potential API billing traps and bundle bloat during hackathon evaluation.
