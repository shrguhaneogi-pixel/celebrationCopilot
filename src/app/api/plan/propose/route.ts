import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { EventPlanProposalSchema, EventPlanProposal } from '@/lib/domain/mutations';

const RequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  currentPlan: z.object({
    id: z.string(),
    version: z.number(),
    title: z.string(),
    eventType: z.string(),
    eventDate: z.string().nullable(),
    guestCount: z.number(),
    totalCap: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        estimatedCost: z.number(),
        actualCost: z.number().optional(),
        status: z.string(),
      })
    ),
    milestones: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        offsetDays: z.number(),
        completed: z.boolean(),
        category: z.string(),
      })
    ),
    vendors: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        priority: z.string(),
        status: z.string(),
      })
    ),
  }),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parsed = RequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request payload',
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { prompt, currentPlan } = parsed.data;
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    let proposal: EventPlanProposal;

    if (apiKey) {
      // Production AI invocation via Vercel AI SDK
      const systemPrompt = `You are Celebration Copilot, an expert event planner.
Your job is to propose safe, atomic, discrete mutations to update an event plan based on the user's request.
CRITICAL RULES:
1. Do NOT calculate totals or sums; the deterministic state engine handles math.
2. Only output discrete mutations using the provided schema.
3. If modifying or removing an existing item, use its exact ID from the current plan context.
4. All cost amounts MUST be in integer currency cents (e.g. $500 is 50000).
5. All milestone offsetDays are relative to the event date (e.g. -60 for 60 days before event).

Current Event Plan Context:
- Title: ${currentPlan.title}
- Event Type: ${currentPlan.eventType}
- Event Date: ${currentPlan.eventDate || 'Not set'}
- Guest Count: ${currentPlan.guestCount}
- Budget Cap: $${(currentPlan.totalCap / 100).toFixed(2)}
- Existing Items: ${JSON.stringify(
        currentPlan.items.map((i) => ({ id: i.id, name: i.name, cost: i.estimatedCost }))
      )}
- Existing Milestones: ${JSON.stringify(
        currentPlan.milestones.map((m) => ({ id: m.id, title: m.title, offsetDays: m.offsetDays }))
      )}
- Existing Vendors: ${JSON.stringify(
        currentPlan.vendors.map((v) => ({ id: v.id, name: v.name, priority: v.priority }))
      )}
`;

      const result = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: EventPlanProposalSchema,
        system: systemPrompt,
        prompt: prompt,
      });

      proposal = result.object;
    } else {
      // Deterministic Offline Simulator: Allows testing full conversational flow without API key
      proposal = generateOfflineSimulation(prompt, currentPlan);
    }

    const response = NextResponse.json({
      success: true,
      data: proposal,
    });

    // Enforce private cache headers per security specifications
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return response;
  } catch (error) {
    console.error('AI proposal generation failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate proposal',
      },
      { status: 500 }
    );
  }
}

// Offline fallback simulation for local testing when no API key is in environment
function generateOfflineSimulation(prompt: string, plan: { title: string; totalCap: number }): EventPlanProposal {
  const p = prompt.toLowerCase();

  if (p.includes('catering') || p.includes('food') || p.includes('dinner')) {
    return {
      explanation: 'Proposing standard artisanal catering estimate with tasting milestone.',
      mutations: [
        {
          type: 'ADD_BUDGET_ITEM',
          category: 'catering',
          name: 'Plated Dinner & Beverages',
          estimatedCost: 250000, // $2,500.00
          notes: 'Estimated for standard attendee count',
        },
        {
          type: 'ADD_MILESTONE',
          title: 'Schedule Menu Tasting',
          offsetDays: -45,
          category: 'booking',
        },
        {
          type: 'ADD_VENDOR',
          category: 'Catering',
          name: 'Artisan Culinary Co.',
          priority: 'high',
          suggestedQuestions: [
            'Do you accommodate gluten-free and vegan dietary requirements?',
            'What is the staff-to-guest ratio included in this quote?',
          ],
        },
      ],
    };
  }

  if (p.includes('dj') || p.includes('music') || p.includes('entertainment')) {
    return {
      explanation: 'Adding entertainment package and booking deadline.',
      mutations: [
        {
          type: 'ADD_BUDGET_ITEM',
          category: 'entertainment',
          name: 'Live DJ & Sound System',
          estimatedCost: 80000, // $800.00
        },
        {
          type: 'ADD_MILESTONE',
          title: 'Confirm Playlist & Special Requests',
          offsetDays: -14,
          category: 'planning',
        },
      ],
    };
  }

  // Default generic proposal
  return {
    explanation: `Analyzed plan "${plan.title}". Proposing initial planning setup and photography package.`,
    mutations: [
      {
        type: 'ADD_BUDGET_ITEM',
        category: 'photography',
        name: 'Photography & Digital Album',
        estimatedCost: 120000, // $1,200.00
      },
      {
        type: 'ADD_MILESTONE',
        title: 'Review Photographer Portfolio',
        offsetDays: -60,
        category: 'planning',
      },
      {
        type: 'ADD_VENDOR',
        category: 'Photography',
        name: 'Studio Lens & Light',
        priority: 'high',
        suggestedQuestions: [
          'How many hours of coverage are included?',
          'How long after the event will full-resolution files be delivered?',
        ],
      },
    ],
  };
}
