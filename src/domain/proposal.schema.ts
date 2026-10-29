import { z } from 'zod';
import {
  BudgetItemStatusSchema,
  MilestoneCategorySchema,
  VendorPrioritySchema,
  VendorStatusSchema,
} from './event-plan.schema';

export const SetDetailsMutationSchema = z
  .object({
    type: z.literal('SET_DETAILS'),
    title: z.string().min(1).max(150).optional(),
    eventType: z.string().min(1).max(100).optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    timezone: z.string().min(1).max(50).optional(),
    location: z.string().max(200).optional(),
  })
  .strict();

export const UpdateGuestCountMutationSchema = z
  .object({
    type: z.literal('UPDATE_GUEST_COUNT'),
    guestCount: z.number().int().nonnegative().max(100000),
  })
  .strict();

export const UpdateTargetBudgetMutationSchema = z
  .object({
    type: z.literal('UPDATE_TARGET_BUDGET'),
    totalCap: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const AddBudgetItemMutationSchema = z
  .object({
    type: z.literal('ADD_BUDGET_ITEM'),
    id: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(100),
    category: z.string().min(1).max(50),
    estimatedCost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    actualCost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    status: BudgetItemStatusSchema.optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

export const UpdateBudgetItemMutationSchema = z
  .object({
    type: z.literal('UPDATE_BUDGET_ITEM'),
    itemId: z.string().min(1).max(100),
    name: z.string().min(1).max(100).optional(),
    category: z.string().min(1).max(50).optional(),
    estimatedCost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    actualCost: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    status: BudgetItemStatusSchema.optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

export const RemoveBudgetItemMutationSchema = z
  .object({
    type: z.literal('REMOVE_BUDGET_ITEM'),
    itemId: z.string().min(1).max(100),
  })
  .strict();

export const AddMilestoneMutationSchema = z
  .object({
    type: z.literal('ADD_MILESTONE'),
    id: z.string().min(1).max(100).optional(),
    title: z.string().min(1).max(150),
    offsetDays: z.number().int().min(-3650).max(3650),
    category: MilestoneCategorySchema.optional(),
  })
  .strict();

export const UpdateMilestoneMutationSchema = z
  .object({
    type: z.literal('UPDATE_MILESTONE'),
    milestoneId: z.string().min(1).max(100),
    title: z.string().min(1).max(150).optional(),
    offsetDays: z.number().int().min(-3650).max(3650).optional(),
    category: MilestoneCategorySchema.optional(),
    completed: z.boolean().optional(),
  })
  .strict();

export const RemoveMilestoneMutationSchema = z
  .object({
    type: z.literal('REMOVE_MILESTONE'),
    milestoneId: z.string().min(1).max(100),
  })
  .strict();

export const AddVendorMutationSchema = z
  .object({
    type: z.literal('ADD_VENDOR'),
    id: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(100),
    category: z.string().min(1).max(50),
    priority: VendorPrioritySchema.optional(),
    suggestedQuestions: z.array(z.string().min(1).max(300)).max(10).optional(),
  })
  .strict();

export const UpdateVendorMutationSchema = z
  .object({
    type: z.literal('UPDATE_VENDOR'),
    vendorId: z.string().min(1).max(100),
    priority: VendorPrioritySchema.optional(),
    status: VendorStatusSchema.optional(),
    suggestedQuestions: z.array(z.string().min(1).max(300)).max(10).optional(),
  })
  .strict();

export const RemoveVendorMutationSchema = z
  .object({
    type: z.literal('REMOVE_VENDOR'),
    vendorId: z.string().min(1).max(100),
  })
  .strict();

export const PlanMutationSchema = z.discriminatedUnion('type', [
  SetDetailsMutationSchema,
  UpdateGuestCountMutationSchema,
  UpdateTargetBudgetMutationSchema,
  AddBudgetItemMutationSchema,
  UpdateBudgetItemMutationSchema,
  RemoveBudgetItemMutationSchema,
  AddMilestoneMutationSchema,
  UpdateMilestoneMutationSchema,
  RemoveMilestoneMutationSchema,
  AddVendorMutationSchema,
  UpdateVendorMutationSchema,
  RemoveVendorMutationSchema,
]);
export type PlanMutation = z.infer<typeof PlanMutationSchema>;

export const ProposalSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    summary: z.string().min(1).max(500),
    operations: z.array(PlanMutationSchema).min(1).max(50),
  })
  .strict();
export type Proposal = z.infer<typeof ProposalSchema>;
