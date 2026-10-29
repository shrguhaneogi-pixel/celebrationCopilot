import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EventPlanSchema } from '@/domain/event-plan.schema';
import { ProposalSchema } from '@/domain/proposal.schema';
import { applyProposal } from '@/domain/planning-engine';
import { generatePlannerProposal, AIProviderError } from '@/lib/ai/provider';

const PlannerRequestSchema = z
  .object({
    message: z.string().min(1).max(2000),
    currentPlan: EventPlanSchema,
  })
  .strict();

export type PlannerRequest = z.infer<typeof PlannerRequestSchema>;

const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
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

    const { message, currentPlan } = validation.data;

    // 2. AI Inference Boundary
    const proposal = await generatePlannerProposal(currentPlan, message);

    // 3. Proposal Schema Boundary
    const proposalValidation = ProposalSchema.safeParse(proposal);
    if (!proposalValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: `AI proposed invalid schema: ${proposalValidation.error.message}`,
          proposal,
          originalPlan: currentPlan,
        },
        { status: 422, headers: SECURITY_HEADERS }
      );
    }

    // 4. Deterministic State Engine Execution
    const result = applyProposal(currentPlan, proposalValidation.data);

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

    // 5. Successful Execution Return
    return NextResponse.json(
      {
        success: true,
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
