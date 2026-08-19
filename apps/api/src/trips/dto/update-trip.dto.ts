import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const TRIP_STATUSES = ['DRAFT', 'PLANNED', 'ARCHIVED'] as const;

export type TripStatusValue = (typeof TRIP_STATUSES)[number];

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  destination?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'currency must be a 3-letter currency code',
  })
  currency?: string;

  @IsOptional()
  @IsIn(TRIP_STATUSES)
  status?: TripStatusValue;
}
