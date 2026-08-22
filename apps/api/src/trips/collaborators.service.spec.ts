import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { CollaboratorsService } from './collaborators.service';
import { TripsService } from './trips.service';

type OneArgAsyncMock = jest.MockedFunction<(input: unknown) => Promise<unknown>>;

type CountAsyncMock = jest.MockedFunction<
  (input: unknown) => Promise<{
    count: number;
  }>
>;

type FindOwnedMock = jest.MockedFunction<(ownerId: string, tripId: string) => Promise<unknown>>;

type FindByEmailMock = jest.MockedFunction<
  (email: string) => Promise<{
    id: string;
    email: string;
  } | null>
>;

describe('CollaboratorsService', () => {
  let service: CollaboratorsService;

  let findOwned: FindOwnedMock;

  let findByEmail: FindByEmailMock;

  let findMember: OneArgAsyncMock;

  let createMember: OneArgAsyncMock;

  let updateMembers: CountAsyncMock;

  let deleteMembers: CountAsyncMock;

  beforeEach(() => {
    findOwned = jest.fn<(ownerId: string, tripId: string) => Promise<unknown>>(() =>
      Promise.resolve({}),
    );

    findByEmail = jest.fn<
      (email: string) => Promise<{
        id: string;
        email: string;
      } | null>
    >();

    findMember = jest.fn<(input: unknown) => Promise<unknown>>();

    createMember = jest.fn<(input: unknown) => Promise<unknown>>();

    updateMembers = jest.fn<
      (input: unknown) => Promise<{
        count: number;
      }>
    >();

    deleteMembers = jest.fn<
      (input: unknown) => Promise<{
        count: number;
      }>
    >();

    const findMany = jest.fn<(input: unknown) => Promise<unknown[]>>(() => Promise.resolve([]));

    const prisma = {
      tripMember: {
        findMany,
        findUnique: findMember,
        create: createMember,
        updateMany: updateMembers,
        deleteMany: deleteMembers,
      },
    } as unknown as PrismaService;

    const usersService = {
      findByEmail,
    } as unknown as UsersService;

    const tripsService = {
      findOwnedTripOrThrow: findOwned,
    } as unknown as TripsService;

    service = new CollaboratorsService(prisma, usersService, tripsService);
  });

  it('requires trip ownership before collaborator access', async () => {
    findOwned.mockRejectedValue(new NotFoundException());

    await expect(service.findAll('owner-1', 'trip-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects unknown users and the trip owner', async () => {
    findByEmail.mockResolvedValue(null);

    await expect(
      service.add('owner-1', 'trip-1', {
        email: 'missing@example.com',
        role: 'VIEWER',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    findByEmail.mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
    });

    await expect(
      service.add('owner-1', 'trip-1', {
        email: 'owner@example.com',
        role: 'VIEWER',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate collaborators', async () => {
    findByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'user@example.com',
    });

    findMember.mockResolvedValue({
      id: 'member-1',
    });

    await expect(
      service.add('owner-1', 'trip-1', {
        email: 'user@example.com',
        role: 'EDITOR',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a collaborator when membership is valid', async () => {
    findByEmail.mockResolvedValue({
      id: 'user-2',
      email: 'user@example.com',
    });

    findMember.mockResolvedValue(null);

    createMember.mockResolvedValue({
      id: 'member-1',
      tripId: 'trip-1',
      userId: 'user-2',
      role: 'EDITOR',
    });

    await service.add('owner-1', 'trip-1', {
      email: 'user@example.com',
      role: 'EDITOR',
    });

    expect(createMember).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when an update or removal targets a foreign or missing member', async () => {
    updateMembers.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.updateRole('owner-1', 'trip-1', 'member-x', {
        role: 'VIEWER',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    deleteMembers.mockResolvedValue({
      count: 0,
    });

    await expect(service.remove('owner-1', 'trip-1', 'member-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates and removes an existing collaborator', async () => {
    updateMembers.mockResolvedValue({
      count: 1,
    });

    findMember.mockResolvedValue({
      id: 'member-1',
      tripId: 'trip-1',
      userId: 'user-2',
      role: 'VIEWER',
    });

    await expect(
      service.updateRole('owner-1', 'trip-1', 'member-1', {
        role: 'VIEWER',
      }),
    ).resolves.toMatchObject({
      role: 'VIEWER',
    });

    deleteMembers.mockResolvedValue({
      count: 1,
    });

    await expect(service.remove('owner-1', 'trip-1', 'member-1')).resolves.toBeUndefined();
  });
});
