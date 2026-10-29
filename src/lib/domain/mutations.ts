import { z } from 'zod';

export const BudgetCategorySchema = z.enum([
  'venue',
  'catering',
  'entertainment',
  'decor',
  'photography',
  'attire',
  'other',
]);

export const PlanMutationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SET_DETAILS'),
    title: z.string().min(1).max(100).optional(),
    eventType: z.string().min(1).max(50).optional(),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .nullable()
      .optional(),
    guestCount: z.number().int().nonnegative().optional(),
    totalCap: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('ADD_BUDGET_ITEM'),
    category: BudgetCategorySchema,
    name: z.string().min(1).max(100),
    estimatedCost: z.number().int().nonnegative(),
    notes: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal('UPDATE_BUDGET_ITEM'),
    itemId: z.string(),
    name: z.string().min(1).max(100).optional(),
    category: BudgetCategorySchema.optional(),
    estimatedCost: z.number().int().nonnegative().optional(),
    actualCost: z.number().int().nonnegative().optional(),
    status: z.enum(['projected', 'quoted', 'committed', 'paid']).optional(),
    notes: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal('REMOVE_BUDGET_ITEM'),
    itemId: z.string(),
  }),
  z.object({
    type: z.literal('ADD_MILESTONE'),
    title: z.string().min(1).max(100),
    offsetDays: z.number().int(),
    category: z.enum(['planning', 'booking', 'execution', 'post_event']),
  }),
  z.object({
    type: z.literal('UPDATE_MILESTONE'),
    milestoneId: z.string(),
    title: z.string().min(1).max(100).optional(),
    offsetDays: z.number().int().optional(),
    completed: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('REMOVE_MILESTONE'),
    milestoneId: z.string(),
  }),
  z.object({
    type: z.literal('ADD_VENDOR'),
    category: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    priority: z.enum(['high', 'medium', 'low']),
    suggestedQuestions: z.array(z.string().min(1).max(200)).max(5),
  }),
  z.object({
    type: z.literal('UPDATE_VENDOR'),
    vendorId: z.string(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    status: z.enum(['not_started', 'contacted', 'quoted', 'booked']).optional(),
    suggestedQuestions: z.array(z.string().min(1).max(200)).max(5).optional(),
  }),
  z.object({
    type: z.literal('REMOVE_VENDOR'),
    vendorId: z.string(),
  }),
]);

export const EventPlanProposalSchema = z.object({
  explanation: z.string().min(1).max(500),
  mutations: z.array(PlanMutationSchema).max(15),
});

export type PlanMutation = z.infer<typeof PlanMutationSchema>;
export type EventPlanProposal = z.infer<typeof EventPlanProposalSchema>;
