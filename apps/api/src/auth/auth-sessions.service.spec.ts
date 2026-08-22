import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { AuthSessionsService } from './auth-sessions.service';

type OneArgAsyncMock = jest.MockedFunction<(input: unknown) => Promise<unknown>>;

describe('AuthSessionsService', () => {
  let service: AuthSessionsService;

  let create: OneArgAsyncMock;

  let findUnique: OneArgAsyncMock;

  let update: OneArgAsyncMock;

  beforeEach(() => {
    create = jest.fn<(input: unknown) => Promise<unknown>>(() => Promise.resolve({}));

    findUnique = jest.fn<(input: unknown) => Promise<unknown>>(() => Promise.resolve(null));

    update = jest.fn<(input: unknown) => Promise<unknown>>(() => Promise.resolve({}));

    const prisma = {
      authSession: {
        create,
        findUnique,
        update,
      },
    } as unknown as PrismaService;

    service = new AuthSessionsService(prisma);
  });

  it('creates and reads sessions', async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    await service.create({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash',
      expiresAt,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'hash',
        expiresAt,
      },
    });

    await service.findById('session-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
      },
    });
  });

  it('rotates session hashes and clears revocation', async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    await service.rotate('session-1', 'new-hash', expiresAt);

    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
      },
      data: {
        refreshTokenHash: 'new-hash',
        expiresAt,
        revokedAt: null,
      },
    });
  });

  it('revokes a session with a timestamp', async () => {
    await service.revoke('session-1');

    const firstCall = update.mock.calls[0];

    expect(firstCall).toBeDefined();

    const arg = firstCall?.[0] as {
      data: {
        revokedAt: Date;
      };
    };

    expect(arg.data.revokedAt).toBeInstanceOf(Date);
  });
});
