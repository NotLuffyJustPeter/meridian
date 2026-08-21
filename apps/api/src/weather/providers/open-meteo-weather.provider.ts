import { Injectable } from '@nestjs/common';

import type { WeatherProvider } from '../weather.provider';
import { WeatherProviderUnavailableError } from '../weather.provider';
import type { ProviderForecast, ProviderForecastDay, WeatherLocation } from '../weather.types';

const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

const FORECAST_DAYS = '16';

const DAILY_VARIABLES = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_speed_10m_max',
  'sunrise',
  'sunset',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function arrayValue(record: Record<string, unknown>, key: string, index: number): unknown {
  const value = record[key];

  return Array.isArray(value) ? value[index] : undefined;
}

@Injectable()
export class OpenMeteoWeatherProvider implements WeatherProvider {
  async resolveLocation(query: string): Promise<WeatherLocation | null> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return null;
    }

    const url = new URL(GEOCODING_ENDPOINT);

    url.searchParams.set('name', normalizedQuery);
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    const payload = await this.fetchJson(url);

    if (!isRecord(payload)) {
      throw new WeatherProviderUnavailableError(
        'Open-Meteo returned an invalid geocoding response',
      );
    }

    const results = payload['results'];

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const firstResult = results.find(isRecord);

    if (!firstResult) {
      throw new WeatherProviderUnavailableError('Open-Meteo returned an invalid location');
    }

    const name = asString(firstResult['name']);

    const latitude = asFiniteNumber(firstResult['latitude']);

    const longitude = asFiniteNumber(firstResult['longitude']);

    if (!name || latitude === null || longitude === null) {
      throw new WeatherProviderUnavailableError('Open-Meteo returned incomplete location data');
    }

    return {
      name,
      country: asString(firstResult['country']),
      latitude,
      longitude,
    };
  }

  async getForecast(location: WeatherLocation, timezone: string): Promise<ProviderForecast> {
    const url = new URL(FORECAST_ENDPOINT);

    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set('daily', DAILY_VARIABLES.join(','));
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('forecast_days', FORECAST_DAYS);
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('precipitation_unit', 'mm');
    url.searchParams.set('timeformat', 'iso8601');

    const payload = await this.fetchJson(url);

    if (!isRecord(payload)) {
      throw new WeatherProviderUnavailableError('Open-Meteo returned an invalid forecast response');
    }

    const daily = payload['daily'];

    if (!isRecord(daily)) {
      throw new WeatherProviderUnavailableError('Open-Meteo forecast did not include daily data');
    }

    const time = daily['time'];

    if (!Array.isArray(time)) {
      throw new WeatherProviderUnavailableError('Open-Meteo forecast did not include daily dates');
    }

    const days: ProviderForecastDay[] = time.flatMap((rawDate, index) => {
      const date = asString(rawDate);

      if (!date) {
        return [];
      }

      return [
        {
          date,
          weatherCode: asFiniteNumber(arrayValue(daily, 'weather_code', index)),
          temperatureMaxC: asFiniteNumber(arrayValue(daily, 'temperature_2m_max', index)),
          temperatureMinC: asFiniteNumber(arrayValue(daily, 'temperature_2m_min', index)),
          precipitationProbabilityMax: asFiniteNumber(
            arrayValue(daily, 'precipitation_probability_max', index),
          ),
          precipitationMm: asFiniteNumber(arrayValue(daily, 'precipitation_sum', index)),
          windSpeedMaxKmh: asFiniteNumber(arrayValue(daily, 'wind_speed_10m_max', index)),
          sunrise: asString(arrayValue(daily, 'sunrise', index)),
          sunset: asString(arrayValue(daily, 'sunset', index)),
        },
      ];
    });

    if (days.length === 0) {
      throw new WeatherProviderUnavailableError('Open-Meteo returned an empty forecast');
    }

    return {
      days,
    };
  }

  private async fetchJson(url: URL): Promise<unknown> {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new WeatherProviderUnavailableError(
          `Open-Meteo request failed with status ${response.status}`,
        );
      }

      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof WeatherProviderUnavailableError) {
        throw error;
      }

      throw new WeatherProviderUnavailableError('Unable to reach Open-Meteo');
    }
  }
}
