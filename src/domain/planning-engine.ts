import { EventPlan, EventPlanSchema, DerivedEventMetrics } from './event-plan.schema';
import { Proposal, ProposalSchema, PlanMutation } from './proposal.schema';

export class DomainEngineError extends Error {
  constructor(message: string, public readonly operationIndex?: number) {
    super(message);
    this.name = 'DomainEngineError';
  }
}

export type PlanningResult =
  | {
      success: true;
      plan: EventPlan;
      derivedMetrics: DerivedEventMetrics;
      appliedOperationsCount: number;
    }
  | {
      success: false;
      error: string;
      failedOperationIndex?: number;
      originalPlan: EventPlan;
    };

/**
 * Calculates derived financial and progress metrics with 100% deterministic integer arithmetic.
 * Never causes floating-point drift.
 */
export function calculateTotals(plan: EventPlan): DerivedEventMetrics {
  let projectedTotal = 0;
  let committedTotal = 0;
  let actualTotal = 0;

  for (const item of plan.items) {
    projectedTotal += item.estimatedCost;
    if (item.status === 'committed' || item.status === 'paid') {
      committedTotal += item.actualCost;
    }
    actualTotal += item.actualCost > 0 ? item.actualCost : item.estimatedCost;
  }

  if (
    !Number.isSafeInteger(projectedTotal) ||
    !Number.isSafeInteger(committedTotal) ||
    !Number.isSafeInteger(actualTotal)
  ) {
    throw new DomainEngineError('Arithmetic calculation resulted in unsafe integer overflow');
  }

  const remainingBudget = plan.totalCap - projectedTotal;
  const isOverBudget = remainingBudget < 0;
  const allocationPercent =
    plan.totalCap > 0 ? Math.round((projectedTotal / plan.totalCap) * 100) : 0;

  const completedMilestones = plan.milestones.filter((m) => m.completed).length;
  const totalMilestones = plan.milestones.length;
  const timelineProgressPercent =
    totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return {
    projectedTotal,
    committedTotal,
    actualTotal,
    remainingBudget,
    isOverBudget,
    allocationPercent,
    completedMilestones,
    totalMilestones,
    timelineProgressPercent,
  };
}

/**
 * Computes calendar target date from eventDate and offsetDays using pure UTC arithmetic.
 * Ensures zero daylight-savings or local timezone drift.
 */
export function computeDueDate(eventDate: string | null, offsetDays: number): string | null {
  if (!eventDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // UTC Date Arithmetic
  const utcDate = new Date(Date.UTC(year, month - 1, day + offsetDays));
  const resYear = utcDate.getUTCFullYear();
  const resMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const resDay = String(utcDate.getUTCDate()).padStart(2, '0');

  return `${resYear}-${resMonth}-${resDay}`;
}

/**
 * Recomputes all milestone target dates and sorts them ascending by offsetDays.
 */
export function recalculateMilestoneDates(plan: EventPlan): EventPlan {
  const sortedMilestones = [...plan.milestones]
    .map((ms) => ({
      ...ms,
      dueDate: computeDueDate(plan.eventDate, ms.offsetDays),
    }))
    .sort((a, b) => a.offsetDays - b.offsetDays);

  return {
    ...plan,
    milestones: sortedMilestones,
  };
}

/**
 * Applies a single atomic mutation to a plan instance.
 * Throws DomainEngineError if target identifiers do not exist or invariants are violated.
 */
export function applyMutation(plan: EventPlan, mutation: PlanMutation): EventPlan {
  switch (mutation.type) {
    case 'SET_DETAILS': {
      const nextPlan: EventPlan = {
        ...plan,
        title: mutation.title ?? plan.title,
        eventType: mutation.eventType ?? plan.eventType,
        eventDate: mutation.eventDate !== undefined ? mutation.eventDate : plan.eventDate,
        timezone: mutation.timezone ?? plan.timezone,
        location: mutation.location ?? plan.location,
      };

      if (mutation.eventDate !== undefined && mutation.eventDate !== plan.eventDate) {
        return recalculateMilestoneDates(nextPlan);
      }
      return nextPlan;
    }

    case 'UPDATE_GUEST_COUNT': {
      return {
        ...plan,
        guestCount: mutation.guestCount,
      };
    }

    case 'UPDATE_TARGET_BUDGET': {
      return {
        ...plan,
        totalCap: mutation.totalCap,
      };
    }

    case 'ADD_BUDGET_ITEM': {
      const newItemId = mutation.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newItem = {
        id: newItemId,
        name: mutation.name,
        category: mutation.category,
        estimatedCost: mutation.estimatedCost,
        actualCost: mutation.actualCost ?? 0,
        status: mutation.status ?? 'projected',
        notes: mutation.notes,
      };

      return {
        ...plan,
        items: [...plan.items, newItem],
      };
    }

    case 'UPDATE_BUDGET_ITEM': {
      const itemIndex = plan.items.findIndex((item) => item.id === mutation.itemId);
      if (itemIndex === -1) {
        throw new DomainEngineError(`Budget item with ID "${mutation.itemId}" does not exist in the plan`);
      }

      const existing = plan.items[itemIndex];
      const updatedItems = [...plan.items];
      updatedItems[itemIndex] = {
        ...existing,
        name: mutation.name ?? existing.name,
        category: mutation.category ?? existing.category,
        estimatedCost: mutation.estimatedCost ?? existing.estimatedCost,
        actualCost: mutation.actualCost ?? existing.actualCost,
        status: mutation.status ?? existing.status,
        notes: mutation.notes !== undefined ? mutation.notes : existing.notes,
      };

      return {
        ...plan,
        items: updatedItems,
      };
    }

    case 'REMOVE_BUDGET_ITEM': {
      const itemIndex = plan.items.findIndex((item) => item.id === mutation.itemId);
      if (itemIndex === -1) {
        throw new DomainEngineError(`Budget item with ID "${mutation.itemId}" does not exist in the plan`);
      }

      return {
        ...plan,
        items: plan.items.filter((item) => item.id !== mutation.itemId),
      };
    }

    case 'ADD_MILESTONE': {
      const newMsId = mutation.id || `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newMilestone = {
        id: newMsId,
        title: mutation.title,
        offsetDays: mutation.offsetDays,
        dueDate: computeDueDate(plan.eventDate, mutation.offsetDays),
        category: mutation.category ?? 'planning',
        completed: false,
      };

      const updatedMilestones = [...plan.milestones, newMilestone].sort((a, b) => a.offsetDays - b.offsetDays);

      return {
        ...plan,
        milestones: updatedMilestones,
      };
    }

    case 'UPDATE_MILESTONE': {
      const msIndex = plan.milestones.findIndex((m) => m.id === mutation.milestoneId);
      if (msIndex === -1) {
        throw new DomainEngineError(`Milestone with ID "${mutation.milestoneId}" does not exist in the plan`);
      }

      const existing = plan.milestones[msIndex];
      const nextOffsetDays = mutation.offsetDays ?? existing.offsetDays;
      const updatedMs = {
        ...existing,
        title: mutation.title ?? existing.title,
        offsetDays: nextOffsetDays,
        dueDate: computeDueDate(plan.eventDate, nextOffsetDays),
        category: mutation.category ?? existing.category,
        completed: mutation.completed ?? existing.completed,
      };

      const updatedMilestones = [...plan.milestones];
      updatedMilestones[msIndex] = updatedMs;
      updatedMilestones.sort((a, b) => a.offsetDays - b.offsetDays);

      return {
        ...plan,
        milestones: updatedMilestones,
      };
    }

    case 'REMOVE_MILESTONE': {
      const msIndex = plan.milestones.findIndex((m) => m.id === mutation.milestoneId);
      if (msIndex === -1) {
        throw new DomainEngineError(`Milestone with ID "${mutation.milestoneId}" does not exist in the plan`);
      }

      return {
        ...plan,
        milestones: plan.milestones.filter((m) => m.id !== mutation.milestoneId),
      };
    }

    case 'ADD_VENDOR': {
      const newVendorId = mutation.id || `ven-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newVendor = {
        id: newVendorId,
        name: mutation.name,
        category: mutation.category,
        priority: mutation.priority ?? 'medium',
        status: 'not_started' as const,
        suggestedQuestions: mutation.suggestedQuestions ?? [],
      };

      return {
        ...plan,
        vendors: [...plan.vendors, newVendor],
      };
    }

    case 'UPDATE_VENDOR': {
      const vIndex = plan.vendors.findIndex((v) => v.id === mutation.vendorId);
      if (vIndex === -1) {
        throw new DomainEngineError(`Vendor task with ID "${mutation.vendorId}" does not exist in the plan`);
      }

      const existing = plan.vendors[vIndex];
      const updatedVendors = [...plan.vendors];
      updatedVendors[vIndex] = {
        ...existing,
        priority: mutation.priority ?? existing.priority,
        status: mutation.status ?? existing.status,
        suggestedQuestions: mutation.suggestedQuestions ?? existing.suggestedQuestions,
      };

      return {
        ...plan,
        vendors: updatedVendors,
      };
    }

    case 'REMOVE_VENDOR': {
      const vIndex = plan.vendors.findIndex((v) => v.id === mutation.vendorId);
      if (vIndex === -1) {
        throw new DomainEngineError(`Vendor task with ID "${mutation.vendorId}" does not exist in the plan`);
      }

      return {
        ...plan,
        vendors: plan.vendors.filter((v) => v.id !== mutation.vendorId),
      };
    }

    default: {
      const exhaustiveCheck: never = mutation;
      throw new DomainEngineError(`Unhandled mutation type: ${(exhaustiveCheck as { type: string }).type}`);
    }
  }
}

/**
 * Evaluates and applies a proposal atomically.
 * If any operation fails, the entire batch is aborted, preserving the original plan 100% untouched.
 */
export function applyProposal(currentPlan: EventPlan, proposal: Proposal): PlanningResult {
  // Validate input structures
  const planValidation = EventPlanSchema.safeParse(currentPlan);
  if (!planValidation.success) {
    return {
      success: false,
      error: `Invalid current EventPlan: ${planValidation.error.message}`,
      originalPlan: currentPlan,
    };
  }

  const proposalValidation = ProposalSchema.safeParse(proposal);
  if (!proposalValidation.success) {
    return {
      success: false,
      error: `Invalid Proposal structure: ${proposalValidation.error.message}`,
      originalPlan: currentPlan,
    };
  }

  // Deep clone to guarantee non-mutability of original input
  let workingPlan: EventPlan = structuredClone(planValidation.data);

  let opIndex = 0;
  try {
    for (const operation of proposalValidation.data.operations) {
      workingPlan = applyMutation(workingPlan, operation);
      opIndex++;
    }

    // Recalculate milestone dates in case eventDate or offsets were altered
    workingPlan = recalculateMilestoneDates(workingPlan);

    // Increment version monotonically
    workingPlan.version = currentPlan.version + 1;
    workingPlan.updatedAt = new Date().toISOString();

    // Verify resulting plan against schema invariants
    const resultingValidation = EventPlanSchema.parse(workingPlan);

    // Compute derived metrics
    const derivedMetrics = calculateTotals(resultingValidation);

    return {
      success: true,
      plan: resultingValidation,
      derivedMetrics,
      appliedOperationsCount: proposalValidation.data.operations.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown domain engine error';
    return {
      success: false,
      error: errorMessage,
      failedOperationIndex: opIndex,
      originalPlan: currentPlan,
    };
  }
}

/**
 * Applies a proposal or throws a DomainEngineError on any failure.
 */
export function applyProposalOrThrow(currentPlan: EventPlan, proposal: Proposal): EventPlan {
  const result = applyProposal(currentPlan, proposal);
  if (!result.success) {
    throw new DomainEngineError(result.error, result.failedOperationIndex);
  }
  return result.plan;
}
