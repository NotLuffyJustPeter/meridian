import { IsString, MaxLength, MinLength } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  challengeToken!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  code!: string;
}
