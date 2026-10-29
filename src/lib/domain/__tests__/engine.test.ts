import { describe, it, expect } from 'vitest';
import {
  createEmptyPlan,
  applyProposal,
  calculateTotals,
  computeDueDate,
} from '../engine';
import { EventPlanProposal } from '../mutations';

describe('Deterministic State Engine', () => {
  it('creates an empty plan with initial version 1 and zero totals', () => {
    const plan = createEmptyPlan('Silver Jubilee', 'anniversary');
    expect(plan.version).toBe(1);
    expect(plan.title).toBe('Silver Jubilee');
    expect(plan.eventType).toBe('anniversary');
    expect(plan.items).toEqual([]);

    const totals = calculateTotals(plan);
    expect(totals.projectedTotal).toBe(0);
    expect(totals.committedTotal).toBe(0);
    expect(totals.remainingBudget).toBe(0);
    expect(totals.isOverBudget).toBe(false);
  });

  it('correctly calculates integer totals and prevents float drift', () => {
    const plan = createEmptyPlan('Birthday Bash', 'birthday');
    plan.totalCap = 100000; // $1,000.00
    plan.items = [
      {
        id: '1',
        category: 'catering',
        name: 'Tacos & Drinks',
        estimatedCost: 35050, // $350.50
        status: 'projected',
      },
      {
        id: '2',
        category: 'venue',
        name: 'Community Hall',
        estimatedCost: 40025, // $400.25
        actualCost: 42000, // $420.00
        status: 'committed',
      },
    ];

    const totals = calculateTotals(plan);
    expect(totals.projectedTotal).toBe(75075); // $750.75
    expect(totals.committedTotal).toBe(42000); // $420.00
    expect(totals.actualTotal).toBe(77050); // $350.50 + $420.00
    expect(totals.remainingBudget).toBe(100000 - 75075);
    expect(totals.isOverBudget).toBe(false);
    expect(totals.variancePercentage).toBe(75);
  });

  it('computes due dates deterministically relative to event date', () => {
    // 60 days before 2026-12-31 is 2026-11-01
    expect(computeDueDate('2026-12-31', -60)).toBe('2026-11-01');
    // Day of event (offset 0)
    expect(computeDueDate('2026-12-31', 0)).toBe('2026-12-31');
    // 7 days after event
    expect(computeDueDate('2026-12-31', 7)).toBe('2027-01-07');
    // Returns null if eventDate is null
    expect(computeDueDate(null, -30)).toBeNull();
  });

  it('applies ADD_BUDGET_ITEM and updates version monotonically', () => {
    const plan = createEmptyPlan();
    const proposal: EventPlanProposal = {
      explanation: 'Add DJ and Catering',
      mutations: [
        {
          type: 'ADD_BUDGET_ITEM',
          category: 'entertainment',
          name: 'DJ Spark',
          estimatedCost: 50000,
        },
      ],
    };

    const { nextPlan, appliedCount, rejectedMutations } = applyProposal(plan, proposal);
    expect(appliedCount).toBe(1);
    expect(rejectedMutations).toHaveLength(0);
    expect(nextPlan.items).toHaveLength(1);
    expect(nextPlan.items[0].name).toBe('DJ Spark');
    expect(nextPlan.items[0].category).toBe('entertainment');
    expect(nextPlan.items[0].estimatedCost).toBe(50000);
    expect(nextPlan.version).toBe(2);
  });

  it('rejects mutations targeting non-existent item IDs without corrupting state', () => {
    const plan = createEmptyPlan();
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const proposal: EventPlanProposal = {
      explanation: 'Try updating non-existent item',
      mutations: [
        {
          type: 'UPDATE_BUDGET_ITEM',
          itemId: fakeId,
          estimatedCost: 99999,
        },
      ],
    };

    const { nextPlan, appliedCount, rejectedMutations } = applyProposal(plan, proposal);
    expect(appliedCount).toBe(0);
    expect(rejectedMutations).toHaveLength(1);
    expect(rejectedMutations[0].reason).toContain(fakeId);
    // Version should NOT increment if zero mutations were applied
    expect(nextPlan.version).toBe(1);
    expect(nextPlan.items).toHaveLength(0);
  });

  it('automatically recomputes milestone due dates when eventDate changes', () => {
    const plan = createEmptyPlan();
    // First add milestone with offset -30
    const addMilestoneProposal: EventPlanProposal = {
      explanation: 'Add catering milestone',
      mutations: [
        {
          type: 'ADD_MILESTONE',
          title: 'Finalize Catering Menu',
          offsetDays: -30,
          category: 'planning',
        },
      ],
    };
    const { nextPlan: step1 } = applyProposal(plan, addMilestoneProposal);
    expect(step1.milestones[0].dueDate).toBeNull(); // No event date yet

    // Now set event date
    const setDateProposal: EventPlanProposal = {
      explanation: 'Set wedding date',
      mutations: [
        {
          type: 'SET_DETAILS',
          eventDate: '2027-06-30',
        },
      ],
    };
    const { nextPlan: step2 } = applyProposal(step1, setDateProposal);
    expect(step2.eventDate).toBe('2027-06-30');
    // 30 days before 2027-06-30 is 2027-05-31
    expect(step2.milestones[0].dueDate).toBe('2027-05-31');
    expect(step2.version).toBe(3);
  });
});
