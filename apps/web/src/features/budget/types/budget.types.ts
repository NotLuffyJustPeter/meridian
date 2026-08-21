export const EXPENSE_CATEGORIES = [
  'ACCOMMODATION',
  'FOOD',
  'TRANSPORT',
  'ACTIVITIES',
  'SHOPPING',
  'HEALTH',
  'OTHER',
] as const;

export type ExpenseCategory =
  (typeof EXPENSE_CATEGORIES)[number];

export interface BudgetRecord {
  id: string;
  tripId: string;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetResponse {
  tripId: string;
  currency: string;
  configured: boolean;
  budget: BudgetRecord | null;
}

export interface BudgetCategoryLimit {
  id: string;
  budgetId: string;
  category: ExpenseCategory;
  amount: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategoryLimitsResponse {
  tripId: string;
  currency: string;
  configured: boolean;
  categoryLimits: BudgetCategoryLimit[];
}

export interface BudgetOverviewCategory {
  category: ExpenseCategory;
  spentAmount: string;
  expensesCount: number;
  limitAmount: string | null;
  remainingAmount: string | null;
  usagePercentage: number | null;
}

export interface BudgetOverview {
  tripId: string;
  currency: string;
  configured: boolean;
  budget: BudgetRecord | null;
  totals: {
    budgetAmount: string | null;
    spentAmount: string;
    remainingAmount: string | null;
    usagePercentage: number | null;
    expensesCount: number;
  };
  categories: BudgetOverviewCategory[];
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  category: ExpenseCategory;
  amount: string;
  spentAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBudgetInput {
  totalAmount: string;
}

export interface UpsertCategoryLimitInput {
  amount: string;
}

export interface CreateExpenseInput {
  title: string;
  category?: ExpenseCategory;
  amount: string;
  spentAt: string;
  notes?: string | null;
}

export interface UpdateExpenseInput {
  title?: string;
  category?: ExpenseCategory;
  amount?: string;
  spentAt?: string;
  notes?: string | null;
}
