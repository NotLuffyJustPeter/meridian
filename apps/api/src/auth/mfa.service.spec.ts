import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { MfaService } from './mfa.service';

type FindMock = jest.MockedFunction<(input: unknown) => Promise<unknown>>;

type CountMock = jest.MockedFunction<(input: unknown) => Promise<number>>;

type CountResultMock = jest.MockedFunction<
  (input: unknown) => Promise<{
    count: number;
  }>
>;

describe('MfaService', () => {
  let service: MfaService;

  let findCredential: FindMock;

  let findChallenge: FindMock;

  let deleteChallenges: CountResultMock;

  let createChallenge: FindMock;

  let countRecoveryCodes: CountMock;

  beforeEach(() => {
    findCredential = jest.fn<(input: unknown) => Promise<unknown>>();

    findChallenge = jest.fn<(input: unknown) => Promise<unknown>>();

    deleteChallenges = jest.fn<
      (input: unknown) => Promise<{
        count: number;
      }>
    >(() =>
      Promise.resolve({
        count: 1,
      }),
    );

    createChallenge = jest.fn<(input: unknown) => Promise<unknown>>(() => Promise.resolve({}));

    countRecoveryCodes = jest.fn<(input: unknown) => Promise<number>>(() => Promise.resolve(0));

    const updateChallenge = jest.fn<(input: unknown) => Promise<unknown>>(() =>
      Promise.resolve({}),
    );

    const prisma = {
      totpCredential: {
        findUnique: findCredential,
      },
      mfaRecoveryCode: {
        count: countRecoveryCodes,
      },
      mfaChallenge: {
        findUnique: findChallenge,
        deleteMany: deleteChallenges,
        create: createChallenge,
        update: updateChallenge,
      },
    } as unknown as PrismaService;

    const get = jest.fn<(key: string) => string | undefined>((key) => {
      if (key === 'MFA_ENCRYPTION_KEY') {
        return Buffer.alloc(32, 5).toString('base64');
      }

      return undefined;
    });

    const config = {
      get,
    } as unknown as ConfigService;

    service = new MfaService(prisma, config);
  });

  it('reports disabled MFA when no enabled credential exists', async () => {
    findCredential.mockResolvedValue(null);

    await expect(service.getStatus('user-1')).resolves.toEqual({
      enabled: false,
      recoveryCodesRemaining: 0,
    });
  });

  it('reports remaining recovery codes for enabled MFA', async () => {
    findCredential.mockResolvedValue({
      id: 'credential-1',
      enabledAt: new Date(),
    });

    countRecoveryCodes.mockResolvedValue(7);

    await expect(service.getStatus('user-1')).resolves.toEqual({
      enabled: true,
      recoveryCodesRemaining: 7,
    });
  });

  it('detects whether MFA is enabled', async () => {
    findCredential.mockResolvedValue({
      enabledAt: new Date(),
    });

    await expect(service.isEnabled('user-1')).resolves.toBe(true);

    findCredential.mockResolvedValue({
      enabledAt: null,
    });

    await expect(service.isEnabled('user-1')).resolves.toBe(false);
  });

  it('refuses to start a second enrollment when MFA is already enabled', async () => {
    findCredential.mockResolvedValue({
      enabledAt: new Date(),
    });

    await expect(service.startEnrollment('user-1', 'user@example.com')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a hashed, expiring login challenge', async () => {
    const token = await service.createLoginChallenge('user-1');

    expect(token.length).toBeGreaterThan(20);

    expect(deleteChallenges).toHaveBeenCalledTimes(1);

    const firstCall = createChallenge.mock.calls[0];

    expect(firstCall).toBeDefined();

    const createArg = firstCall?.[0] as {
      data: {
        tokenHash: string;
        expiresAt: Date;
      };
    };

    expect(createArg.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(createArg.data.tokenHash).not.toBe(token);

    expect(createArg.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects missing, expired, or consumed MFA challenges', async () => {
    findChallenge.mockResolvedValue(null);

    await expect(service.verifyLoginChallenge('missing', '123456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    findChallenge.mockResolvedValue({
      id: 'challenge-1',
      userId: 'user-1',
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });

    await expect(service.verifyLoginChallenge('consumed', '123456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    findChallenge.mockResolvedValue({
      id: 'challenge-2',
      userId: 'user-1',
      consumedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      attempts: 0,
    });

    await expect(service.verifyLoginChallenge('expired', '123456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects recovery-code regeneration and disable operations when MFA is not enabled', async () => {
    findCredential.mockResolvedValue(null);

    await expect(service.regenerateRecoveryCodes('user-1', 'code')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(service.disable('user-1', 'code')).rejects.toBeInstanceOf(BadRequestException);
  });
});
