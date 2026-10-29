import { describe, it, expect } from 'vitest';
import {
  EventPlan,
  EventPlanSchema,
  BudgetItemSchema,
  CalendarDateSchema,
  isValidCalendarDate,
} from '@/domain/event-plan.schema';
import { Proposal, ProposalSchema } from '@/domain/proposal.schema';
import {
  calculateTotals,
  computeDueDate,
  applyProposal,
  applyProposalOrThrow,
  DomainEngineError,
} from '@/domain/planning-engine';

describe('Canonical EventPlan Model & Zod Schemas', () => {
  const baseValidPlan: EventPlan = {
    id: 'test-plan-1',
    version: 1,
    title: 'Silver Jubilee Celebration',
    eventType: 'Anniversary Party',
    eventDate: '2026-11-20',
    timezone: 'Asia/Kolkata',
    location: 'Taj West End, Bengaluru',
    guestCount: 150,
    currency: 'INR',
    totalCap: 1000000, // ₹10,00,000 in integer paise / units
    items: [
      {
        id: 'item-1',
        name: 'Banquet Hall Rental',
        category: 'Venue',
        estimatedCost: 300000,
        actualCost: 300000,
        status: 'committed',
        notes: 'Signed contract',
      },
      {
        id: 'item-2',
        name: 'Gourmet Dinner Buffet',
        category: 'Catering',
        estimatedCost: 450000,
        actualCost: 0,
        status: 'quoted',
      },
    ],
    milestones: [
      {
        id: 'ms-1',
        title: 'Sign Banquet Agreement',
        offsetDays: -90,
        dueDate: '2026-08-22',
        category: 'venue',
        completed: true,
      },
      {
        id: 'ms-2',
        title: 'Tasting Session & Final Menu',
        offsetDays: -30,
        dueDate: '2026-10-21',
        category: 'catering',
        completed: false,
      },
    ],
    vendors: [
      {
        id: 'ven-1',
        name: 'Taj Banquet Operations',
        category: 'Venue',
        priority: 'high',
        status: 'booked',
        suggestedQuestions: ['What is the stage setup clearance time?'],
      },
    ],
  };

  it('validates a complete, canonical EventPlan successfully', () => {
    const parsed = EventPlanSchema.parse(baseValidPlan);
    expect(parsed.id).toBe('test-plan-1');
    expect(parsed.items.length).toBe(2);
    expect(parsed.milestones.length).toBe(2);
  });

  it('rejects unknown fields in EventPlan due to strict schema rules', () => {
    const invalidPlan = {
      ...baseValidPlan,
      unknownInjectedField: 'hack',
    };
    expect(() => EventPlanSchema.parse(invalidPlan)).toThrow();
  });

  it('rejects negative guest counts and negative budget numbers', () => {
    expect(() =>
      EventPlanSchema.parse({
        ...baseValidPlan,
        guestCount: -5,
      })
    ).toThrow();

    expect(() =>
      EventPlanSchema.parse({
        ...baseValidPlan,
        totalCap: -1000,
      })
    ).toThrow();
  });

  it('rejects malformed and non-existent date formats in EventPlan', () => {
    expect(() =>
      EventPlanSchema.parse({
        ...baseValidPlan,
        eventDate: '20-11-2026', // invalid, must be YYYY-MM-DD
      })
    ).toThrow();

    expect(() =>
      EventPlanSchema.parse({
        ...baseValidPlan,
        eventDate: '2026-02-30', // invalid calendar date
      })
    ).toThrow();

    expect(() =>
      EventPlanSchema.parse({
        ...baseValidPlan,
        eventDate: '1999-12-31', // out of supported range [2000, 2100]
      })
    ).toThrow();
  });

  it('validates calendar dates strictly via isValidCalendarDate and CalendarDateSchema', () => {
    // Valid dates
    expect(isValidCalendarDate('2026-11-20')).toBe(true);
    expect(isValidCalendarDate('2024-02-29')).toBe(true); // leap year
    expect(isValidCalendarDate('2028-02-29')).toBe(true); // leap year
    expect(isValidCalendarDate('2000-02-29')).toBe(true); // century leap year
    expect(CalendarDateSchema.safeParse('2026-11-20').success).toBe(true);

    // Invalid dates
    expect(isValidCalendarDate('2025-02-29')).toBe(false); // non-leap
    expect(isValidCalendarDate('2100-02-29')).toBe(false); // century non-leap year (divisible by 100, not 400)
    expect(isValidCalendarDate('2026-04-31')).toBe(false); // 30-day month
    expect(isValidCalendarDate('2026-13-01')).toBe(false); // month > 12
    expect(isValidCalendarDate('2026-00-10')).toBe(false); // month < 1
    expect(isValidCalendarDate('2026-01-00')).toBe(false); // day < 1
    expect(isValidCalendarDate('2026-01-32')).toBe(false); // day > 31
    expect(isValidCalendarDate('1999-12-31')).toBe(false); // year < 2000
    expect(isValidCalendarDate('2101-01-01')).toBe(false); // year > 2100
    expect(isValidCalendarDate('not-a-date')).toBe(false);
    expect(isValidCalendarDate(' 2026-11-20 ')).toBe(false); // whitespace
    expect(CalendarDateSchema.safeParse('2025-02-29').success).toBe(false);
    expect(CalendarDateSchema.safeParse('2028-02-29').success).toBe(true);
    expect(CalendarDateSchema.safeParse('2100-02-29').success).toBe(false);
    expect(CalendarDateSchema.safeParse('2026-13-45').success).toBe(false);
  });

  it('rejects non-integer monetary values in BudgetItem', () => {
    expect(() =>
      BudgetItemSchema.parse({
        id: 'item-float',
        name: 'Float Item',
        category: 'General',
        estimatedCost: 100.55, // floating-point not allowed
        actualCost: 0,
        status: 'projected',
      })
    ).toThrow();
  });
});

describe('Deterministic Financial Arithmetic (calculateTotals)', () => {
  it('calculates integer sums with zero floating-point drift', () => {
    const plan: EventPlan = {
      id: 'plan-math',
      version: 1,
      title: 'Precision Test',
      eventType: 'Test',
      eventDate: '2026-12-01',
      timezone: 'UTC',
      location: '',
      guestCount: 50,
      currency: 'INR',
      totalCap: 100000,
      items: [
        { id: '1', name: 'Item 1', category: 'General', estimatedCost: 10005, actualCost: 10005, status: 'committed' },
        { id: '2', name: 'Item 2', category: 'General', estimatedCost: 20005, actualCost: 20005, status: 'paid' },
        { id: '3', name: 'Item 3', category: 'General', estimatedCost: 30005, actualCost: 0, status: 'projected' },
      ],
      milestones: [
        { id: 'm1', title: 'M1', offsetDays: -10, dueDate: '2026-11-21', category: 'planning', completed: true },
        { id: 'm2', title: 'M2', offsetDays: 0, dueDate: '2026-12-01', category: 'execution', completed: false },
      ],
      vendors: [],
    };

    const metrics = calculateTotals(plan);

    // Exact sums
    expect(metrics.projectedTotal).toBe(60015);
    expect(metrics.committedTotal).toBe(30010); // item 1 + item 2
    expect(metrics.actualTotal).toBe(60015); // item 1 + item 2 + item 3 estimated
    expect(metrics.remainingBudget).toBe(39985); // 100000 - 60015
    expect(metrics.isOverBudget).toBe(false);
    expect(metrics.allocationPercent).toBe(60);
    expect(metrics.completedMilestones).toBe(1);
    expect(metrics.totalMilestones).toBe(2);
    expect(metrics.timelineProgressPercent).toBe(50);
  });

  it('correctly tracks budget overruns as valid negative remaining budget', () => {
    const plan: EventPlan = {
      id: 'plan-over',
      version: 1,
      title: 'Overrun Test',
      eventType: 'Test',
      eventDate: '2026-12-01',
      timezone: 'UTC',
      location: '',
      guestCount: 50,
      currency: 'INR',
      totalCap: 50000,
      items: [
        { id: '1', name: 'Heavy Item', category: 'General', estimatedCost: 75000, actualCost: 0, status: 'projected' },
      ],
      milestones: [],
      vendors: [],
    };

    const metrics = calculateTotals(plan);
    expect(metrics.projectedTotal).toBe(75000);
    expect(metrics.remainingBudget).toBe(-25000);
    expect(metrics.isOverBudget).toBe(true);
    expect(metrics.allocationPercent).toBe(150);
  });
});

describe('UTC Calendar Date Arithmetic (computeDueDate)', () => {
  it('computes negative offsets correctly across month boundaries', () => {
    // 18 Dec 2026 - 180 days -> 21 Jun 2026
    const dueDate = computeDueDate('2026-12-18', -180);
    expect(dueDate).toBe('2026-06-21');
  });

  it('computes negative offsets across year boundaries', () => {
    // 15 Jan 2026 - 30 days -> 16 Dec 2025
    const dueDate = computeDueDate('2026-01-15', -30);
    expect(dueDate).toBe('2025-12-16');
  });

  it('handles positive offsets (post-event) and zero offset (event day)', () => {
    expect(computeDueDate('2026-12-18', 0)).toBe('2026-12-18');
    expect(computeDueDate('2026-12-18', 3)).toBe('2026-12-21');
  });

  it('returns null if eventDate is null', () => {
    expect(computeDueDate(null, -30)).toBeNull();
  });
});

describe('Pure Planning Engine: applyProposal', () => {
  const getInitialPlan = (): EventPlan => ({
    id: 'plan-base',
    version: 1,
    title: 'Initial Event',
    eventType: 'Birthday',
    eventDate: '2026-10-15',
    timezone: 'UTC',
    location: 'Central Park',
    guestCount: 50,
    currency: 'INR',
    totalCap: 200000,
    items: [
      { id: 'item-101', name: 'Catering', category: 'Food', estimatedCost: 80000, actualCost: 0, status: 'projected' },
    ],
    milestones: [
      { id: 'ms-101', title: 'Book Caterer', offsetDays: -45, dueDate: '2026-08-31', category: 'catering', completed: false },
    ],
    vendors: [
      { id: 'ven-101', name: 'City Caterers', category: 'Food', priority: 'high', status: 'not_started', suggestedQuestions: [] },
    ],
  });

  it('applies UPDATE_GUEST_COUNT and bumps version monotonically', () => {
    const initial = getInitialPlan();
    const proposal: Proposal = {
      summary: 'Increase guest count to 120',
      operations: [
        {
          type: 'UPDATE_GUEST_COUNT',
          guestCount: 120,
        },
      ],
    };

    const result = applyProposal(initial, proposal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.plan.guestCount).toBe(120);
      expect(result.plan.version).toBe(2);
      expect(result.appliedOperationsCount).toBe(1);
    }
  });

  it('allows updating guest count to 0', () => {
    const initial = getInitialPlan();
    const proposal: Proposal = {
      summary: 'Reset guest count',
      operations: [
        {
          type: 'UPDATE_GUEST_COUNT',
          guestCount: 0,
        },
      ],
    };

    const result = applyProposal(initial, proposal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.plan.guestCount).toBe(0);
    }
  });

  it('applies UPDATE_TARGET_BUDGET', () => {
    const initial = getInitialPlan();
    const proposal: Proposal = {
      summary: 'Expand budget ceiling',
      operations: [
        {
          type: 'UPDATE_TARGET_BUDGET',
          totalCap: 350000,
        },
      ],
    };

    const result = applyProposal(initial, proposal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.plan.totalCap).toBe(350000);
      expect(result.derivedMetrics.remainingBudget).toBe(350000 - 80000);
    }
  });

  it('applies SET_DETAILS and automatically cascades milestone due dates', () => {
    const initial = getInitialPlan();
    const proposal: Proposal = {
      summary: 'Reschedule event date to December 1st',
      operations: [
        {
          type: 'SET_DETAILS',
          eventDate: '2026-12-01',
          location: 'Grand Ballroom',
        },
      ],
    };

    const result = applyProposal(initial, proposal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.plan.eventDate).toBe('2026-12-01');
      expect(result.plan.location).toBe('Grand Ballroom');
      // ms-101 has offset -45d. From 2026-12-01 - 45d = 2026-10-17
      expect(result.plan.milestones[0].dueDate).toBe('2026-10-17');
    }
  });

  it('applies budget item lifecycle: ADD, UPDATE, REMOVE', () => {
    const initial = getInitialPlan();

    // 1. ADD_BUDGET_ITEM
    const addProposal: Proposal = {
      summary: 'Add Photography',
      operations: [
        {
          type: 'ADD_BUDGET_ITEM',
          id: 'item-photo',
          name: 'Photography & Video',
          category: 'Media',
          estimatedCost: 50000,
        },
      ],
    };

    const afterAdd = applyProposalOrThrow(initial, addProposal);
    expect(afterAdd.items.length).toBe(2);
    expect(afterAdd.version).toBe(2);
    expect(calculateTotals(afterAdd).projectedTotal).toBe(130000);

    // 2. UPDATE_BUDGET_ITEM
    const updateProposal: Proposal = {
      summary: 'Commit photo vendor with actual quotation',
      operations: [
        {
          type: 'UPDATE_BUDGET_ITEM',
          itemId: 'item-photo',
          actualCost: 45000,
          status: 'committed',
        },
      ],
    };

    const afterUpdate = applyProposalOrThrow(afterAdd, updateProposal);
    const photoItem = afterUpdate.items.find((i) => i.id === 'item-photo');
    expect(photoItem?.actualCost).toBe(45000);
    expect(photoItem?.status).toBe('committed');
    expect(calculateTotals(afterUpdate).committedTotal).toBe(45000);

    // 3. REMOVE_BUDGET_ITEM
    const removeProposal: Proposal = {
      summary: 'Remove Catering item',
      operations: [
        {
          type: 'REMOVE_BUDGET_ITEM',
          itemId: 'item-101',
        },
      ],
    };

    const afterRemove = applyProposalOrThrow(afterUpdate, removeProposal);
    expect(afterRemove.items.length).toBe(1);
    expect(afterRemove.items[0].id).toBe('item-photo');
  });

  it('applies vendor lifecycle: ADD, UPDATE, REMOVE', () => {
    const initial = getInitialPlan();
    const proposal: Proposal = {
      summary: 'Manage DJ vendor',
      operations: [
        {
          type: 'ADD_VENDOR',
          id: 'ven-dj',
          name: 'Beat Master DJ',
          category: 'Music',
          priority: 'medium',
          suggestedQuestions: ['Do you have backup equipment?'],
        },
        {
          type: 'UPDATE_VENDOR',
          vendorId: 'ven-dj',
          status: 'contacted',
        },
      ],
    };

    const result = applyProposal(initial, proposal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.plan.vendors.length).toBe(2);
      const dj = result.plan.vendors.find((v) => v.id === 'ven-dj');
      expect(dj?.status).toBe('contacted');
      expect(dj?.suggestedQuestions).toContain('Do you have backup equipment?');
    }
  });

  it('atomic rollback: if operation #3 fails, previous operations are discarded and initial plan remains 100% untouched', () => {
    const initial = getInitialPlan();

    const faultyProposal: Proposal = {
      summary: 'Batch with invalid third operation',
      operations: [
        {
          type: 'UPDATE_GUEST_COUNT',
          guestCount: 999, // would succeed
        },
        {
          type: 'ADD_BUDGET_ITEM',
          name: 'Live Band',
          category: 'Music',
          estimatedCost: 60000, // would succeed
        },
        {
          type: 'UPDATE_BUDGET_ITEM',
          itemId: 'non-existent-item-999', // WILL FAIL!
          estimatedCost: 10000,
        },
      ],
    };

    const result = applyProposal(initial, faultyProposal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('non-existent-item-999');
      expect(result.failedOperationIndex).toBe(2);

      // Verify that initial plan was NEVER mutated
      expect(result.originalPlan.guestCount).toBe(50);
      expect(result.originalPlan.items.length).toBe(1);
      expect(result.originalPlan.version).toBe(1);
    }

    // Direct object equality check: original reference preserved
    expect(initial.guestCount).toBe(50);
    expect(initial.items.length).toBe(1);
  });

  it('throws DomainEngineError when applyProposalOrThrow encounters failure', () => {
    const initial = getInitialPlan();
    const faultyProposal: Proposal = {
      summary: 'Remove missing milestone',
      operations: [
        {
          type: 'REMOVE_MILESTONE',
          milestoneId: 'ms-does-not-exist',
        },
      ],
    };

    expect(() => applyProposalOrThrow(initial, faultyProposal)).toThrow(DomainEngineError);
  });

  it('rejects unknown proposal operation types', () => {
    const maliciousProposal = {
      summary: 'Injected operation',
      operations: [
        {
          type: 'EXECUTE_SQL',
          query: 'DROP TABLE event_plans;',
        },
      ],
    };

    // Fails at schema validation before engine touches it
    expect(() => ProposalSchema.parse(maliciousProposal)).toThrow();
  });

  it('rejects ADD_BUDGET_ITEM with an ID that already exists in the plan', () => {
    const initial = getInitialPlan();
    const duplicateProposal: Proposal = {
      summary: 'Add item with collision ID',
      operations: [
        {
          type: 'ADD_BUDGET_ITEM',
          id: 'item-101', // Already in initial plan
          name: 'Conflict Item',
          category: 'Decor',
          estimatedCost: 15000,
        },
      ],
    };

    const result = applyProposal(initial, duplicateProposal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('already exists in the plan');
    }
  });

  it('detects budget overruns when actualCost exceeds estimatedCost', () => {
    const initial = getInitialPlan();
    // initial totalCap is 200000, item-101 estimated is 80000
    // Commit item-101 at 250000 (over totalCap 200000)
    const overrunProposal: Proposal = {
      summary: 'Commit catering with major overrun',
      operations: [
        {
          type: 'UPDATE_BUDGET_ITEM',
          itemId: 'item-101',
          actualCost: 250000,
          status: 'committed',
        },
      ],
    };

    const result = applyProposal(initial, overrunProposal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.derivedMetrics.isOverBudget).toBe(true);
      expect(result.derivedMetrics.remainingBudget).toBe(-50000); // 200000 - 250000
      expect(result.derivedMetrics.allocationPercent).toBe(125);
    }
  });

  it('correctly tracks $0 actual cost for sponsored/waived paid items', () => {
    const initial = getInitialPlan();
    const freeItemProposal: Proposal = {
      summary: 'Add free sponsored item and mark paid',
      operations: [
        {
          type: 'ADD_BUDGET_ITEM',
          id: 'item-free',
          name: 'Sponsored Cake',
          category: 'Food',
          estimatedCost: 20000,
          actualCost: 0,
          status: 'paid',
        },
      ],
    };

    const result = applyProposal(initial, freeItemProposal);
    expect(result.success).toBe(true);
    if (result.success) {
      const freeItem = result.plan.items.find((i) => i.id === 'item-free');
      expect(freeItem?.actualCost).toBe(0);
      expect(freeItem?.status).toBe('paid');
      // actualTotal should include 80000 (projected catering) + 0 (paid cake) = 80000
      expect(result.derivedMetrics.actualTotal).toBe(80000);
      expect(result.derivedMetrics.committedTotal).toBe(0);
    }
  });
});
