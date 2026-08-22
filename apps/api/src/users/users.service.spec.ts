import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { UsersService } from './users.service';

type OneArgAsyncMock = jest.MockedFunction<(input: unknown) => Promise<unknown>>;

describe('UsersService', () => {
  let service: UsersService;

  let userFindUnique: OneArgAsyncMock;

  let userFindFirst: OneArgAsyncMock;

  let userCreate: OneArgAsyncMock;

  let userUpdate: OneArgAsyncMock;

  let identityFindUnique: OneArgAsyncMock;

  let identityCreate: OneArgAsyncMock;

  let identityDelete: OneArgAsyncMock;

  beforeEach(() => {
    const createMock = () => jest.fn<(input: unknown) => Promise<unknown>>();

    userFindUnique = createMock();

    userFindFirst = createMock();

    userCreate = createMock();

    userUpdate = createMock();

    identityFindUnique = createMock();

    identityCreate = createMock();

    identityDelete = createMock();

    const prisma = {
      user: {
        findUnique: userFindUnique,
        findFirst: userFindFirst,
        create: userCreate,
        update: userUpdate,
      },
      authIdentity: {
        findUnique: identityFindUnique,
        create: identityCreate,
        delete: identityDelete,
      },
    } as unknown as PrismaService;

    service = new UsersService(prisma);
  });

  it('normalizes email lookups', async () => {
    userFindUnique.mockResolvedValue(null);

    await service.findByEmail('  User@Example.COM ');

    expect(userFindUnique).toHaveBeenCalledWith({
      where: {
        email: 'user@example.com',
      },
    });
  });

  it('queries external identities by provider subject', async () => {
    userFindFirst.mockResolvedValue(null);

    await service.findByExternalIdentity('GOOGLE', 'subject-1');

    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        identities: {
          some: {
            provider: 'GOOGLE',
            providerSubject: 'subject-1',
          },
        },
      },
    });
  });

  it('normalizes and trims password-backed user creation', async () => {
    userCreate.mockResolvedValue({});

    await service.create({
      email: ' User@Example.COM ',
      name: ' Traveler ',
      passwordHash: 'hash',
    });

    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: 'user@example.com',
        name: 'Traveler',
        passwordHash: 'hash',
      },
    });
  });

  it('creates a federated user without a password', async () => {
    userCreate.mockResolvedValue({});

    await service.createWithExternalIdentity({
      email: ' Google@Example.COM ',
      name: ' Traveler ',
      provider: 'GOOGLE',
      providerSubject: 'google-sub',
    });

    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: 'google@example.com',
        name: 'Traveler',
        passwordHash: null,
        identities: {
          create: {
            provider: 'GOOGLE',
            providerSubject: 'google-sub',
          },
        },
      },
    });
  });

  it('creates and deletes explicit external identities', async () => {
    identityCreate.mockResolvedValue({});

    identityDelete.mockResolvedValue({});

    await service.createExternalIdentity({
      userId: 'user-1',
      provider: 'GOOGLE',
      providerSubject: 'google-sub',
    });

    expect(identityCreate).toHaveBeenCalledTimes(1);

    await service.deleteExternalIdentity('identity-1');

    expect(identityDelete).toHaveBeenCalledWith({
      where: {
        id: 'identity-1',
      },
    });
  });

  it('trims profile names before update', async () => {
    userUpdate.mockResolvedValue({});

    await service.updateName('user-1', ' New Name ');

    expect(userUpdate).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        name: 'New Name',
      },
    });
  });
});
