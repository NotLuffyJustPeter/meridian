import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { EmailService, type PasswordResetEmail } from './email.service';
import { PasswordResetService } from './password-reset.service';

type UserRecord = {
  id: string;
  email: string;
  name: string;
};

type ResetRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type OneArgAsync = jest.MockedFunction<(input: unknown) => Promise<unknown>>;

type UpdateManyMock = jest.MockedFunction<
  (input: unknown) => Promise<{
    count: number;
  }>
>;

type FindUserMock = jest.MockedFunction<(input: unknown) => Promise<UserRecord | null>>;

type FindResetMock = jest.MockedFunction<(input: unknown) => Promise<ResetRecord | null>>;

type CreateResetMock = jest.MockedFunction<(input: unknown) => Promise<ResetRecord>>;

type SendEmailMock = jest.MockedFunction<(message: PasswordResetEmail) => Promise<void>>;

type TransactionCallback = (tx: unknown) => Promise<unknown>;

type TransactionMock = jest.MockedFunction<(callback: TransactionCallback) => Promise<unknown>>;

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  let findUser: FindUserMock;

  let updateResetTokens: UpdateManyMock;

  let createResetToken: CreateResetMock;

  let findResetToken: FindResetMock;

  let updateUser: OneArgAsync;

  let updateSessions: UpdateManyMock;

  let updateChallenges: UpdateManyMock;

  let sendEmail: SendEmailMock;

  let transaction: TransactionMock;

  const user: UserRecord = {
    id: 'user-1',
    email: 'user@meridian.local',
    name: 'Traveler',
  };

  beforeEach(() => {
    findUser = jest.fn<(input: unknown) => Promise<UserRecord | null>>();

    updateResetTokens = jest.fn<
      (input: unknown) => Promise<{
        count: number;
      }>
    >(() =>
      Promise.resolve({
        count: 1,
      }),
    );

    createResetToken = jest.fn<(input: unknown) => Promise<ResetRecord>>();

    findResetToken = jest.fn<(input: unknown) => Promise<ResetRecord | null>>();

    updateUser = jest.fn<(input: unknown) => Promise<unknown>>(() => Promise.resolve({}));

    updateSessions = jest.fn<
      (input: unknown) => Promise<{
        count: number;
      }>
    >(() =>
      Promise.resolve({
        count: 1,
      }),
    );

    updateChallenges = jest.fn<
      (input: unknown) => Promise<{
        count: number;
      }>
    >(() =>
      Promise.resolve({
        count: 1,
      }),
    );

    sendEmail = jest.fn<(message: PasswordResetEmail) => Promise<void>>(() => Promise.resolve());

    const tx = {
      passwordResetToken: {
        findUnique: findResetToken,
        updateMany: updateResetTokens,
      },
      user: {
        update: updateUser,
      },
      authSession: {
        updateMany: updateSessions,
      },
      mfaChallenge: {
        updateMany: updateChallenges,
      },
    };

    transaction = jest.fn<(callback: TransactionCallback) => Promise<unknown>>((callback) =>
      callback(tx),
    );

    const prisma = {
      user: {
        findUnique: findUser,
      },
      passwordResetToken: {
        updateMany: updateResetTokens,
        create: createResetToken,
      },
      $transaction: transaction,
    } as unknown as PrismaService;

    const get = jest.fn<(key: string) => string | undefined>((key) => {
      if (key === 'APP_ORIGIN') {
        return 'http://localhost:3000/';
      }

      if (key === 'PASSWORD_RESET_TTL_MINUTES') {
        return '20';
      }

      return undefined;
    });

    const config = {
      get,
    } as unknown as ConfigService;

    const emailService = {
      sendPasswordResetEmail: sendEmail,
    } as unknown as EmailService;

    service = new PasswordResetService(prisma, config, emailService);
  });

  it('does not reveal whether an account exists', async () => {
    findUser.mockResolvedValue(null);

    await expect(service.requestReset('missing@meridian.local')).resolves.toBeUndefined();

    expect(createResetToken).not.toHaveBeenCalled();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('normalizes email, invalidates old tokens, and sends a hashed-token reset link', async () => {
    findUser.mockResolvedValue(user);

    createResetToken.mockImplementation((input) => {
      const data = (
        input as {
          data: {
            tokenHash: string;
            expiresAt: Date;
          };
        }
      ).data;

      return Promise.resolve({
        id: 'reset-1',
        userId: user.id,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        usedAt: null,
      });
    });

    await service.requestReset('  USER@MERIDIAN.LOCAL ');

    expect(findUser).toHaveBeenCalledWith({
      where: {
        email: 'user@meridian.local',
      },
    });

    expect(updateResetTokens).toHaveBeenCalled();

    expect(createResetToken).toHaveBeenCalledTimes(1);

    const firstCreateCall = createResetToken.mock.calls[0];

    expect(firstCreateCall).toBeDefined();

    const createArg = firstCreateCall?.[0] as {
      data: {
        tokenHash: string;
      };
    };

    expect(createArg.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const firstEmailCall = sendEmail.mock.calls[0];

    expect(firstEmailCall).toBeDefined();

    const emailArg = firstEmailCall?.[0];

    expect(emailArg?.resetUrl).toMatch(/^http:\/\/localhost:3000\/reset-password\?token=/);

    expect(emailArg?.resetUrl).not.toContain(createArg.data.tokenHash);
  });

  it('invalidates a newly-created reset token when email delivery fails', async () => {
    findUser.mockResolvedValue(user);

    createResetToken.mockResolvedValue({
      id: 'reset-1',
      userId: user.id,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    sendEmail.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(service.requestReset(user.email)).resolves.toBeUndefined();

    expect(updateResetTokens).toHaveBeenCalledTimes(2);
  });

  it('resets password and revokes active sessions and pending MFA challenges', async () => {
    findResetToken.mockResolvedValue({
      id: 'reset-1',
      userId: user.id,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    updateResetTokens.mockResolvedValue({
      count: 1,
    });

    await service.resetPassword('valid-token', 'NewMeridian123!');

    expect(updateUser).toHaveBeenCalledTimes(1);

    const firstUpdateCall = updateUser.mock.calls[0];

    expect(firstUpdateCall).toBeDefined();

    const updateArg = firstUpdateCall?.[0] as {
      data: {
        passwordHash: string;
      };
    };

    expect(updateArg.data.passwordHash.length).toBeGreaterThan(20);

    expect(updateSessions).toHaveBeenCalledTimes(1);

    expect(updateChallenges).toHaveBeenCalledTimes(1);
  }, 15000);

  it('rejects missing or expired reset tokens', async () => {
    findResetToken.mockResolvedValue(null);

    await expect(service.resetPassword('missing', 'NewMeridian123!')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    findResetToken.mockResolvedValue({
      id: 'reset-expired',
      userId: user.id,
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
    });

    await expect(service.resetPassword('expired', 'NewMeridian123!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  }, 15000);

  it('rejects a reset token that loses a consume race', async () => {
    findResetToken.mockResolvedValue({
      id: 'reset-race',
      userId: user.id,
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    });

    updateResetTokens.mockResolvedValueOnce({
      count: 0,
    });

    await expect(service.resetPassword('race-token', 'NewMeridian123!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  }, 15000);
});
