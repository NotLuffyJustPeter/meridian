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
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ItineraryService } from './itinerary.service';

@Controller('trips/:tripId/itinerary')
@UseGuards(AccessTokenGuard)
export class ItineraryController {
  constructor(private readonly itineraryService: ItineraryService) {}

  @Get()
  getItinerary(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
  ) {
    return this.itineraryService.getOrCreateItinerary(user.sub, tripId);
  }

  @Post('days/:dayId/activities')
  createActivity(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,

    @Param(
      'dayId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    dayId: string,

    @Body()
    dto: CreateActivityDto,
  ) {
    return this.itineraryService.createActivity(user.sub, tripId, dayId, dto);
  }

  @Patch('days/:dayId/activities/:activityId')
  updateActivity(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,

    @Param(
      'dayId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    dayId: string,

    @Param(
      'activityId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    activityId: string,

    @Body()
    dto: UpdateActivityDto,
  ) {
    return this.itineraryService.updateActivity(user.sub, tripId, dayId, activityId, dto);
  }

  @Delete('days/:dayId/activities/:activityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeActivity(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,

    @Param(
      'dayId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    dayId: string,

    @Param(
      'activityId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    activityId: string,
  ): Promise<void> {
    await this.itineraryService.removeActivity(user.sub, tripId, dayId, activityId);
  }
}
