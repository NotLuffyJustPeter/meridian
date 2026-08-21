import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { ACTIVITY_CATEGORIES, type ActivityCategoryValue } from './create-activity.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateActivityDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(ACTIVITY_CATEGORIES)
  category?: ActivityCategoryValue;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'startTime must use HH:mm format',
  })
  startTime?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'endTime must use HH:mm format',
  })
  endTime?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(200)
  location?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  position?: number;
}
