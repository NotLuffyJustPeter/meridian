import { IsEmail, IsIn } from 'class-validator';

export type TripMemberRoleInput = 'EDITOR' | 'VIEWER';

export class AddCollaboratorDto {
  @IsEmail()
  email!: string;

  @IsIn(['EDITOR', 'VIEWER'])
  role!: TripMemberRoleInput;
}
