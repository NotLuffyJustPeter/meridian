import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOwnedTripOrThrow(ownerId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id: tripId,
        ownerId,
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return trip;
  }
}
