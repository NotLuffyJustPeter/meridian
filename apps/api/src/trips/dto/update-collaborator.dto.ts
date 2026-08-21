import { IsIn } from 'class-validator';

import type { TripMemberRoleInput } from './add-collaborator.dto';

export class UpdateCollaboratorDto {
  @IsIn(['EDITOR', 'VIEWER'])
  role!: TripMemberRoleInput;
}
