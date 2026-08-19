import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(AccessTokenGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(
    @CurrentUser()
    user: AccessTokenPayload,
    @Body()
    dto: CreateTripDto,
  ) {
    return this.tripsService.create(user.sub, dto);
  }

  @Get()
  findAll(
    @CurrentUser()
    user: AccessTokenPayload,
  ) {
    return this.tripsService.findAllOwned(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser()
    user: AccessTokenPayload,
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
  ) {
    return this.tripsService.findOwnedTripOrThrow(user.sub, tripId);
  }

  @Patch(':id')
  update(
    @CurrentUser()
    user: AccessTokenPayload,
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
    @Body()
    dto: UpdateTripDto,
  ) {
    return this.tripsService.update(user.sub, tripId, dto);
  }
}
