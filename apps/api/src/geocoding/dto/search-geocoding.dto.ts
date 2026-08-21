import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchGeocodingDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(160)
  q!: string;
}
