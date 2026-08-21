import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { ItineraryService } from './itinerary.service';

type TripRecord = {
  id: string;
  startDate: Date;
  endDate: Date;
  timezone: string;
};

type DayRecord = {
  id: string;
  tripId: string;
  date: Date;
  dayNumber: number;
};

type ActivityRecord = {
  id: string;
  tripDayId: string;
  title: string;
  category: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  position: number;
};

type DayWithActivities = DayRecord & {
  activities: ActivityRecord[];
};

function createPrismaMock() {
  return {
    tripDay: {
      createMany: jest.fn<
        (args: unknown) => Promise<{
          count: number;
        }>
      >(),

      findMany: jest.fn<(args: unknown) => Promise<DayWithActivities[]>>(),

      findFirst: jest.fn<(args: unknown) => Promise<DayRecord | null>>(),
    },

    activity: {
      findFirst: jest.fn<
        (args: unknown) => Promise<
          | ActivityRecord
          | {
              position: number;
            }
          | null
        >
      >(),

      findMany: jest.fn<
        (args: unknown) => Promise<
          Array<
            | ActivityRecord
            | {
                id: string;
              }
          >
        >
      >(),

      create: jest.fn<(args: unknown) => Promise<ActivityRecord>>(),

      update: jest.fn<(args: unknown) => Promise<ActivityRecord>>(),

      updateMany: jest.fn<
        (args: unknown) => Promise<{
          count: number;
        }>
      >(),

      deleteMany: jest.fn<
        (args: unknown) => Promise<{
          count: number;
        }>
      >(),
    },

    $transaction: jest.fn<(operations: unknown[]) => Promise<unknown[]>>(),
  };
}

function createTripsServiceMock() {
  const findTripOrThrow = jest.fn<(ownerId: string, tripId: string) => Promise<TripRecord>>();

  return {
    findOwnedTripOrThrow: findTripOrThrow,
    findAccessibleTripOrThrow: findTripOrThrow,
    findEditableTripOrThrow: findTripOrThrow,
  };
}

describe('ItineraryService', () => {
  let service: ItineraryService;

  let prismaMock: ReturnType<typeof createPrismaMock>;

  let tripsServiceMock: ReturnType<typeof createTripsServiceMock>;

  const ownerId = 'owner-1';

  const tripId = 'trip-1';

  const dayId = 'day-1';

  const activityId = 'activity-1';

  const trip: TripRecord = {
    id: tripId,
    startDate: new Date('2027-11-05T00:00:00.000Z'),
    endDate: new Date('2027-11-07T00:00:00.000Z'),
    timezone: 'Asia/Tokyo',
  };

  const day: DayRecord = {
    id: dayId,
    tripId,
    date: new Date('2027-11-05T00:00:00.000Z'),
    dayNumber: 1,
  };

  const baseActivity: ActivityRecord = {
    id: activityId,
    tripDayId: dayId,
    title: 'Arrive at Haneda',
    category: 'TRANSPORT',
    startTime: '09:00',
    endTime: '10:30',
    location: 'Haneda Airport',
    notes: null,
    position: 0,
  };

  beforeEach(() => {
    prismaMock = createPrismaMock();

    tripsServiceMock = createTripsServiceMock();

    service = new ItineraryService(
      prismaMock as unknown as PrismaService,
      tripsServiceMock as unknown as TripsService,
    );
  });

  it('generates every trip day inclusively', async () => {
    tripsServiceMock.findOwnedTripOrThrow.mockResolvedValue(trip);

    prismaMock.tripDay.createMany.mockResolvedValue({
      count: 3,
    });

    const days: DayWithActivities[] = [
      {
        ...day,
        activities: [],
      },
      {
        ...day,
        id: 'day-2',
        date: new Date('2027-11-06T00:00:00.000Z'),
        dayNumber: 2,
        activities: [],
      },
      {
        ...day,
        id: 'day-3',
        date: new Date('2027-11-07T00:00:00.000Z'),
        dayNumber: 3,
        activities: [],
      },
    ];

    prismaMock.tripDay.findMany.mockResolvedValue(days);

    const result = await service.getOrCreateItinerary(ownerId, tripId);

    expect(tripsServiceMock.findOwnedTripOrThrow).toHaveBeenCalledWith(ownerId, tripId);

    expect(prismaMock.tripDay.createMany).toHaveBeenCalledWith({
      data: [
        {
          tripId,
          date: new Date('2027-11-05T00:00:00.000Z'),
          dayNumber: 1,
        },
        {
          tripId,
          date: new Date('2027-11-06T00:00:00.000Z'),
          dayNumber: 2,
        },
        {
          tripId,
          date: new Date('2027-11-07T00:00:00.000Z'),
          dayNumber: 3,
        },
      ],
      skipDuplicates: true,
    });

    expect(result.days).toHaveLength(3);

    expect(result.timezone).toBe('Asia/Tokyo');
  });

  it('uses skipDuplicates when initializing itinerary days', async () => {
    tripsServiceMock.findOwnedTripOrThrow.mockResolvedValue(trip);

    prismaMock.tripDay.createMany.mockResolvedValue({
      count: 0,
    });

    prismaMock.tripDay.findMany.mockResolvedValue([]);

    await service.getOrCreateItinerary(ownerId, tripId);

    expect(prismaMock.tripDay.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
      }),
    );
  });

  it('creates an activity with the next automatic position', async () => {
    prismaMock.tripDay.findFirst.mockResolvedValue(day);

    prismaMock.activity.findFirst.mockResolvedValue({
      position: 2,
    });

    const created: ActivityRecord = {
      ...baseActivity,
      title: 'Check in at hotel',
      position: 3,
    };

    prismaMock.activity.create.mockResolvedValue(created);

    const result = await service.createActivity(ownerId, tripId, dayId, {
      title: '  Check in at hotel  ',
      category: 'LODGING',
    });

    expect(prismaMock.activity.create).toHaveBeenCalledWith({
      data: {
        tripDayId: dayId,
        title: 'Check in at hotel',
        category: 'LODGING',
        position: 3,
      },
    });

    expect(result.position).toBe(3);
  });

  it('rejects an invalid activity time range', async () => {
    prismaMock.tripDay.findFirst.mockResolvedValue(day);

    await expect(
      service.createActivity(ownerId, tripId, dayId, {
        title: 'Invalid activity',
        startTime: '18:00',
        endTime: '17:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.activity.create).not.toHaveBeenCalled();
  });

  it('updates only provided activity fields', async () => {
    const updated: ActivityRecord = {
      ...baseActivity,
      title: 'Arrive at Tokyo Haneda',
      endTime: '10:00',
      notes: 'Pick up Suica',
    };

    prismaMock.tripDay.findFirst.mockResolvedValue(day);

    prismaMock.activity.findFirst
      .mockResolvedValueOnce(baseActivity)
      .mockResolvedValueOnce(updated);

    prismaMock.activity.updateMany.mockResolvedValue({
      count: 1,
    });

    const result = await service.updateActivity(ownerId, tripId, dayId, activityId, {
      title: 'Arrive at Tokyo Haneda',
      endTime: '10:00',
      notes: 'Pick up Suica',
    });

    expect(prismaMock.activity.updateMany).toHaveBeenCalledWith({
      where: {
        id: activityId,
        tripDayId: dayId,
      },
      data: {
        title: 'Arrive at Tokyo Haneda',
        endTime: '10:00',
        notes: 'Pick up Suica',
      },
    });

    expect(result.startTime).toBe('09:00');

    expect(result.endTime).toBe('10:00');
  });

  it('rejects an empty activity update', async () => {
    await expect(
      service.updateActivity(ownerId, tripId, dayId, activityId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.tripDay.findFirst).not.toHaveBeenCalled();
  });

  it('deletes an owned activity', async () => {
    prismaMock.tripDay.findFirst.mockResolvedValue(day);

    prismaMock.activity.deleteMany.mockResolvedValue({
      count: 1,
    });

    await service.removeActivity(ownerId, tripId, dayId, activityId);

    expect(prismaMock.activity.deleteMany).toHaveBeenCalledWith({
      where: {
        id: activityId,
        tripDayId: dayId,
      },
    });
  });

  it('hides trip days that do not belong to the owner', async () => {
    prismaMock.tripDay.findFirst.mockResolvedValue(null);

    await expect(
      service.createActivity(ownerId, tripId, dayId, {
        title: 'Forbidden activity',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.activity.create).not.toHaveBeenCalled();
  });

  it('reorders every activity in a trip day', async () => {
    const activityA = {
      ...baseActivity,
      id: 'activity-a',
      title: 'A',
      position: 1,
    };

    const activityB = {
      ...baseActivity,
      id: 'activity-b',
      title: 'B',
      position: 2,
    };

    const activityC = {
      ...baseActivity,
      id: 'activity-c',
      title: 'C',
      position: 0,
    };

    prismaMock.tripDay.findFirst.mockResolvedValue(day);

    prismaMock.activity.findMany
      .mockResolvedValueOnce([
        {
          id: 'activity-a',
        },
        {
          id: 'activity-b',
        },
        {
          id: 'activity-c',
        },
      ])
      .mockResolvedValueOnce([activityC, activityA, activityB]);

    prismaMock.activity.update.mockResolvedValue(activityA);

    prismaMock.$transaction.mockResolvedValue([]);

    const result = await service.reorderActivities(ownerId, tripId, dayId, [
      'activity-c',
      'activity-a',
      'activity-b',
    ]);

    expect(prismaMock.activity.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'activity-c',
      },
      data: {
        position: 0,
      },
    });

    expect(prismaMock.activity.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'activity-a',
      },
      data: {
        position: 1,
      },
    });

    expect(prismaMock.activity.update).toHaveBeenNthCalledWith(3, {
      where: {
        id: 'activity-b',
      },
      data: {
        position: 2,
      },
    });

    expect(result.map((activity) => activity.id)).toEqual([
      'activity-c',
      'activity-a',
      'activity-b',
    ]);
  });

  it('rejects an incomplete reorder', async () => {
    prismaMock.tripDay.findFirst.mockResolvedValue(day);

    prismaMock.activity.findMany.mockResolvedValue([
      {
        id: 'activity-a',
      },
      {
        id: 'activity-b',
      },
      {
        id: 'activity-c',
      },
    ]);

    await expect(
      service.reorderActivities(ownerId, tripId, dayId, ['activity-a', 'activity-b']),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
