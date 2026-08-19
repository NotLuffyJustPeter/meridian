import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

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

  async findAllOwned(ownerId: string) {
    return this.prisma.trip.findMany({
      where: {
        ownerId,
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

  async update(ownerId: string, tripId: string, dto: UpdateTripDto) {
    const hasUpdates =
      dto.name !== undefined ||
      dto.destination !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined ||
      dto.timezone !== undefined ||
      dto.currency !== undefined ||
      dto.status !== undefined;

    if (!hasUpdates) {
      throw new BadRequestException('At least one field must be provided');
    }

    const existing = await this.findOwnedTripOrThrow(ownerId, tripId);
    const name = dto.name !== undefined ? dto.name.trim() : undefined;

    const destination = dto.destination !== undefined ? dto.destination.trim() : undefined;

    const timezone = dto.timezone !== undefined ? dto.timezone.trim() : undefined;

    const currency = dto.currency !== undefined ? dto.currency.trim().toUpperCase() : undefined;

    if (name !== undefined && !name) {
      throw new BadRequestException('Trip name is required');
    }

    if (destination !== undefined && !destination) {
      throw new BadRequestException('Destination is required');
    }

    if (timezone !== undefined) {
      this.validateTimezone(timezone);
    }

    const startDate = dto.startDate !== undefined ? new Date(dto.startDate) : existing.startDate;

    const endDate = dto.endDate !== undefined ? new Date(dto.endDate) : existing.endDate;

    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    const result = await this.prisma.trip.updateMany({
      where: {
        id: tripId,
        ownerId,
      },
      data: {
        ...(name !== undefined && {
          name,
        }),
        ...(destination !== undefined && {
          destination,
        }),
        ...(dto.startDate !== undefined && {
          startDate,
        }),
        ...(dto.endDate !== undefined && {
          endDate,
        }),
        ...(timezone !== undefined && {
          timezone,
        }),
        ...(currency !== undefined && {
          currency,
        }),
        ...(dto.status !== undefined && {
          status: dto.status,
        }),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Trip not found');
    }

    return this.findOwnedTripOrThrow(ownerId, tripId);
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
