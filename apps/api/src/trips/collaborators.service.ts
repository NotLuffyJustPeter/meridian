import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import type { AddCollaboratorDto } from './dto/add-collaborator.dto';
import type { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import { TripsService } from './trips.service';

@Injectable()
export class CollaboratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly tripsService: TripsService,
  ) {}

  async findAll(ownerId: string, tripId: string) {
    await this.tripsService.findOwnedTripOrThrow(ownerId, tripId);

    return this.prisma.tripMember.findMany({
      where: {
        tripId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async add(ownerId: string, tripId: string, dto: AddCollaboratorDto) {
    await this.tripsService.findOwnedTripOrThrow(ownerId, tripId);

    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('Meridian user not found');
    }

    if (user.id === ownerId) {
      throw new BadRequestException('Trip owner cannot be added as a collaborator');
    }

    const existing = await this.prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a collaborator on this trip');
    }

    return this.prisma.tripMember.create({
      data: {
        tripId,
        userId: user.id,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async updateRole(ownerId: string, tripId: string, memberId: string, dto: UpdateCollaboratorDto) {
    await this.tripsService.findOwnedTripOrThrow(ownerId, tripId);

    const result = await this.prisma.tripMember.updateMany({
      where: {
        id: memberId,
        tripId,
      },
      data: {
        role: dto.role,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Collaborator not found');
    }

    const member = await this.prisma.tripMember.findUnique({
      where: {
        id: memberId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Collaborator not found');
    }

    return member;
  }

  async remove(ownerId: string, tripId: string, memberId: string): Promise<void> {
    await this.tripsService.findOwnedTripOrThrow(ownerId, tripId);

    const result = await this.prisma.tripMember.deleteMany({
      where: {
        id: memberId,
        tripId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Collaborator not found');
    }
  }
}
