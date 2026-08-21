export const EXPENSE_CATEGORIES = [
  'ACCOMMODATION',
  'FOOD',
  'TRANSPORT',
  'ACTIVITIES',
  'SHOPPING',
  'HEALTH',
  'OTHER',
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: string): value is ExpenseCategoryValue {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}
