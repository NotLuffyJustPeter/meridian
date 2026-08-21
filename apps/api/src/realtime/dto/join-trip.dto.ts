import { IsUUID } from 'class-validator';

export class JoinTripDto {
  @IsUUID('4')
  tripId!: string;
}
