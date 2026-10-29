import { z } from 'zod';

export function isValidCalendarDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
  .refine(isValidCalendarDate, {
    message: 'Must be a valid real-world calendar date (YYYY-MM-DD)',
  });

export const BudgetItemStatusSchema = z.enum(['projected', 'quoted', 'committed', 'paid']);
export type BudgetItemStatus = z.infer<typeof BudgetItemStatusSchema>;

export const BudgetItemSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    category: z.string().min(1).max(50),
    estimatedCost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    actualCost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
    status: BudgetItemStatusSchema.default('projected'),
    notes: z.string().max(500).optional(),
  })
  .strict();
export type BudgetItem = z.infer<typeof BudgetItemSchema>;

export const MilestoneCategorySchema = z.enum([
  'venue',
  'catering',
  'media',
  'attire',
  'entertainment',
  'planning',
  'execution',
  'post_event',
]);
export type MilestoneCategory = z.infer<typeof MilestoneCategorySchema>;

export const MilestoneSchema = z
  .object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(150),
    offsetDays: z.number().int().min(-3650).max(3650),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    category: MilestoneCategorySchema.default('planning'),
    completed: z.boolean().default(false),
  })
  .strict();
export type Milestone = z.infer<typeof MilestoneSchema>;

export const VendorPrioritySchema = z.enum(['high', 'medium', 'low']);
export type VendorPriority = z.infer<typeof VendorPrioritySchema>;

export const VendorStatusSchema = z.enum(['not_started', 'contacted', 'quoted', 'booked']);
export type VendorStatus = z.infer<typeof VendorStatusSchema>;

export const VendorTaskSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    category: z.string().min(1).max(50),
    priority: VendorPrioritySchema.default('medium'),
    status: VendorStatusSchema.default('not_started'),
    suggestedQuestions: z.array(z.string().min(1).max(300)).max(10).default([]),
  })
  .strict();
export type VendorTask = z.infer<typeof VendorTaskSchema>;
export const VendorItemSchema = VendorTaskSchema;
export type VendorItem = VendorTask;

export const EventPlanSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.number().int().positive().default(1),
    title: z.string().min(1).max(150),
    eventType: z.string().min(1).max(100),
    eventDate: CalendarDateSchema.nullable(),
    timezone: z.string().min(1).max(50).default('UTC'),
    location: z.string().max(200).default(''),
    guestCount: z.number().int().nonnegative().max(100000).default(0),
    currency: z.string().min(3).max(3).default('INR'),
    totalCap: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
    items: z.array(BudgetItemSchema).default([]),
    milestones: z.array(MilestoneSchema).default([]),
    vendors: z.array(VendorTaskSchema).default([]),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();
export type EventPlan = z.infer<typeof EventPlanSchema>;

export interface DerivedEventMetrics {
  projectedTotal: number;
  committedTotal: number;
  actualTotal: number;
  remainingBudget: number;
  isOverBudget: boolean;
  allocationPercent: number;
  completedMilestones: number;
  totalMilestones: number;
  timelineProgressPercent: number;
}
