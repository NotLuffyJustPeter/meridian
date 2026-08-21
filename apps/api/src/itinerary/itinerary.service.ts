import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { type CreateActivityDto } from './dto/create-activity.dto';
import { type UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ItineraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
  ) {}

  async getOrCreateItinerary(ownerId: string, tripId: string) {
    const trip = await this.tripsService.findOwnedTripOrThrow(ownerId, tripId);

    const dates = this.buildTripDates(trip.startDate, trip.endDate);

    if (dates.length > 0) {
      await this.prisma.tripDay.createMany({
        data: dates.map((date, index) => ({
          tripId: trip.id,
          date,
          dayNumber: index + 1,
        })),
        skipDuplicates: true,
      });
    }

    const days = await this.prisma.tripDay.findMany({
      where: {
        tripId: trip.id,
      },
      orderBy: {
        dayNumber: 'asc',
      },
      include: {
        activities: {
          orderBy: [
            {
              position: 'asc',
            },
            {
              startTime: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],
        },
      },
    });

    return {
      tripId: trip.id,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timezone: trip.timezone,
      days,
    };
  }

  async createActivity(ownerId: string, tripId: string, dayId: string, dto: CreateActivityDto) {
    const day = await this.findOwnedDayOrThrow(ownerId, tripId, dayId);

    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Activity title is required');
    }

    const description = dto.description !== undefined ? dto.description.trim() : undefined;

    const location = dto.location !== undefined ? dto.location.trim() : undefined;

    const notes = dto.notes !== undefined ? dto.notes.trim() : undefined;

    this.validateTimeRange(dto.startTime, dto.endTime);

    if (dto.placeId !== undefined) {
      await this.findOwnedPlaceOrThrow(tripId, dto.placeId);
    }

    let position = dto.position;

    if (position === undefined) {
      const lastActivity = await this.prisma.activity.findFirst({
        where: {
          tripDayId: day.id,
        },
        orderBy: {
          position: 'desc',
        },
        select: {
          position: true,
        },
      });

      position = (lastActivity?.position ?? -1) + 1;
    }

    return this.prisma.activity.create({
      data: {
        tripDayId: day.id,
        title,
        ...(description !== undefined && {
          description,
        }),
        ...(dto.category !== undefined && {
          category: dto.category,
        }),
        ...(dto.startTime !== undefined && {
          startTime: dto.startTime,
        }),
        ...(dto.endTime !== undefined && {
          endTime: dto.endTime,
        }),
        ...(location !== undefined && {
          location,
        }),
        ...(notes !== undefined && {
          notes,
        }),
        ...(dto.placeId !== undefined && {
          placeId: dto.placeId,
        }),
        position,
      },
    });
  }

  async updateActivity(
    ownerId: string,
    tripId: string,
    dayId: string,
    activityId: string,
    dto: UpdateActivityDto,
  ) {
    const hasUpdates =
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.category !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.location !== undefined ||
      dto.notes !== undefined ||
      dto.position !== undefined ||
      dto.placeId !== undefined;

    if (!hasUpdates) {
      throw new BadRequestException('At least one field must be provided');
    }

    const day = await this.findOwnedDayOrThrow(ownerId, tripId, dayId);

    const activity = await this.findOwnedActivityOrThrow(day.id, activityId);

    const title = dto.title !== undefined ? dto.title.trim() : undefined;

    if (title !== undefined && !title) {
      throw new BadRequestException('Activity title is required');
    }

    const description = dto.description !== undefined ? dto.description.trim() : undefined;

    const location = dto.location !== undefined ? dto.location.trim() : undefined;

    const notes = dto.notes !== undefined ? dto.notes.trim() : undefined;

    const startTime =
      dto.startTime !== undefined ? dto.startTime : (activity.startTime ?? undefined);

    const endTime = dto.endTime !== undefined ? dto.endTime : (activity.endTime ?? undefined);

    this.validateTimeRange(startTime, endTime);

    if (dto.placeId !== undefined) {
      await this.findOwnedPlaceOrThrow(tripId, dto.placeId);
    }

    const result = await this.prisma.activity.updateMany({
      where: {
        id: activity.id,
        tripDayId: day.id,
      },
      data: {
        ...(title !== undefined && {
          title,
        }),
        ...(description !== undefined && {
          description,
        }),
        ...(dto.category !== undefined && {
          category: dto.category,
        }),
        ...(dto.startTime !== undefined && {
          startTime: dto.startTime,
        }),
        ...(dto.endTime !== undefined && {
          endTime: dto.endTime,
        }),
        ...(location !== undefined && {
          location,
        }),
        ...(notes !== undefined && {
          notes,
        }),
        ...(dto.position !== undefined && {
          position: dto.position,
        }),
        ...(dto.placeId !== undefined && {
          placeId: dto.placeId,
        }),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Activity not found');
    }

    return this.findOwnedActivityOrThrow(day.id, activity.id);
  }

  async removeActivity(
    ownerId: string,
    tripId: string,
    dayId: string,
    activityId: string,
  ): Promise<void> {
    const day = await this.findOwnedDayOrThrow(ownerId, tripId, dayId);

    const result = await this.prisma.activity.deleteMany({
      where: {
        id: activityId,
        tripDayId: day.id,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Activity not found');
    }
  }

  async reorderActivities(ownerId: string, tripId: string, dayId: string, activityIds: string[]) {
    const day = await this.findOwnedDayOrThrow(ownerId, tripId, dayId);

    const existingActivities = await this.prisma.activity.findMany({
      where: {
        tripDayId: day.id,
      },
      orderBy: {
        position: 'asc',
      },
      select: {
        id: true,
      },
    });

    if (existingActivities.length !== activityIds.length) {
      throw new BadRequestException('activityIds must contain every activity in the trip day');
    }

    const existingIds = new Set(existingActivities.map((activity) => activity.id));

    const containsOnlyOwnedActivities = activityIds.every((activityId) =>
      existingIds.has(activityId),
    );

    if (!containsOnlyOwnedActivities) {
      throw new BadRequestException('activityIds contains an invalid activity');
    }

    await this.prisma.$transaction(
      activityIds.map((activityId, position) =>
        this.prisma.activity.update({
          where: {
            id: activityId,
          },
          data: {
            position,
          },
        }),
      ),
    );

    return this.prisma.activity.findMany({
      where: {
        tripDayId: day.id,
      },
      orderBy: [
        {
          position: 'asc',
        },
        {
          startTime: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  private async findOwnedDayOrThrow(ownerId: string, tripId: string, dayId: string) {
    const day = await this.prisma.tripDay.findFirst({
      where: {
        id: dayId,
        tripId,
        trip: {
          ownerId,
        },
      },
    });

    if (!day) {
      throw new NotFoundException('Trip day not found');
    }

    return day;
  }

  private async findOwnedPlaceOrThrow(tripId: string, placeId: string) {
    const place = await this.prisma.place.findFirst({
      where: {
        id: placeId,
        tripId,
      },
    });

    if (!place) {
      throw new NotFoundException('Place not found');
    }

    return place;
  }

  private async findOwnedActivityOrThrow(tripDayId: string, activityId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        tripDayId,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    return activity;
  }

  private validateTimeRange(startTime?: string, endTime?: string): void {
    if (startTime && endTime && endTime < startTime) {
      throw new BadRequestException('endTime must be on or after startTime');
    }
  }

  private buildTripDates(startDate: Date, endDate: Date): Date[] {
    const start = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
    );

    const end = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
    );

    const dates: Date[] = [];

    const current = new Date(start);

    while (current.getTime() <= end.getTime()) {
      dates.push(new Date(current));

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }
}
