import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { WeatherProviderUnavailableError } from '../weather.provider';
import type { WeatherLocation } from '../weather.types';
import { OpenMeteoWeatherProvider } from './open-meteo-weather.provider';

function readFetchUrl(input: Parameters<typeof fetch>[0] | undefined): URL {
  if (!input) {
    throw new Error('Expected fetch to be called');
  }

  if (typeof input === 'string') {
    return new URL(input);
  }

  if (input instanceof URL) {
    return input;
  }

  return new URL(input.url);
}

describe('OpenMeteoWeatherProvider', () => {
  let provider: OpenMeteoWeatherProvider;

  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    provider = new OpenMeteoWeatherProvider();

    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('resolves a destination with the Open-Meteo geocoding API', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              name: 'Milan',
              country: 'Italy',
              latitude: 45.46427,
              longitude: 9.18951,
              timezone: 'Europe/Rome',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const result = await provider.resolveLocation('Milan, Italy');

    expect(result).toEqual({
      name: 'Milan',
      country: 'Italy',
      latitude: 45.46427,
      longitude: 9.18951,
    });

    const firstCall = fetchSpy.mock.calls[0];

    expect(firstCall).toBeDefined();

    const url = readFetchUrl(firstCall?.[0]);

    expect(url.hostname).toBe('geocoding-api.open-meteo.com');

    expect(url.searchParams.get('name')).toBe('Milan, Italy');

    expect(url.searchParams.get('count')).toBe('1');
  });

  it('returns null when geocoding has no matches', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [],
        }),
        {
          status: 200,
        },
      ),
    );

    await expect(provider.resolveLocation('Not A Real Place')).resolves.toBeNull();
  });

  it('requests and normalizes the 16-day daily forecast', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          daily: {
            time: ['2026-08-21'],
            weather_code: [2],
            temperature_2m_max: [27.4],
            temperature_2m_min: [18.1],
            precipitation_probability_max: [22],
            precipitation_sum: [0.8],
            wind_speed_10m_max: [17.5],
            sunrise: ['2026-08-21T06:25'],
            sunset: ['2026-08-21T20:20'],
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    const location: WeatherLocation = {
      name: 'Milan',
      country: 'Italy',
      latitude: 45.46427,
      longitude: 9.18951,
    };

    const result = await provider.getForecast(location, 'Europe/Rome');

    expect(result.days[0]).toEqual({
      date: '2026-08-21',
      weatherCode: 2,
      temperatureMaxC: 27.4,
      temperatureMinC: 18.1,
      precipitationProbabilityMax: 22,
      precipitationMm: 0.8,
      windSpeedMaxKmh: 17.5,
      sunrise: '2026-08-21T06:25',
      sunset: '2026-08-21T20:20',
    });

    const firstCall = fetchSpy.mock.calls[0];

    expect(firstCall).toBeDefined();

    const url = readFetchUrl(firstCall?.[0]);

    expect(url.hostname).toBe('api.open-meteo.com');

    expect(url.searchParams.get('forecast_days')).toBe('16');

    expect(url.searchParams.get('timezone')).toBe('Europe/Rome');

    expect(url.searchParams.get('daily')).toContain('wind_speed_10m_max');
  });

  it('throws a provider error for upstream HTTP failures', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Service unavailable', {
        status: 503,
      }),
    );

    await expect(provider.resolveLocation('Milan, Italy')).rejects.toBeInstanceOf(
      WeatherProviderUnavailableError,
    );
  });
});
