import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TripsModule } from '../trips/trips.module';
import { OpenMeteoWeatherProvider } from './providers/open-meteo-weather.provider';
import { WEATHER_PROVIDER } from './weather.provider';
import { WeatherController } from './weather.controller';
import { WeatherService } from './weather.service';

@Module({
  imports: [AuthModule, TripsModule],
  controllers: [WeatherController],
  providers: [
    WeatherService,
    {
      provide: WEATHER_PROVIDER,
      useClass: OpenMeteoWeatherProvider,
    },
  ],
  exports: [WeatherService],
})
export class WeatherModule {}
