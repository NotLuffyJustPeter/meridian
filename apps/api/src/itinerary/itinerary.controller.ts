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
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ReorderActivitiesDto } from './dto/reorder-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ItineraryService } from './itinerary.service';

@Controller('trips/:tripId/itinerary')
@UseGuards(AccessTokenGuard)
export class ItineraryController {
  constructor(
    private readonly itineraryService: ItineraryService,
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

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
  async createActivity(
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
    const activity = await this.itineraryService.createActivity(user.sub, tripId, dayId, dto);

    this.realtimePublisher.publishItineraryChanged({
      tripId,
      dayId,
      type: 'created',
      activityId: activity.id,
    });

    return activity;
  }

  @Patch('days/:dayId/activities/reorder')
  async reorderActivities(
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
    dto: ReorderActivitiesDto,
  ) {
    const activities = await this.itineraryService.reorderActivities(
      user.sub,
      tripId,
      dayId,
      dto.activityIds,
    );

    this.realtimePublisher.publishItineraryChanged({
      tripId,
      dayId,
      type: 'reordered',
    });

    return activities;
  }

  @Patch('days/:dayId/activities/:activityId')
  async updateActivity(
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
    const activity = await this.itineraryService.updateActivity(
      user.sub,
      tripId,
      dayId,
      activityId,
      dto,
    );

    this.realtimePublisher.publishItineraryChanged({
      tripId,
      dayId,
      type: 'updated',
      activityId,
    });

    return activity;
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

    this.realtimePublisher.publishItineraryChanged({
      tripId,
      dayId,
      type: 'deleted',
      activityId,
    });
  }
}
