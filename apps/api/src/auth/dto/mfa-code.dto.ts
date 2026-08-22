import { IsString, MaxLength, MinLength } from 'class-validator';

export class MfaCodeDto {
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  code!: string;
}
