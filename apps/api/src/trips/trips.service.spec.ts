import { BadRequestException, NotFoundException } from '@nestjs/common';
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

type TripCreateMock = (args: unknown) => Promise<TripRecord>;

type TripFindManyMock = (args: unknown) => Promise<TripRecord[]>;

type TripFindFirstMock = (args: unknown) => Promise<TripRecord | null>;

type TripMutationMock = (args: unknown) => Promise<{
  count: number;
}>;

describe('TripsService', () => {
  let service: TripsService;

  let tripCreate: jest.Mock<TripCreateMock>;
  let tripFindMany: jest.Mock<TripFindManyMock>;
  let tripFindFirst: jest.Mock<TripFindFirstMock>;
  let tripUpdateMany: jest.Mock<TripMutationMock>;
  let tripDeleteMany: jest.Mock<TripMutationMock>;

  beforeEach(() => {
    tripCreate = jest.fn<TripCreateMock>();
    tripFindMany = jest.fn<TripFindManyMock>();
    tripFindFirst = jest.fn<TripFindFirstMock>();
    tripUpdateMany = jest.fn<TripMutationMock>();
    tripDeleteMany = jest.fn<TripMutationMock>();

    const prisma = {
      trip: {
        create: tripCreate,
        findMany: tripFindMany,
        findFirst: tripFindFirst,
        updateMany: tripUpdateMany,
        deleteMany: tripDeleteMany,
      },
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
});
