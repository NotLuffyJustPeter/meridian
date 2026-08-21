import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import type { AccessTokenPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { WeatherService } from './weather.service';

@Controller('trips/:tripId/weather')
@UseGuards(AccessTokenGuard)
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  getTripWeather(
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
    return this.weatherService.getTripWeather(user.sub, tripId);
  }
}
