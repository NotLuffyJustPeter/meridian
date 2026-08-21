import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AccessTokenPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CollaboratorsService } from './collaborators.service';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';

@Controller('trips/:tripId/collaborators')
@UseGuards(AccessTokenGuard)
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
  ) {
    return this.collaboratorsService.findAll(user.sub, tripId);
  }

  @Post()
  add(
    @CurrentUser() user: AccessTokenPayload,
    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.collaboratorsService.add(user.sub, tripId, dto);
  }

  @Patch(':memberId')
  updateRole(
    @CurrentUser() user: AccessTokenPayload,
    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
    @Param(
      'memberId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    memberId: string,
    @Body() dto: UpdateCollaboratorDto,
  ) {
    return this.collaboratorsService.updateRole(user.sub, tripId, memberId, dto);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
    @Param(
      'memberId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    memberId: string,
  ): Promise<void> {
    await this.collaboratorsService.remove(user.sub, tripId, memberId);
  }
}
