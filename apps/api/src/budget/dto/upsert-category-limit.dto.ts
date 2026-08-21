import { IsString, Matches } from 'class-validator';

export const CATEGORY_LIMIT_MONEY_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class UpsertCategoryLimitDto {
  @IsString()
  @Matches(CATEGORY_LIMIT_MONEY_PATTERN, {
    message: 'amount must use up to 12 integer digits and 2 decimal places',
  })
  amount!: string;
}
