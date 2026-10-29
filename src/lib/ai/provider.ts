import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { EventPlan } from '@/domain/event-plan.schema';
import { Proposal, ProposalSchema } from '@/domain/proposal.schema';
import { PLANNER_SYSTEM_PROMPT, formatPlanContext } from './prompts';

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

/**
 * Deterministic offline fallback simulator when no API key is configured.
 * Guarantees zero-dependency offline usability (ADR-003, AGENTS.md Invariant 7).
 */
export function generateOfflineProposal(currentPlan: EventPlan, message: string): Proposal {
  const lower = message.toLowerCase();

  // Pattern: Increase or set guest count (e.g., "increase guests to 200", "200 guests")
  const guestMatch = lower.match(/(?:guests?|attendees?)\s*(?:to|is|=)?\s*(\d+)/i) ||
                     lower.match(/(\d+)\s*(?:guests?|attendees?)/i);
  if (guestMatch) {
    const count = parseInt(guestMatch[1], 10);
    return {
      summary: `[Offline Simulator] Updated guest count to ${count}`,
      operations: [
        {
          type: 'UPDATE_GUEST_COUNT',
          guestCount: count,
        },
      ],
    };
  }

  // Pattern: DJ or music
  if (lower.includes('dj') || lower.includes('music')) {
    return {
      summary: '[Offline Simulator] Added live DJ entertainment and booking milestone',
      operations: [
        {
          type: 'ADD_BUDGET_ITEM',
          name: 'Professional DJ & Sound Setup',
          category: 'Entertainment',
          estimatedCost: 45000,
        },
        {
          type: 'ADD_MILESTONE',
          title: 'Confirm DJ & Playlist Preferences',
          offsetDays: -30,
          category: 'entertainment',
        },
        {
          type: 'ADD_VENDOR',
          name: 'BeatMaster DJ Services',
          category: 'Entertainment',
          priority: 'medium',
          suggestedQuestions: [
            'Do you provide full sound equipment and microphones?',
            'What is the setup and soundcheck call time?',
          ],
        },
      ],
    };
  }

  // Pattern: Photography / Photos
  if (lower.includes('photo') || lower.includes('video')) {
    return {
      summary: '[Offline Simulator] Added photography and videography team',
      operations: [
        {
          type: 'ADD_BUDGET_ITEM',
          name: 'Photography & Drone Video Coverage',
          category: 'Media',
          estimatedCost: 75000,
        },
        {
          type: 'ADD_MILESTONE',
          title: 'Sign Photographer Agreement & Shot List',
          offsetDays: -45,
          category: 'media',
        },
      ],
    };
  }

  // Default helpful proposal: Add miscellaneous planning item
  return {
    summary: `[Offline Simulator] Added planning review task for: "${message.slice(0, 80)}"`,
    operations: [
      {
        type: 'ADD_MILESTONE',
        title: `Follow up: ${message.slice(0, 50)}`,
        offsetDays: -7,
        category: 'planning',
      },
    ],
  };
}

/**
 * Generates a structured proposal using Vercel AI SDK and Google Gemini.
 * Falls back to deterministic simulator if no API key is provided.
 */
export async function generatePlannerProposal(
  currentPlan: EventPlan,
  userMessage: string
): Promise<Proposal> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  // Use offline simulator if credentials are not configured
  if (!apiKey || apiKey.trim() === '') {
    return generateOfflineProposal(currentPlan, userMessage);
  }

  const modelId = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  try {
    const { object: proposal } = await generateObject({
      model: google(modelId),
      schema: ProposalSchema,
      system: PLANNER_SYSTEM_PROMPT,
      prompt: `CURRENT EVENT PLAN:\n${formatPlanContext(currentPlan)}\n\nUSER REQUEST:\n${userMessage}`,
      temperature: 0.2,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(15000), // 15-second strict timeout guard
    });

    return proposal;
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Abort / Timeout
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new AIProviderError('AI inference request timed out. Please try again.', 504, true);
      }

      // Rate Limit (429)
      if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
        throw new AIProviderError('AI provider rate limit reached (15 RPM free tier). Please wait a moment and try again.', 429, true);
      }

      // Auth / Key issues
      if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('403')) {
        throw new AIProviderError('Invalid or unauthorized AI credentials. Check GOOGLE_GENERATIVE_AI_API_KEY.', 401, false);
      }

      // Schema parsing errors from model output
      if (error.message.includes('validation') || error.message.includes('schema')) {
        throw new AIProviderError(`AI model proposed an invalid structure: ${error.message}`, 422, false);
      }

      throw new AIProviderError(`AI generation failed: ${error.message}`, 500, false);
    }

    throw new AIProviderError('An unknown error occurred during AI generation.', 500, false);
  }
}
