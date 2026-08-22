import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../../database/prisma.service';
import { TripsService } from '../../trips/trips.service';
import { WeatherService } from '../../weather/weather.service';
import { JourneyContextService } from './journey-context.service';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';

const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';

const decimal = (value: string) => ({
  toFixed: () => value,
});

type FindEditableMock = (
  ownerId: string,
  tripId: string,
) => Promise<{
  id: string;
}>;

type TripQueryMock = (args: unknown) => Promise<unknown>;

type WeatherMock = (
  ownerId: string,
  tripId: string,
) => Promise<{
  availability: 'AVAILABLE';
  days: Array<{
    date: string;
    available: boolean;
    condition: 'CLEAR';
    temperatureMaxC: number;
    temperatureMinC: number;
    precipitationProbabilityMax: number;
    precipitationMm: number;
    windSpeedMaxKmh: number;
  }>;
}>;

describe('JourneyContextService', () => {
  let service: JourneyContextService;

  let findEditable: jest.Mock<FindEditableMock>;

  let findUnique: jest.Mock<TripQueryMock>;

  let getWeather: jest.Mock<WeatherMock>;

  beforeEach(() => {
    findEditable = jest.fn<FindEditableMock>();

    findUnique = jest.fn<TripQueryMock>();

    getWeather = jest.fn<WeatherMock>();

    findEditable.mockResolvedValue({
      id: TRIP_ID,
    });

    findUnique.mockResolvedValue({
      id: TRIP_ID,
      name: 'Milan Weekend',
      destination: 'Milan, Italy',
      startDate: new Date('2026-08-21T00:00:00.000Z'),
      endDate: new Date('2026-08-23T00:00:00.000Z'),
      timezone: 'Europe/Rome',
      currency: 'EUR',
      status: 'PLANNED',
      days: [
        {
          id: 'day-1',
          date: new Date('2026-08-21T00:00:00.000Z'),
          dayNumber: 1,
          notes: null,
          activities: [
            {
              id: 'activity-1',
              title: 'Duomo',
              description: null,
              category: 'SIGHTSEEING',
              startTime: '09:00',
              endTime: '11:00',
              location: 'Duomo di Milano',
              notes: null,
              position: 0,
            },
          ],
        },
      ],
      places: [
        {
          id: 'place-1',
          name: 'Brera',
          category: 'LANDMARK',
          address: 'Brera, Milan',
          latitude: 45.472,
          longitude: 9.188,
          notes: null,
          website: null,
          createdAt: new Date(),
        },
      ],
      budget: {
        totalAmount: decimal('500.00'),
        categoryLimits: [
          {
            category: 'FOOD',
            amount: decimal('150.00'),
          },
        ],
      },
      expenses: [
        {
          category: 'FOOD',
          amount: decimal('20.50'),
        },
        {
          category: 'TRANSPORT',
          amount: decimal('12.00'),
        },
      ],
    });

    getWeather.mockResolvedValue({
      availability: 'AVAILABLE',
      days: [
        {
          date: '2026-08-21',
          available: true,
          condition: 'CLEAR',
          temperatureMaxC: 28,
          temperatureMinC: 18,
          precipitationProbabilityMax: 5,
          precipitationMm: 0,
          windSpeedMaxKmh: 12,
        },
      ],
    });

    const prisma = {
      trip: {
        findUnique,
      },
    } as unknown as PrismaService;

    const tripsService = {
      findEditableTripOrThrow: findEditable,
    } as unknown as TripsService;

    const weatherService = {
      getTripWeather: getWeather,
    } as unknown as WeatherService;

    service = new JourneyContextService(prisma, tripsService, weatherService);
  });

  it('builds a normalized journey context from trip relations', async () => {
    const result = await service.build(OWNER_ID, TRIP_ID);

    expect(findEditable).toHaveBeenCalledWith(OWNER_ID, TRIP_ID);

    expect(result.trip.travelDates).toEqual(['2026-08-21', '2026-08-22', '2026-08-23']);

    expect(result.itinerary[0]?.activities[0]?.title).toBe('Duomo');

    expect(result.savedPlaces[0]?.name).toBe('Brera');

    expect(result.budget).toMatchObject({
      configured: true,
      totalAmount: '500.00',
      totalSpent: '32.50',
      remainingAmount: '467.50',
    });

    const food = result.budget.categories.find((item) => item.category === 'FOOD');

    expect(food).toMatchObject({
      limitAmount: '150.00',
      spentAmount: '20.50',
    });

    expect(result.weather.availability).toBe('AVAILABLE');
  });

  it('continues without weather when the weather provider is unavailable', async () => {
    getWeather.mockRejectedValue(new ServiceUnavailableException('weather down'));

    const result = await service.build(OWNER_ID, TRIP_ID);

    expect(result.weather).toEqual({
      availability: 'UNAVAILABLE',
      days: [],
    });
  });
});
