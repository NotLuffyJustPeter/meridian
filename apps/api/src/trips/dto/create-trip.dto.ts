import { IsDateString, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  destination!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  timezone!: string;

  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'currency must be a 3-letter currency code',
  })
  currency!: string;
}
