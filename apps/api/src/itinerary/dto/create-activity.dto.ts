import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const ACTIVITY_CATEGORIES = [
  'SIGHTSEEING',
  'FOOD',
  'TRANSPORT',
  'LODGING',
  'SHOPPING',
  'ENTERTAINMENT',
  'OTHER',
] as const;

export type ActivityCategoryValue = (typeof ACTIVITY_CATEGORIES)[number];

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsIn(ACTIVITY_CATEGORIES)
  category?: ActivityCategoryValue;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'startTime must use HH:mm format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'endTime must use HH:mm format',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsUUID('4')
  placeId?: string;
}
