import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { EXPENSE_CATEGORIES, type ExpenseCategoryValue } from '../../common/expense-categories';

export const MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(EXPENSE_CATEGORIES)
  category?: ExpenseCategoryValue;

  @IsString()
  @Matches(MONEY_PATTERN, {
    message: 'amount must use up to 12 integer digits and 2 decimal places',
  })
  amount!: string;

  @IsDateString()
  spentAt!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
