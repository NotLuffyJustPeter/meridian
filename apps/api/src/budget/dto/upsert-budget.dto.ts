import { IsString, Matches } from 'class-validator';

export const BUDGET_MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class UpsertBudgetDto {
  @IsString()
  @Matches(BUDGET_MONEY_PATTERN, {
    message: 'totalAmount must use up to 12 integer digits and 2 decimal places',
  })
  totalAmount!: string;
}
