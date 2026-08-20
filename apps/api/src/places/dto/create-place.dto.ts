import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const PLACE_CATEGORIES = [
  'LANDMARK',
  'FOOD',
  'LODGING',
  'SHOPPING',
  'TRANSPORT',
  'ENTERTAINMENT',
  'NATURE',
  'OTHER',
] as const;

export type PlaceCategoryValue = (typeof PLACE_CATEGORIES)[number];

export class CreatePlaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(PLACE_CATEGORIES)
  category?: PlaceCategoryValue;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsNumber()
  latitude?: number | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsNumber()
  longitude?: number | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MaxLength(500)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  website?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(80)
  sourceProvider?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(300)
  sourcePlaceId?: string | null;
}
