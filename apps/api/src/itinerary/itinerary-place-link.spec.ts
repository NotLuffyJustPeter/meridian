import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { ItineraryService } from './itinerary.service';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';

const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';

const DAY_ID = '0c78015f-3e5a-4878-a8e4-37b478afdb50';

const PLACE_ID = 'a7c6c25e-8c61-46aa-9d79-59905c6a1a3d';

type FindFirstMock = (args: unknown) => Promise<unknown>;

type CreateMock = (args: unknown) => Promise<unknown>;

describe('ItineraryService place links', () => {
  let service: ItineraryService;

  let tripDayFindFirst: jest.Mock<FindFirstMock>;

  let placeFindFirst: jest.Mock<FindFirstMock>;

  let activityFindFirst: jest.Mock<FindFirstMock>;

  let activityCreate: jest.Mock<CreateMock>;

  beforeEach(() => {
    tripDayFindFirst = jest.fn<FindFirstMock>();

    placeFindFirst = jest.fn<FindFirstMock>();

    activityFindFirst = jest.fn<FindFirstMock>();

    activityCreate = jest.fn<CreateMock>();

    tripDayFindFirst.mockResolvedValue({
      id: DAY_ID,
      tripId: TRIP_ID,
    });

    placeFindFirst.mockResolvedValue({
      id: PLACE_ID,
      tripId: TRIP_ID,
    });

    activityFindFirst.mockResolvedValue(null);

    activityCreate.mockResolvedValue({
      id: '234de679-1df6-44f6-8213-34b45772ee7e',
      tripDayId: DAY_ID,
      placeId: PLACE_ID,
      title: 'Rijksmuseum',
      position: 0,
    });

    const prisma = {
      tripDay: {
        findFirst: tripDayFindFirst,
      },
      place: {
        findFirst: placeFindFirst,
      },
      activity: {
        findFirst: activityFindFirst,
        create: activityCreate,
      },
    } as unknown as PrismaService;

    service = new ItineraryService(prisma, {} as TripsService);
  });

  it('links an activity only to a place from the same trip', async () => {
    const result = await service.createActivity(OWNER_ID, TRIP_ID, DAY_ID, {
      title: 'Rijksmuseum',
      placeId: PLACE_ID,
    });

    expect(placeFindFirst).toHaveBeenCalledWith({
      where: {
        id: PLACE_ID,
        tripId: TRIP_ID,
      },
    });

    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tripDayId: DAY_ID,
        title: 'Rijksmuseum',
        placeId: PLACE_ID,
      }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        placeId: PLACE_ID,
      }),
    );
  });

  it('rejects a place that does not belong to the trip', async () => {
    placeFindFirst.mockResolvedValue(null);

    await expect(
      service.createActivity(OWNER_ID, TRIP_ID, DAY_ID, {
        title: 'Rijksmuseum',
        placeId: PLACE_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(activityCreate).not.toHaveBeenCalled();
  });
});
