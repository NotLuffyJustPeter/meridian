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
import { MONEY_PATTERN } from './create-expense.dto';

export class UpdateExpenseDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(EXPENSE_CATEGORIES)
  category?: ExpenseCategoryValue;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(MONEY_PATTERN, {
    message: 'amount must use up to 12 integer digits and 2 decimal places',
  })
  amount?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  spentAt?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
