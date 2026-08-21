import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const AI_PACES = ['RELAXED', 'BALANCED', 'FULL'] as const;

export type AiPace = (typeof AI_PACES)[number];

export const AI_INTERESTS = [
  'CULTURE',
  'FOOD',
  'ARCHITECTURE',
  'HISTORY',
  'NATURE',
  'SHOPPING',
  'NIGHTLIFE',
  'LOCAL_EXPERIENCES',
] as const;

export type AiInterest = (typeof AI_INTERESTS)[number];

export const AI_BUDGET_PREFERENCES = ['ECONOMY', 'BALANCED', 'COMFORT'] as const;

export type AiBudgetPreference = (typeof AI_BUDGET_PREFERENCES)[number];

export class GenerateRecommendationsDto {
  @IsIn(AI_PACES)
  pace: AiPace = 'BALANCED';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(AI_INTERESTS.length)
  @ArrayUnique()
  @IsIn(AI_INTERESTS, {
    each: true,
  })
  interests: AiInterest[] = ['CULTURE', 'FOOD'];

  @IsIn(AI_BUDGET_PREFERENCES)
  budgetPreference: AiBudgetPreference = 'BALANCED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
