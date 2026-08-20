import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from './trips.service';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';

const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';

const baseTrip = {
  id: TRIP_ID,
  ownerId: OWNER_ID,
  name: 'Northern Italy',
  destination: 'Milan, Italy',
  startDate: new Date('2026-10-10T00:00:00.000Z'),
  endDate: new Date('2026-10-18T00:00:00.000Z'),
  timezone: 'Europe/Rome',
  currency: 'EUR',
  status: 'DRAFT',
  createdAt: new Date('2026-08-19T22:55:38.404Z'),
  updatedAt: new Date('2026-08-19T22:55:38.404Z'),
};

type TripRecord = typeof baseTrip;

type MutationResult = {
  count: number;
};

type TripCreateMock = (args: unknown) => Promise<TripRecord>;

type TripFindManyMock = (args: unknown) => Promise<TripRecord[]>;

type TripFindFirstMock = (args: unknown) => Promise<TripRecord | null>;

type MutationMock = (args: unknown) => Promise<MutationResult>;

type ActivityCountMock = (args: unknown) => Promise<number>;

interface TransactionClientMock {
  activity: {
    count: jest.Mock<ActivityCountMock>;
  };

  tripDay: {
    deleteMany: jest.Mock<MutationMock>;
  };

  trip: {
    updateMany: jest.Mock<MutationMock>;

    findFirst: jest.Mock<TripFindFirstMock>;
  };
}

describe('TripsService', () => {
  let service: TripsService;

  let tripCreate: jest.Mock<TripCreateMock>;

  let tripFindMany: jest.Mock<TripFindManyMock>;

  let tripFindFirst: jest.Mock<TripFindFirstMock>;

  let tripUpdateMany: jest.Mock<MutationMock>;

  let tripDeleteMany: jest.Mock<MutationMock>;

  let activityCount: jest.Mock<ActivityCountMock>;

  let tripDayDeleteMany: jest.Mock<MutationMock>;

  let transactionTripUpdateMany: jest.Mock<MutationMock>;

  let transactionTripFindFirst: jest.Mock<TripFindFirstMock>;

  beforeEach(() => {
    tripCreate = jest.fn<TripCreateMock>();

    tripFindMany = jest.fn<TripFindManyMock>();

    tripFindFirst = jest.fn<TripFindFirstMock>();

    tripUpdateMany = jest.fn<MutationMock>();

    tripDeleteMany = jest.fn<MutationMock>();

    activityCount = jest.fn<ActivityCountMock>();

    tripDayDeleteMany = jest.fn<MutationMock>();

    transactionTripUpdateMany = jest.fn<MutationMock>();

    transactionTripFindFirst = jest.fn<TripFindFirstMock>();

    const transactionClient: TransactionClientMock = {
      activity: {
        count: activityCount,
      },

      tripDay: {
        deleteMany: tripDayDeleteMany,
      },

      trip: {
        updateMany: transactionTripUpdateMany,

        findFirst: transactionTripFindFirst,
      },
    };

    const prisma = {
      trip: {
        create: tripCreate,

        findMany: tripFindMany,

        findFirst: tripFindFirst,

        updateMany: tripUpdateMany,

        deleteMany: tripDeleteMany,
      },

      $transaction: async (callback: (transaction: TransactionClientMock) => Promise<unknown>) =>
        callback(transactionClient),
    } as unknown as PrismaService;

    service = new TripsService(prisma);
  });

  describe('create', () => {
    it('creates and normalizes a trip', async () => {
      tripCreate.mockResolvedValue({
        ...baseTrip,
        currency: 'EUR',
      });

      const result = await service.create(OWNER_ID, {
        name: '  Northern Italy  ',
        destination: '  Milan, Italy  ',
        startDate: '2026-10-10T00:00:00.000Z',
        endDate: '2026-10-18T00:00:00.000Z',
        timezone: 'Europe/Rome',
        currency: 'eur',
      });

      expect(tripCreate).toHaveBeenCalledWith({
        data: {
          ownerId: OWNER_ID,
          name: 'Northern Italy',
          destination: 'Milan, Italy',
          startDate: new Date('2026-10-10T00:00:00.000Z'),
          endDate: new Date('2026-10-18T00:00:00.000Z'),
          timezone: 'Europe/Rome',
          currency: 'EUR',
        },
      });

      expect(result.currency).toBe('EUR');
    });

    it('rejects an invalid date range', async () => {
      await expect(
        service.create(OWNER_ID, {
          name: 'Broken Trip',
          destination: 'Rome',
          startDate: '2026-10-20T00:00:00.000Z',
          endDate: '2026-10-10T00:00:00.000Z',
          timezone: 'Europe/Rome',
          currency: 'EUR',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid timezone', async () => {
      await expect(
        service.create(OWNER_ID, {
          name: 'Tokyo',
          destination: 'Tokyo',
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-05T00:00:00.000Z',
          timezone: 'Not/A_Timezone',
          currency: 'JPY',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAllOwned', () => {
    it('only queries trips belonging to the owner', async () => {
      tripFindMany.mockResolvedValue([baseTrip]);

      await service.findAllOwned(OWNER_ID);

      expect(tripFindMany).toHaveBeenCalledWith({
        where: {
          ownerId: OWNER_ID,
        },
        orderBy: [
          {
            startDate: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
      });
    });
  });

  describe('findOwnedTripOrThrow', () => {
    it('returns an owned trip', async () => {
      tripFindFirst.mockResolvedValue(baseTrip);

      const result = await service.findOwnedTripOrThrow(OWNER_ID, TRIP_ID);

      expect(result.id).toBe(TRIP_ID);
    });

    it('returns 404 when ownership does not match', async () => {
      tripFindFirst.mockResolvedValue(null);

      await expect(service.findOwnedTripOrThrow(OWNER_ID, TRIP_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates only supplied fields and normalizes values', async () => {
      tripFindFirst.mockResolvedValueOnce(baseTrip).mockResolvedValueOnce({
        ...baseTrip,
        name: 'Northern Italy Escape',
        currency: 'EUR',
        status: 'PLANNED',
      });

      tripUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.update(OWNER_ID, TRIP_ID, {
        name: '  Northern Italy Escape  ',
        currency: 'eur',
        status: 'PLANNED',
      });

      expect(tripUpdateMany).toHaveBeenCalledWith({
        where: {
          id: TRIP_ID,
          ownerId: OWNER_ID,
        },
        data: {
          name: 'Northern Italy Escape',
          currency: 'EUR',
          status: 'PLANNED',
        },
      });

      expect(result.name).toBe('Northern Italy Escape');

      expect(result.currency).toBe('EUR');

      expect(result.status).toBe('PLANNED');
    });

    it('rejects an empty update', async () => {
      await expect(service.update(OWNER_ID, TRIP_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(tripFindFirst).not.toHaveBeenCalled();

      expect(tripUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects an invalid resulting date range', async () => {
      tripFindFirst.mockResolvedValue(baseTrip);

      await expect(
        service.update(OWNER_ID, TRIP_ID, {
          startDate: '2026-10-25T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(tripUpdateMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the trip is not owned', async () => {
      tripFindFirst.mockResolvedValue(null);

      await expect(
        service.update(OWNER_ID, TRIP_ID, {
          name: 'No Access',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(tripUpdateMany).not.toHaveBeenCalled();
    });

    it('removes empty itinerary days when trip dates change', async () => {
      const updatedTrip = {
        ...baseTrip,

        startDate: new Date('2026-10-11T00:00:00.000Z'),

        endDate: new Date('2026-10-15T00:00:00.000Z'),
      };

      tripFindFirst.mockResolvedValue(baseTrip);

      activityCount.mockResolvedValue(0);

      tripDayDeleteMany.mockResolvedValue({
        count: 9,
      });

      transactionTripUpdateMany.mockResolvedValue({
        count: 1,
      });

      transactionTripFindFirst.mockResolvedValue(updatedTrip);

      const result = await service.update(OWNER_ID, TRIP_ID, {
        startDate: '2026-10-11T00:00:00.000Z',

        endDate: '2026-10-15T00:00:00.000Z',
      });

      expect(activityCount).toHaveBeenCalledWith({
        where: {
          tripDay: {
            tripId: TRIP_ID,
          },
        },
      });

      expect(tripDayDeleteMany).toHaveBeenCalledWith({
        where: {
          tripId: TRIP_ID,
        },
      });

      expect(transactionTripUpdateMany).toHaveBeenCalledWith({
        where: {
          id: TRIP_ID,
          ownerId: OWNER_ID,
        },
        data: {
          startDate: new Date('2026-10-11T00:00:00.000Z'),

          endDate: new Date('2026-10-15T00:00:00.000Z'),
        },
      });

      expect(result.startDate).toEqual(updatedTrip.startDate);

      expect(result.endDate).toEqual(updatedTrip.endDate);
    });

    it('blocks date changes after itinerary activities exist', async () => {
      tripFindFirst.mockResolvedValue(baseTrip);

      activityCount.mockResolvedValue(1);

      await expect(
        service.update(OWNER_ID, TRIP_ID, {
          startDate: '2026-10-11T00:00:00.000Z',

          endDate: '2026-10-15T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tripDayDeleteMany).not.toHaveBeenCalled();

      expect(transactionTripUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an owned trip', async () => {
      tripDeleteMany.mockResolvedValue({
        count: 1,
      });

      await service.remove(OWNER_ID, TRIP_ID);

      expect(tripDeleteMany).toHaveBeenCalledWith({
        where: {
          id: TRIP_ID,
          ownerId: OWNER_ID,
        },
      });
    });

    it('returns 404 when no owned trip was deleted', async () => {
      tripDeleteMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.remove(OWNER_ID, TRIP_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
