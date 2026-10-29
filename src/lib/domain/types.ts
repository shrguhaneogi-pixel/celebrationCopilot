export type BudgetCategory =
  | 'venue'
  | 'catering'
  | 'entertainment'
  | 'decor'
  | 'photography'
  | 'attire'
  | 'other';

export type BudgetItemStatus = 'projected' | 'quoted' | 'committed' | 'paid';

export interface BudgetItem {
  id: string; // UUID v4
  category: BudgetCategory;
  name: string;
  estimatedCost: number; // Stored in integer currency units (cents) to avoid float drift
  actualCost?: number;
  status: BudgetItemStatus;
  notes?: string;
}

export type MilestoneCategory = 'planning' | 'booking' | 'execution' | 'post_event';

export interface Milestone {
  id: string; // UUID v4
  title: string;
  offsetDays: number; // Event-relative offset (e.g., -60 = 60 days before event; 0 = day of)
  dueDate: string | null; // Derived ISO 8601 YYYY-MM-DD string: eventDate + offsetDays
  completed: boolean;
  category: MilestoneCategory;
}

export interface VendorChecklistItem {
  id: string; // UUID v4
  category: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  status: 'not_started' | 'contacted' | 'quoted' | 'booked';
  suggestedQuestions: string[];
}

export interface EventPlan {
  id: string;
  version: number; // Monotonic counter for optimistic concurrency
  title: string;
  eventType: string; // e.g., 'birthday', 'wedding', 'anniversary'
  eventDate: string | null; // ISO 8601 (YYYY-MM-DD)
  guestCount: number;
  currency: string; // ISO 4217, default "USD"
  totalCap: number; // Budget ceiling in cents
  items: BudgetItem[];
  milestones: Milestone[];
  vendors: VendorChecklistItem[];
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

// DETERMINISTIC DERIVED STATE (NEVER STORED, ALWAYS COMPUTED)
export interface EventPlanCalculations {
  projectedTotal: number;
  committedTotal: number;
  actualTotal: number;
  remainingBudget: number;
  isOverBudget: boolean;
  variancePercentage: number;
  timelineProgress: number; // 0 to 100%
}
