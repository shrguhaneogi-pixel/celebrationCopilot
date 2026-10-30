import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EventPlan, EventPlanSchema } from '@/domain/event-plan.schema';
import { ProposalSchema } from '@/domain/proposal.schema';
import { applyProposal } from '@/domain/planning-engine';
import { generatePlannerProposal, AIProviderError } from '@/lib/ai/provider';
import { createClient } from '@/lib/supabase/server';
import { getAuthoritativeEvent, getOrCreateUserEvent } from '@/lib/supabase/events';
import { checkRateLimit, extractClientIdentifierFromHeaders } from '@/lib/rate-limiter';

const PlannerRequestSchema = z
  .object({
    message: z.string().min(1).max(2000),
    eventId: z.string().uuid().optional(),
    currentPlan: EventPlanSchema.optional(),
  })
  .strict();

export type PlannerRequest = z.infer<typeof PlannerRequestSchema>;

const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function resolveClientIdentifier(req: NextRequest): string {
  return extractClientIdentifierFromHeaders({
    xForwardedFor: req.headers.get('x-forwarded-for'),
    xRealIp: req.headers.get('x-real-ip'),
    cfConnectingIp: req.headers.get('cf-connecting-ip'),
    trueClientIp: req.headers.get('true-client-ip'),
    copilotGuestId:
      req.headers.get('copilot_guest_id') ||
      req.headers.get('x-copilot-guest-id') ||
      req.cookies.get('copilot_guest_id')?.value,
    xSessionId:
      req.headers.get('x-session-id') ||
      req.cookies.get('x-session-id')?.value ||
      req.cookies.get('session_id')?.value,
    userAgent: req.headers.get('user-agent'),
    acceptLanguage: req.headers.get('accept-language'),
  });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 0. Rate Limiting Guard (Sliding-window per client identity)
    const clientIdentifier = resolveClientIdentifier(req);
    const rateLimitResult = checkRateLimit(clientIdentifier);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please wait a moment before proposing further event changes.',
        },
        {
          status: 429,
          headers: {
            ...SECURITY_HEADERS,
            'Retry-After': String(Math.max(1, Math.ceil(rateLimitResult.resetMs / 1000))),
          },
        }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload in request body' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // 1. Inbound Request Validation
    const validation = PlannerRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request shape: ${validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
        },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const { message, eventId } = validation.data;

    // 2. Authentication & Authoritative Plan Resolution
    let authoritativePlan: EventPlan;
    let targetEventId: string;
    let expectedRevision: number;

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

        // Load Authoritative Plan from Database (RLS verified on auth.uid())
        if (eventId) {
          const record = await getAuthoritativeEvent(eventId, user.id);
          if (!record) {
            return NextResponse.json(
              { success: false, error: 'Event not found or access denied.' },
              { status: 404, headers: SECURITY_HEADERS }
            );
          }
          authoritativePlan = record.plan;
          targetEventId = record.id;
          expectedRevision = record.revision;
        } else {
          const userEvent = await getOrCreateUserEvent(user.id);
          authoritativePlan = userEvent.plan;
          targetEventId = userEvent.id;
          expectedRevision = userEvent.revision;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Database resolution failed';
        return NextResponse.json(
          { success: false, error: `Authentication / Database error: ${errMsg}` },
          { status: 500, headers: SECURITY_HEADERS }
        );
      }
    } else {
      // Offline fallback: used strictly when Supabase is not configured
      if (!validation.data.currentPlan) {
        return NextResponse.json(
          { success: false, error: 'currentPlan is required when Supabase is offline.' },
          { status: 400, headers: SECURITY_HEADERS }
        );
      }
      authoritativePlan = validation.data.currentPlan;
      targetEventId = authoritativePlan.id;
      expectedRevision = authoritativePlan.version;
    }

    // 3. AI Inference Boundary (Receives only authoritative plan)
    const proposal = await generatePlannerProposal(authoritativePlan, message);

    // 4. Proposal Schema Boundary
    const proposalValidation = ProposalSchema.safeParse(proposal);
    if (!proposalValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `AI proposed invalid schema: ${proposalValidation.error.message}`,
          proposal,
          originalPlan: authoritativePlan,
        },
        { status: 422, headers: SECURITY_HEADERS }
      );
    }

    // 5. Deterministic State Engine Execution
    const result = applyProposal(authoritativePlan, proposalValidation.data);
    const latencyMs = Date.now() - startTime;

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Proposal invariant rejected: ${result.error}`,
          failedOperationIndex: result.failedOperationIndex,
          proposal: proposalValidation.data,
          originalPlan: result.originalPlan,
          latencyMs,
        },
        { status: 422, headers: SECURITY_HEADERS }
      );
    }

    // 6. Proposal Generation Return (Untrusted Proposer Guarantee)
    // Invariant: AI proposals are previews and must NOT be persisted to PostgreSQL
    // until explicitly reviewed and approved by the user in the client UI.
    return NextResponse.json(
      {
        success: true,
        eventId: targetEventId,
        revision: expectedRevision,
        plan: result.plan,
        derivedMetrics: result.derivedMetrics,
        appliedOperationsCount: result.appliedOperationsCount,
        proposal: proposalValidation.data,
        latencyMs,
      },
      { status: 200, headers: SECURITY_HEADERS }
    );
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;

    if (error instanceof AIProviderError) {
      return NextResponse.json(
        { success: false, error: error.message, isRetryable: error.isRetryable, latencyMs },
        { status: error.statusCode, headers: SECURITY_HEADERS }
      );
    }

    const safeMessage = error instanceof Error ? error.message : 'Internal planner error';
    return NextResponse.json(
      { success: false, error: `Planner execution failed: ${safeMessage}`, latencyMs },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
