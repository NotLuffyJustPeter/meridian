import { BadRequestException, NotFoundException } from '@nestjs/common';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { PlacesService } from './places.service';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';

const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';

const PLACE_ID = 'ca55bc81-bd51-4286-9a0e-ac49c76d844d';

type PlaceCategory =
  'LANDMARK' | 'FOOD' | 'LODGING' | 'SHOPPING' | 'TRANSPORT' | 'ENTERTAINMENT' | 'NATURE' | 'OTHER';

type PlaceRecord = {
  id: string;
  tripId: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  website: string | null;
  sourceProvider: string | null;
  sourcePlaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const basePlace: PlaceRecord = {
  id: PLACE_ID,
  tripId: TRIP_ID,
  name: 'Meiji Shrine',
  category: 'LANDMARK',
  address: '1-1 Yoyogikamizonocho, Shibuya, Tokyo',
  latitude: 35.6764,
  longitude: 139.6993,
  notes: 'Visit early in the morning',
  website: 'https://www.meijijingu.or.jp/',
  sourceProvider: null,
  sourcePlaceId: null,
  createdAt: new Date('2026-08-20T17:11:46.486Z'),
  updatedAt: new Date('2026-08-20T17:11:46.486Z'),
};

type PlaceCreateMock = (args: unknown) => Promise<PlaceRecord>;

type PlaceFindManyMock = (args: unknown) => Promise<PlaceRecord[]>;

type PlaceFindFirstMock = (args: unknown) => Promise<PlaceRecord | null>;

type PlaceMutationMock = (args: unknown) => Promise<{
  count: number;
}>;

type FindTripAccessMock = (
  ownerId: string,
  tripId: string,
) => Promise<{
  id: string;
}>;

describe('PlacesService', () => {
  let service: PlacesService;

  let placeCreate: jest.Mock<PlaceCreateMock>;

  let placeFindMany: jest.Mock<PlaceFindManyMock>;

  let placeFindFirst: jest.Mock<PlaceFindFirstMock>;

  let placeUpdateMany: jest.Mock<PlaceMutationMock>;

  let placeDeleteMany: jest.Mock<PlaceMutationMock>;

  let findAccessibleTripOrThrow: jest.Mock<FindTripAccessMock>;

  let findEditableTripOrThrow: jest.Mock<FindTripAccessMock>;

  beforeEach(() => {
    placeCreate = jest.fn<PlaceCreateMock>();

    placeFindMany = jest.fn<PlaceFindManyMock>();

    placeFindFirst = jest.fn<PlaceFindFirstMock>();

    placeUpdateMany = jest.fn<PlaceMutationMock>();

    placeDeleteMany = jest.fn<PlaceMutationMock>();

    findAccessibleTripOrThrow = jest.fn<FindTripAccessMock>();

    findEditableTripOrThrow = jest.fn<FindTripAccessMock>();

    findAccessibleTripOrThrow.mockResolvedValue({
      id: TRIP_ID,
    });

    findEditableTripOrThrow.mockResolvedValue({
      id: TRIP_ID,
    });

    const prisma = {
      place: {
        create: placeCreate,
        findMany: placeFindMany,
        findFirst: placeFindFirst,
        updateMany: placeUpdateMany,
        deleteMany: placeDeleteMany,
      },
    } as unknown as PrismaService;

    const tripsService = {
      findAccessibleTripOrThrow,
      findEditableTripOrThrow,
    } as unknown as TripsService;

    service = new PlacesService(prisma, tripsService);
  });

  describe('create', () => {
    it('creates and normalizes an editable trip place', async () => {
      findEditableTripOrThrow.mockResolvedValue({
        id: TRIP_ID,
      });

      placeCreate.mockResolvedValue(basePlace);

      const result = await service.create(OWNER_ID, TRIP_ID, {
        name: '  Meiji Shrine  ',

        category: 'LANDMARK',

        address: '  1-1 Yoyogikamizonocho, Shibuya, Tokyo  ',

        latitude: 35.6764,

        longitude: 139.6993,

        notes: '  Visit early in the morning  ',

        website: '  https://www.meijijingu.or.jp/  ',
      });

      expect(findEditableTripOrThrow).toHaveBeenCalledWith(OWNER_ID, TRIP_ID);

      expect(placeCreate).toHaveBeenCalledWith({
        data: {
          tripId: TRIP_ID,

          name: 'Meiji Shrine',

          category: 'LANDMARK',

          address: '1-1 Yoyogikamizonocho, Shibuya, Tokyo',

          latitude: 35.6764,

          longitude: 139.6993,

          notes: 'Visit early in the morning',

          website: 'https://www.meijijingu.or.jp/',
        },
      });

      expect(result.id).toBe(PLACE_ID);
    });

    it('defaults category to OTHER and allows a place without coordinates', async () => {
      findEditableTripOrThrow.mockResolvedValue({
        id: TRIP_ID,
      });

      placeCreate.mockResolvedValue({
        ...basePlace,
        category: 'OTHER',
        latitude: null,
        longitude: null,
      });

      await service.create(OWNER_ID, TRIP_ID, {
        name: 'Flexible stop',
      });

      expect(placeCreate).toHaveBeenCalledWith({
        data: {
          tripId: TRIP_ID,

          name: 'Flexible stop',

          category: 'OTHER',

          latitude: null,

          longitude: null,
        },
      });
    });

    it('rejects incomplete coordinates', async () => {
      findEditableTripOrThrow.mockResolvedValue({
        id: TRIP_ID,
      });

      await expect(
        service.create(OWNER_ID, TRIP_ID, {
          name: 'Broken place',

          latitude: 35.6764,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(placeCreate).not.toHaveBeenCalled();
    });

    it('rejects out-of-range latitude', async () => {
      findEditableTripOrThrow.mockResolvedValue({
        id: TRIP_ID,
      });

      await expect(
        service.create(OWNER_ID, TRIP_ID, {
          name: 'Broken place',

          latitude: 120,

          longitude: 139,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(placeCreate).not.toHaveBeenCalled();
    });

    it('rejects out-of-range longitude', async () => {
      findEditableTripOrThrow.mockResolvedValue({
        id: TRIP_ID,
      });

      await expect(
        service.create(OWNER_ID, TRIP_ID, {
          name: 'Broken place',

          latitude: 35,

          longitude: 200,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(placeCreate).not.toHaveBeenCalled();
    });
  });

  describe('findAllOwned', () => {
    it('checks trip access and lists trip places', async () => {
      findAccessibleTripOrThrow.mockResolvedValue({
        id: TRIP_ID,
      });

      placeFindMany.mockResolvedValue([basePlace]);

      const result = await service.findAllOwned(OWNER_ID, TRIP_ID);

      expect(findAccessibleTripOrThrow).toHaveBeenCalledWith(OWNER_ID, TRIP_ID);

      expect(placeFindMany).toHaveBeenCalledWith({
        where: {
          tripId: TRIP_ID,
        },

        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            name: 'asc',
          },
        ],
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('findOwnedPlaceOrThrow', () => {
    it('returns a place from an accessible trip', async () => {
      placeFindFirst.mockResolvedValue(basePlace);

      const result = await service.findOwnedPlaceOrThrow(OWNER_ID, TRIP_ID, PLACE_ID);

      expect(findAccessibleTripOrThrow).toHaveBeenCalledWith(OWNER_ID, TRIP_ID);

      expect(placeFindFirst).toHaveBeenCalledWith({
        where: {
          id: PLACE_ID,
          tripId: TRIP_ID,
        },
      });

      expect(result.id).toBe(PLACE_ID);
    });

    it('returns 404 for a missing place', async () => {
      placeFindFirst.mockResolvedValue(null);

      await expect(
        service.findOwnedPlaceOrThrow(OWNER_ID, TRIP_ID, PLACE_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates supplied fields', async () => {
      placeFindFirst.mockResolvedValueOnce(basePlace).mockResolvedValueOnce({
        ...basePlace,
        notes: 'Go before 9 AM',
      });

      placeUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.update(OWNER_ID, TRIP_ID, PLACE_ID, {
        notes: '  Go before 9 AM  ',
      });

      expect(placeUpdateMany).toHaveBeenCalledWith({
        where: {
          id: PLACE_ID,
          tripId: TRIP_ID,
        },

        data: {
          notes: 'Go before 9 AM',
        },
      });

      expect(result.notes).toBe('Go before 9 AM');
    });

    it('allows nullable fields and coordinates to be cleared', async () => {
      const clearedPlace: PlaceRecord = {
        ...basePlace,
        address: null,
        latitude: null,
        longitude: null,
        notes: null,
        website: null,
        sourceProvider: null,
        sourcePlaceId: null,
      };

      placeFindFirst.mockResolvedValueOnce(basePlace).mockResolvedValueOnce(clearedPlace);

      placeUpdateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.update(OWNER_ID, TRIP_ID, PLACE_ID, {
        address: null,

        latitude: null,

        longitude: null,

        notes: null,

        website: null,

        sourceProvider: null,

        sourcePlaceId: null,
      });

      expect(placeUpdateMany).toHaveBeenCalledWith({
        where: {
          id: PLACE_ID,
          tripId: TRIP_ID,
        },

        data: {
          address: null,

          latitude: null,

          longitude: null,

          notes: null,

          website: null,

          sourceProvider: null,

          sourcePlaceId: null,
        },
      });

      expect(result.address).toBeNull();

      expect(result.latitude).toBeNull();

      expect(result.longitude).toBeNull();

      expect(result.notes).toBeNull();

      expect(result.website).toBeNull();
    });

    it('rejects an empty update', async () => {
      await expect(service.update(OWNER_ID, TRIP_ID, PLACE_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(placeFindFirst).not.toHaveBeenCalled();

      expect(placeUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects clearing only one coordinate', async () => {
      placeFindFirst.mockResolvedValue(basePlace);

      await expect(
        service.update(OWNER_ID, TRIP_ID, PLACE_ID, {
          latitude: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(placeUpdateMany).not.toHaveBeenCalled();
    });

    it('rejects changing only one coordinate when the other is missing', async () => {
      const placeWithoutCoordinates: PlaceRecord = {
        ...basePlace,
        latitude: null,
        longitude: null,
      };

      placeFindFirst.mockResolvedValue(placeWithoutCoordinates);

      await expect(
        service.update(OWNER_ID, TRIP_ID, PLACE_ID, {
          latitude: 35.6764,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(placeUpdateMany).not.toHaveBeenCalled();
    });

    it('returns 404 when update no longer matches a place', async () => {
      placeFindFirst.mockResolvedValueOnce(basePlace);

      placeUpdateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.update(OWNER_ID, TRIP_ID, PLACE_ID, {
          notes: 'Updated notes',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a place from an editable trip', async () => {
      placeFindFirst.mockResolvedValue(basePlace);

      placeDeleteMany.mockResolvedValue({
        count: 1,
      });

      await service.remove(OWNER_ID, TRIP_ID, PLACE_ID);

      expect(placeFindFirst).toHaveBeenCalled();

      expect(placeDeleteMany).toHaveBeenCalledWith({
        where: {
          id: PLACE_ID,
          tripId: TRIP_ID,
        },
      });
    });

    it('returns 404 without deleting a foreign place', async () => {
      placeFindFirst.mockResolvedValue(null);

      await expect(service.remove(OWNER_ID, TRIP_ID, PLACE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(placeDeleteMany).not.toHaveBeenCalled();
    });

    it('returns 404 if deleteMany does not delete a place', async () => {
      placeFindFirst.mockResolvedValue(basePlace);

      placeDeleteMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.remove(OWNER_ID, TRIP_ID, PLACE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
