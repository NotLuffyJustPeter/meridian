import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CACHE_TTL_DEFAULTS } from '../../cache/cache.constants';
import { CacheService } from '../../cache/cache.service';
import type { WeatherProvider } from '../weather.provider';
import type { ProviderForecast, WeatherLocation } from '../weather.types';
import { OpenMeteoWeatherProvider } from './open-meteo-weather.provider';

@Injectable()
export class CachedWeatherProvider implements WeatherProvider {
  constructor(
    private readonly source: OpenMeteoWeatherProvider,

    private readonly cache: CacheService,

    private readonly configService: ConfigService,
  ) {}

  async resolveLocation(query: string): Promise<WeatherLocation | null> {
    const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();

    return this.cache.remember(
      'weather.location',

      {
        query: normalized,
      },

      this.ttl('CACHE_WEATHER_LOCATION_TTL_SECONDS', CACHE_TTL_DEFAULTS.weatherLocationSeconds),

      () => this.source.resolveLocation(query),
    );
  }

  async getForecast(location: WeatherLocation, timezone: string): Promise<ProviderForecast> {
    return this.cache.remember(
      'weather.forecast',

      {
        latitude: location.latitude.toFixed(6),

        longitude: location.longitude.toFixed(6),

        timezone,
      },

      this.ttl('CACHE_WEATHER_FORECAST_TTL_SECONDS', CACHE_TTL_DEFAULTS.weatherForecastSeconds),

      () => this.source.getForecast(location, timezone),
    );
  }

  private ttl(key: string, fallback: number): number {
    const configured = this.configService.get<string | number>(key);

    if (configured === undefined) {
      return fallback;
    }

    return Number(configured);
  }
}
