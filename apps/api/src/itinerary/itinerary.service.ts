import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';

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
