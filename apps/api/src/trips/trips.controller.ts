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
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(AccessTokenGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AccessTokenPayload) {
    return this.tripsService.findAllAccessible(user.sub);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AccessTokenPayload,
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
  ) {
    return this.tripsService.findAccessibleTripOrThrow(user.sub, tripId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.update(user.sub, tripId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
  ): Promise<void> {
    await this.tripsService.remove(user.sub, tripId);
  }
}
