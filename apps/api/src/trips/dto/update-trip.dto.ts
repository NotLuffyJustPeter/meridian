import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const TRIP_STATUSES = ['DRAFT', 'PLANNED', 'ARCHIVED'] as const;

export type TripStatusValue = (typeof TRIP_STATUSES)[number];

export class UpdateTripDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  destination?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  startDate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString()
  endDate?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  timezone?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'currency must be a 3-letter currency code',
  })
  currency?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(TRIP_STATUSES)
  status?: TripStatusValue;
}
