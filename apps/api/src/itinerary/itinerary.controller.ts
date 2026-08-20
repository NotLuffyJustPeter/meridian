import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import type { AccessTokenPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
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
}
