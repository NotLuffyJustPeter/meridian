import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
  ) {}

  async create(ownerId: string, tripId: string, dto: CreatePlaceDto) {
    await this.tripsService.findEditableTripOrThrow(ownerId, tripId);

    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException('Place name is required');
    }

    const address = this.normalizeNullableText(dto.address);

    const notes = this.normalizeNullableText(dto.notes);

    const website = this.normalizeNullableText(dto.website);

    const sourceProvider = this.normalizeNullableText(dto.sourceProvider);

    const sourcePlaceId = this.normalizeNullableText(dto.sourcePlaceId);

    const latitude = dto.latitude ?? null;

    const longitude = dto.longitude ?? null;

    this.validateCoordinates(latitude, longitude);

    return this.prisma.place.create({
      data: {
        tripId,
        name,

        category: dto.category ?? 'OTHER',

        ...(address !== undefined && {
          address,
        }),

        latitude,
        longitude,

        ...(notes !== undefined && {
          notes,
        }),

        ...(website !== undefined && {
          website,
        }),

        ...(sourceProvider !== undefined && {
          sourceProvider,
        }),

        ...(sourcePlaceId !== undefined && {
          sourcePlaceId,
        }),
      },
    });
  }

  async findAllOwned(ownerId: string, tripId: string) {
    await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    return this.prisma.place.findMany({
      where: {
        tripId,
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
  }

  async findOwnedPlaceOrThrow(ownerId: string, tripId: string, placeId: string) {
    await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    return this.findPlaceInTripOrThrow(tripId, placeId);
  }

  async update(ownerId: string, tripId: string, placeId: string, dto: UpdatePlaceDto) {
    const hasUpdates =
      dto.name !== undefined ||
      dto.category !== undefined ||
      dto.address !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined ||
      dto.notes !== undefined ||
      dto.website !== undefined ||
      dto.sourceProvider !== undefined ||
      dto.sourcePlaceId !== undefined;

    if (!hasUpdates) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.tripsService.findEditableTripOrThrow(ownerId, tripId);

    const existing = await this.findPlaceInTripOrThrow(tripId, placeId);

    const name = dto.name !== undefined ? dto.name.trim() : undefined;

    if (name !== undefined && !name) {
      throw new BadRequestException('Place name is required');
    }

    const address = dto.address !== undefined ? this.normalizeNullableText(dto.address) : undefined;

    const notes = dto.notes !== undefined ? this.normalizeNullableText(dto.notes) : undefined;

    const website = dto.website !== undefined ? this.normalizeNullableText(dto.website) : undefined;

    const sourceProvider =
      dto.sourceProvider !== undefined ? this.normalizeNullableText(dto.sourceProvider) : undefined;

    const sourcePlaceId =
      dto.sourcePlaceId !== undefined ? this.normalizeNullableText(dto.sourcePlaceId) : undefined;

    const latitude = dto.latitude !== undefined ? dto.latitude : existing.latitude;

    const longitude = dto.longitude !== undefined ? dto.longitude : existing.longitude;

    this.validateCoordinates(latitude, longitude);

    const result = await this.prisma.place.updateMany({
      where: {
        id: placeId,
        tripId,
      },

      data: {
        ...(name !== undefined && {
          name,
        }),

        ...(dto.category !== undefined && {
          category: dto.category,
        }),

        ...(address !== undefined && {
          address,
        }),

        ...(dto.latitude !== undefined && {
          latitude: dto.latitude,
        }),

        ...(dto.longitude !== undefined && {
          longitude: dto.longitude,
        }),

        ...(notes !== undefined && {
          notes,
        }),

        ...(website !== undefined && {
          website,
        }),

        ...(sourceProvider !== undefined && {
          sourceProvider,
        }),

        ...(sourcePlaceId !== undefined && {
          sourcePlaceId,
        }),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Place not found');
    }

    return this.findPlaceInTripOrThrow(tripId, placeId);
  }

  async remove(ownerId: string, tripId: string, placeId: string): Promise<void> {
    await this.tripsService.findEditableTripOrThrow(ownerId, tripId);

    await this.findPlaceInTripOrThrow(tripId, placeId);

    const result = await this.prisma.place.deleteMany({
      where: {
        id: placeId,
        tripId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Place not found');
    }
  }

  private async findPlaceInTripOrThrow(tripId: string, placeId: string) {
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

  private normalizeNullableText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  }

  private validateCoordinates(latitude: number | null, longitude: number | null): void {
    const hasLatitude = latitude !== null;

    const hasLongitude = longitude !== null;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('latitude and longitude must be provided together');
    }

    if (latitude === null || longitude === null) {
      return;
    }

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new BadRequestException('latitude must be between -90 and 90');
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new BadRequestException('longitude must be between -180 and 180');
    }
  }
}
