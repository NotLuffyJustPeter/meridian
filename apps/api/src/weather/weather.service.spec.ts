import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TripsService } from '../trips/trips.service';
import type { WeatherProvider } from './weather.provider';
import { WeatherProviderUnavailableError } from './weather.provider';
import { WeatherService } from './weather.service';
import type { ProviderForecast, WeatherLocation } from './weather.types';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';

const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';

const trip = {
  id: TRIP_ID,
  destination: 'Milan, Italy',
  startDate: new Date('2026-08-21T00:00:00.000Z'),
  endDate: new Date('2026-08-23T00:00:00.000Z'),
  timezone: 'Europe/Rome',
};

const location: WeatherLocation = {
  name: 'Milan',
  country: 'Italy',
  latitude: 45.46427,
  longitude: 9.18951,
};

const forecast: ProviderForecast = {
  days: [
    {
      date: '2026-08-21',
      weatherCode: 1,
      temperatureMaxC: 28.4,
      temperatureMinC: 18.2,
      precipitationProbabilityMax: 10,
      precipitationMm: 0,
      windSpeedMaxKmh: 15.1,
      sunrise: '2026-08-21T06:25',
      sunset: '2026-08-21T20:20',
    },
    {
      date: '2026-08-22',
      weatherCode: 61,
      temperatureMaxC: 24.2,
      temperatureMinC: 17.9,
      precipitationProbabilityMax: 72,
      precipitationMm: 5.4,
      windSpeedMaxKmh: 21.3,
      sunrise: '2026-08-22T06:26',
      sunset: '2026-08-22T20:18',
    },
    {
      date: '2026-08-23',
      weatherCode: 2,
      temperatureMaxC: 26,
      temperatureMinC: 18,
      precipitationProbabilityMax: 20,
      precipitationMm: 0.4,
      windSpeedMaxKmh: 16,
      sunrise: '2026-08-23T06:27',
      sunset: '2026-08-23T20:16',
    },
  ],
};

type FindAccessibleTripMock = (ownerId: string, tripId: string) => Promise<typeof trip>;

type ResolveLocationMock = (query: string) => Promise<WeatherLocation | null>;

type GetForecastMock = (location: WeatherLocation, timezone: string) => Promise<ProviderForecast>;

describe('WeatherService', () => {
  let service: WeatherService;

  let findAccessibleTripOrThrow: jest.Mock<FindAccessibleTripMock>;

  let resolveLocation: jest.Mock<ResolveLocationMock>;

  let getForecast: jest.Mock<GetForecastMock>;

  beforeEach(() => {
    findAccessibleTripOrThrow = jest.fn<FindAccessibleTripMock>();

    resolveLocation = jest.fn<ResolveLocationMock>();

    getForecast = jest.fn<GetForecastMock>();

    findAccessibleTripOrThrow.mockResolvedValue(trip);

    resolveLocation.mockResolvedValue(location);

    getForecast.mockResolvedValue(forecast);

    const tripsService = {
      findAccessibleTripOrThrow,
    } as unknown as TripsService;

    const weatherProvider = {
      resolveLocation,
      getForecast,
    } satisfies WeatherProvider;

    service = new WeatherService(tripsService, weatherProvider);
  });

  it('returns normalized weather for every trip day', async () => {
    const result = await service.getTripWeather(OWNER_ID, TRIP_ID);

    expect(findAccessibleTripOrThrow).toHaveBeenCalledWith(OWNER_ID, TRIP_ID);

    expect(resolveLocation).toHaveBeenCalledWith('Milan, Italy');

    expect(getForecast).toHaveBeenCalledWith(location, 'Europe/Rome');

    expect(result.availability).toBe('AVAILABLE');

    expect(result.days).toHaveLength(3);

    expect(result.days[0]).toMatchObject({
      date: '2026-08-21',
      available: true,
      condition: 'MOSTLY_CLEAR',
      temperatureMaxC: 28.4,
    });

    expect(result.days[1]?.condition).toBe('RAIN');
  });

  it('returns PARTIAL when only some trip dates are in the provider window', async () => {
    getForecast.mockResolvedValue({
      days: [forecast.days[0]],
    });

    const result = await service.getTripWeather(OWNER_ID, TRIP_ID);

    expect(result.availability).toBe('PARTIAL');

    expect(result.days.map((day) => day.available)).toEqual([true, false, false]);
  });

  it('returns OUT_OF_RANGE instead of failing for a trip outside the forecast horizon', async () => {
    getForecast.mockResolvedValue({
      days: [
        {
          ...forecast.days[0],
          date: '2026-09-01',
        },
      ],
    });

    const result = await service.getTripWeather(OWNER_ID, TRIP_ID);

    expect(result.availability).toBe('OUT_OF_RANGE');

    expect(result.days.every((day) => !day.available)).toBe(true);
  });

  it('returns LOCATION_NOT_FOUND when the destination cannot be geocoded', async () => {
    resolveLocation.mockResolvedValue(null);

    const result = await service.getTripWeather(OWNER_ID, TRIP_ID);

    expect(result.availability).toBe('LOCATION_NOT_FOUND');

    expect(result.location).toBeNull();

    expect(getForecast).not.toHaveBeenCalled();
  });

  it('preserves trip access isolation before calling the external provider', async () => {
    findAccessibleTripOrThrow.mockRejectedValue(new NotFoundException('Trip not found'));

    await expect(service.getTripWeather(OWNER_ID, TRIP_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(resolveLocation).not.toHaveBeenCalled();

    expect(getForecast).not.toHaveBeenCalled();
  });

  it('maps provider outages to a service unavailable response', async () => {
    resolveLocation.mockRejectedValue(new WeatherProviderUnavailableError());

    await expect(service.getTripWeather(OWNER_ID, TRIP_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
