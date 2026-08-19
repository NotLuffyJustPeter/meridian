import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateTripDto) {
    const name = dto.name.trim();
    const destination = dto.destination.trim();
    const timezone = dto.timezone.trim();
    const currency = dto.currency.trim().toUpperCase();

    if (!name) {
      throw new BadRequestException('Trip name is required');
    }

    if (!destination) {
      throw new BadRequestException('Destination is required');
    }

    this.validateTimezone(timezone);

    const startDate = new Date(dto.startDate);

    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return this.prisma.trip.create({
      data: {
        ownerId,
        name,
        destination,
        startDate,
        endDate,
        timezone,
        currency,
      },
    });
  }

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

  private validateTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
      }).format();
    } catch {
      throw new BadRequestException('Invalid timezone');
    }
  }
}
