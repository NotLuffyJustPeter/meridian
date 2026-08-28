import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';
import { TripsModule } from '../trips/trips.module';
import { CachedWeatherProvider } from './providers/cached-weather.provider';
import { OpenMeteoWeatherProvider } from './providers/open-meteo-weather.provider';
import { WEATHER_PROVIDER } from './weather.provider';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';

@Module({
  imports: [AuthModule, CacheModule, TripsModule],

  controllers: [WeatherController],

  providers: [
    WeatherService,

    OpenMeteoWeatherProvider,

    CachedWeatherProvider,

    {
      provide: WEATHER_PROVIDER,

      useExisting: CachedWeatherProvider,
    },
  ],

  exports: [WeatherService],
})
export class WeatherModule {}
