import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { Trip, TripMemberRole } from '../generated/prisma/client';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

export type TripAccessRole = 'OWNER' | TripMemberRole;

type TripWithMembership = Trip & {
  members: Array<{
    role: TripMemberRole;
  }>;
};

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

    const trip = await this.prisma.trip.create({
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

    return {
      ...trip,
      accessRole: 'OWNER' as const,
    };
  }

  async findAllAccessible(userId: string) {
    const trips = await this.prisma.trip.findMany({
      where: {
        OR: [
          {
            ownerId: userId,
          },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
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

    return trips.map((trip) => this.attachAccessRole(userId, trip));
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

  async findAccessibleTripOrThrow(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id: tripId,
        OR: [
          {
            ownerId: userId,
          },
          {
            members: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return this.attachAccessRole(userId, trip);
  }

  async findEditableTripOrThrow(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id: tripId,
        OR: [
          {
            ownerId: userId,
          },
          {
            members: {
              some: {
                userId,
                role: 'EDITOR',
              },
            },
          },
        ],
      },
      include: {
        members: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return this.attachAccessRole(userId, trip);
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

    const datesChanged =
      startDate.getTime() !== existing.startDate.getTime() ||
      endDate.getTime() !== existing.endDate.getTime();

    const updateData = {
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
    };

    if (datesChanged) {
      return this.prisma.$transaction(async (transaction) => {
        const activityCount = await transaction.activity.count({
          where: {
            tripDay: {
              tripId,
            },
          },
        });

        if (activityCount > 0) {
          throw new ConflictException(
            'Trip dates cannot be changed after itinerary activities have been added',
          );
        }

        await transaction.tripDay.deleteMany({
          where: {
            tripId,
          },
        });

        const result = await transaction.trip.updateMany({
          where: {
            id: tripId,
            ownerId,
          },
          data: updateData,
        });

        if (result.count === 0) {
          throw new NotFoundException('Trip not found');
        }

        const updated = await transaction.trip.findFirst({
          where: {
            id: tripId,
            ownerId,
          },
        });

        if (!updated) {
          throw new NotFoundException('Trip not found');
        }

        return {
          ...updated,
          accessRole: 'OWNER' as const,
        };
      });
    }

    const result = await this.prisma.trip.updateMany({
      where: {
        id: tripId,
        ownerId,
      },
      data: updateData,
    });

    if (result.count === 0) {
      throw new NotFoundException('Trip not found');
    }

    const updated = await this.findOwnedTripOrThrow(ownerId, tripId);

    return {
      ...updated,
      accessRole: 'OWNER' as const,
    };
  }

  async remove(ownerId: string, tripId: string): Promise<void> {
    const result = await this.prisma.trip.deleteMany({
      where: {
        id: tripId,
        ownerId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Trip not found');
    }
  }

  private attachAccessRole(userId: string, record: TripWithMembership) {
    const { members, ...trip } = record;

    if (trip.ownerId === userId) {
      return {
        ...trip,
        accessRole: 'OWNER' as const,
      };
    }

    const memberRole = members[0]?.role;

    if (!memberRole) {
      throw new NotFoundException('Trip not found');
    }

    return {
      ...trip,
      accessRole: memberRole,
    };
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
