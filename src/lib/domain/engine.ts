import { EventPlan, EventPlanCalculations } from './types';
import { EventPlanProposal } from './mutations';

export interface AppliedMutationResult {
  nextPlan: EventPlan;
  appliedCount: number;
  rejectedMutations: Array<{ mutation: unknown; reason: string }>;
}

export function computeDueDate(eventDate: string | null, offsetDays: number): string | null {
  if (!eventDate) return null;
  const parts = eventDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

export function calculateTotals(plan: EventPlan): EventPlanCalculations {
  const projectedTotal = plan.items.reduce((sum, i) => sum + (i.estimatedCost || 0), 0);
  const actualTotal = plan.items.reduce((sum, i) => sum + (i.actualCost ?? i.estimatedCost ?? 0), 0);
  const committedTotal = plan.items
    .filter((i) => i.status === 'committed' || i.status === 'paid')
    .reduce((sum, i) => sum + (i.actualCost ?? i.estimatedCost ?? 0), 0);
  
  const remainingBudget = plan.totalCap - projectedTotal;
  const isOverBudget = remainingBudget < 0;
  const variancePercentage = plan.totalCap > 0 
    ? Math.round((projectedTotal / plan.totalCap) * 100) 
    : 0;
  
  const completedMilestones = plan.milestones.filter((m) => m.completed).length;
  const timelineProgress = plan.milestones.length > 0
    ? Math.round((completedMilestones / plan.milestones.length) * 100)
    : 0;

  return {
    projectedTotal,
    committedTotal,
    actualTotal,
    remainingBudget,
    isOverBudget,
    variancePercentage,
    timelineProgress,
  };
}

export function applyProposal(
  currentPlan: EventPlan,
  proposal: EventPlanProposal
): AppliedMutationResult {
  const draft: EventPlan = structuredClone(currentPlan);
  const rejectedMutations: Array<{ mutation: unknown; reason: string }> = [];
  let appliedCount = 0;

  for (const mut of proposal.mutations) {
    switch (mut.type) {
      case 'SET_DETAILS': {
        if (mut.title !== undefined) draft.title = mut.title;
        if (mut.eventType !== undefined) draft.eventType = mut.eventType;
        if (mut.guestCount !== undefined) draft.guestCount = mut.guestCount;
        if (mut.totalCap !== undefined) draft.totalCap = mut.totalCap;
        if (mut.eventDate !== undefined) {
          draft.eventDate = mut.eventDate;
          // Deterministically recompute all milestone due dates
          draft.milestones = draft.milestones.map((m) => ({
            ...m,
            dueDate: computeDueDate(mut.eventDate ?? null, m.offsetDays),
          }));
        }
        appliedCount++;
        break;
      }

      case 'ADD_BUDGET_ITEM': {
        draft.items.push({
          id: crypto.randomUUID(),
          category: mut.category,
          name: mut.name,
          estimatedCost: mut.estimatedCost,
          status: 'projected',
          notes: mut.notes,
        });
        appliedCount++;
        break;
      }

      case 'UPDATE_BUDGET_ITEM': {
        const item = draft.items.find((i) => i.id === mut.itemId);
        if (!item) {
          rejectedMutations.push({ mutation: mut, reason: `Item ID '${mut.itemId}' not found` });
          break;
        }
        if (mut.name !== undefined) item.name = mut.name;
        if (mut.category !== undefined) item.category = mut.category;
        if (mut.estimatedCost !== undefined) item.estimatedCost = mut.estimatedCost;
        if (mut.actualCost !== undefined) item.actualCost = mut.actualCost;
        if (mut.status !== undefined) item.status = mut.status;
        if (mut.notes !== undefined) item.notes = mut.notes;
        appliedCount++;
        break;
      }

      case 'REMOVE_BUDGET_ITEM': {
        const initialLen = draft.items.length;
        draft.items = draft.items.filter((i) => i.id !== mut.itemId);
        if (draft.items.length === initialLen) {
          rejectedMutations.push({ mutation: mut, reason: `Item ID '${mut.itemId}' not found` });
        } else {
          appliedCount++;
        }
        break;
      }

      case 'ADD_MILESTONE': {
        draft.milestones.push({
          id: crypto.randomUUID(),
          title: mut.title,
          offsetDays: mut.offsetDays,
          dueDate: computeDueDate(draft.eventDate, mut.offsetDays),
          completed: false,
          category: mut.category,
        });
        draft.milestones.sort((a, b) => a.offsetDays - b.offsetDays);
        appliedCount++;
        break;
      }

      case 'UPDATE_MILESTONE': {
        const ms = draft.milestones.find((m) => m.id === mut.milestoneId);
        if (!ms) {
          rejectedMutations.push({ mutation: mut, reason: `Milestone ID '${mut.milestoneId}' not found` });
          break;
        }
        if (mut.title !== undefined) ms.title = mut.title;
        if (mut.completed !== undefined) ms.completed = mut.completed;
        if (mut.offsetDays !== undefined) {
          ms.offsetDays = mut.offsetDays;
          ms.dueDate = computeDueDate(draft.eventDate, mut.offsetDays);
          draft.milestones.sort((a, b) => a.offsetDays - b.offsetDays);
        }
        appliedCount++;
        break;
      }

      case 'REMOVE_MILESTONE': {
        const initialLen = draft.milestones.length;
        draft.milestones = draft.milestones.filter((m) => m.id !== mut.milestoneId);
        if (draft.milestones.length === initialLen) {
          rejectedMutations.push({ mutation: mut, reason: `Milestone ID '${mut.milestoneId}' not found` });
        } else {
          appliedCount++;
        }
        break;
      }

      case 'ADD_VENDOR': {
        draft.vendors.push({
          id: crypto.randomUUID(),
          category: mut.category,
          name: mut.name,
          priority: mut.priority,
          status: 'not_started',
          suggestedQuestions: mut.suggestedQuestions,
        });
        appliedCount++;
        break;
      }

      case 'UPDATE_VENDOR': {
        const v = draft.vendors.find((item) => item.id === mut.vendorId);
        if (!v) {
          rejectedMutations.push({ mutation: mut, reason: `Vendor ID '${mut.vendorId}' not found` });
          break;
        }
        if (mut.priority !== undefined) v.priority = mut.priority;
        if (mut.status !== undefined) v.status = mut.status;
        if (mut.suggestedQuestions !== undefined) v.suggestedQuestions = mut.suggestedQuestions;
        appliedCount++;
        break;
      }

      case 'REMOVE_VENDOR': {
        const initialLen = draft.vendors.length;
        draft.vendors = draft.vendors.filter((v) => v.id !== mut.vendorId);
        if (draft.vendors.length === initialLen) {
          rejectedMutations.push({ mutation: mut, reason: `Vendor ID '${mut.vendorId}' not found` });
        } else {
          appliedCount++;
        }
        break;
      }
    }
  }

  if (appliedCount > 0) {
    draft.version += 1;
    draft.updatedAt = new Date().toISOString();
  }

  return { nextPlan: draft, appliedCount, rejectedMutations };
}

export function createEmptyPlan(title = 'My Celebration', eventType = 'party'): EventPlan {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    version: 1,
    title,
    eventType,
    eventDate: null,
    guestCount: 0,
    currency: 'USD',
    totalCap: 0,
    items: [],
    milestones: [],
    vendors: [],
    createdAt: now,
    updatedAt: now,
  };
}
