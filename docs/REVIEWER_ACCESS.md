# Evaluator & Reviewer Access Guide

**Target Event:** PromptWars Virtual — Main Challenge 05: Celebration & Event Planner  
**Application:** Celebration Copilot: The Reactive AI Event Architect  
**Submission URL:** [https://celebration-copilot.vercel.app](https://celebration-copilot.vercel.app) (or local `http://localhost:3000`)  
**Target Evaluator Profile:** First-time independent evaluator / judge with zero developer credentials and clean browser context.

---

## 1. Zero-Friction Evaluator Access (Guest Mode)

Judges are **NOT required to register an account, sign in, or provide any credentials** to evaluate Celebration Copilot.

### Instant Onboarding Steps:
1. Open the application deployment URL in any standard web browser (Chrome, Safari, Firefox, Edge).
2. The landing page opens directly into the **Celebration Copilot Interactive Dashboard** loaded with the canonical celebration plan:
   - **Event:** Priya & Rahul's Traditional Bengali Wedding (Kolkata)
   - **Target Budget:** ₹15,00,000 (15 Lakhs INR)
   - **Guest Count:** 200 Guests
   - **Badge Indicator:** Top-right navbar displays `Local Mode • v1`.
3. Locate the **Planning Copilot** conversational interface on the right side of the screen (or tap the `Planning AI` button in the top navbar on mobile/tablet viewports).
4. Click any of the pre-configured quick suggestion chips or type a custom natural language instruction:
   - *Example 1:* `"Increase guests to 250 and add a live DJ setup"`
   - *Example 2:* `"Plan a Bengali wedding in Kolkata for 150 guests with a budget of ₹1,00,000"`
   - *Example 3:* `"Cut the photography budget by 20,000 and allocate to catering"`
5. Press **Enter** or click the send button.
6. The AI assistant processes your prompt and returns a structured **Proposal Diff** showing:
   - Summary of reasoning
   - Estimated financial delta (e.g., `+₹45,000`)
   - Exact list of typed operations (`ADD_BUDGET_ITEM`, `UPDATE_GUEST_COUNT`, `ADD_MILESTONE`, etc.)
7. Click **"Apply to Plan"** to accept the proposal, or **"Dismiss"** to discard.
8. Observe the real-time deterministic updates across all three planner views:
   - **Budget Breakdown:** Category allocations, spent vs. committed totals, remaining budget indicator.
   - **Milestone Timeline:** Automatically shifted calendar dates relative to the event date.
   - **Vendor Checklist:** Newly suggested vendor categories and prepopulated vetting questionnaires.

---

## 2. Optional: Evaluator Cloud Sync & Multi-User Testing

If you wish to test Supabase cloud persistence, multi-device sync, and PostgreSQL Row-Level Security:

### Creating an Evaluator Test Account:
1. Click the **"Sign In"** button in the top-right navbar, or navigate to `/login`.
2. Select the **"Create Account"** tab.
3. Enter any standard test email (e.g., `judge-evaluator@promptwars.in`) and a password (minimum 6 characters).
4. Click **"Sign Up"**.
5. Once authenticated:
   - The top navbar badge changes from `Local Mode` to `Cloud Synced • vX`.
   - Your account email will be displayed in the navbar.
   - Any modifications you approve will be persisted to PostgreSQL using atomic Compare-and-Swap concurrency (`update_event_plan`).
   - Logging in from another browser or window will rehydrate your private cloud event.
6. To sign out, click the **"Sign Out"** button in the navbar. The application will return to Local Mode.

---

## 3. Session Continuity & Local Refresh Behavior

- **Page Reload:** Celebration Copilot automatically preserves your active event plan and your complete chat conversation in `localStorage`. Reloading the page or closing the tab will not lose your progress.
- **Resetting the Plan:** To restore the original sample Bengali wedding plan and clear all chat history at any time, click the **"Reset"** button in the top navbar.
- **Exporting the Plan:** Click the **"Export Plan"** button in the navbar to preview the formatted plan, view Markdown export, copy JSON schema, or trigger a printer-friendly layout.

---

## 4. Error Recovery & Fallback Guarantees

If an external AI network failure or API rate limit occurs:
- The UI will display a helpful, non-blocking notification:  
  `⚠️ AI provider rate limit reached (15 RPM free tier). Please wait a moment and try again.`
- Your existing event plan is **strictly preserved** (Zero-State-Corruption Guarantee).
- The "Retry" button in the chat interface allows re-submitting the prompt without retyping.
- If runtime AI credentials are unconfigured in an offline environment, the built-in deterministic proposal simulator ensures the assistant remains fully interactive.
