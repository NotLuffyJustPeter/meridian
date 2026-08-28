import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';

import { EmailService } from '../../auth/email.service';
import { PrismaService } from '../../database/prisma.service';
import { PASSWORD_RESET_JOB_NAME } from '../jobs.constants';
import type { EncryptedJobPayload, PasswordResetJobPayload } from '../jobs.types';
import { QueuePayloadCryptoService } from '../queue-payload-crypto.service';
import { PasswordResetMailWorker } from './password-reset-mail.worker';

interface ResetTokenState {
  usedAt: Date | null;
  expiresAt: Date;
}

interface FindUniqueInput {
  where: {
    id: string;
  };
  select: {
    usedAt: true;
    expiresAt: true;
  };
}

interface UpdateManyInput {
  where: {
    id: string;
    usedAt: null;
  };
  data: {
    usedAt: Date;
  };
}

interface PasswordResetEmailInput {
  to: string;
  name: string;
  resetUrl: string;
}

type FindUniqueStub = (input: FindUniqueInput) => Promise<ResetTokenState | null>;

type UpdateManyStub = (input: UpdateManyInput) => Promise<{
  count: number;
}>;

type SendPasswordResetEmailStub = (input: PasswordResetEmailInput) => Promise<void>;

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function createJob(
  data: EncryptedJobPayload,
  options?: {
    attemptsMade?: number;
    attempts?: number;
    name?: string;
  },
): Job<EncryptedJobPayload> {
  return {
    id: 'password-reset-reset-id',

    name: options?.name ?? PASSWORD_RESET_JOB_NAME,

    data,

    attemptsMade: options?.attemptsMade ?? 0,

    opts: {
      attempts: options?.attempts ?? 4,
    },
  } as unknown as Job<EncryptedJobPayload>;
}

function processJob(worker: PasswordResetMailWorker, job: Job<EncryptedJobPayload>): Promise<void> {
  const processor = worker as unknown as {
    process(currentJob: Job<EncryptedJobPayload>): Promise<void>;
  };

  return processor.process(job);
}

describe('PasswordResetMailWorker', () => {
  const encryptionKey = Buffer.alloc(32, 9).toString('base64');

  const payload: PasswordResetJobPayload = {
    resetTokenId: 'reset-id',
    to: 'user@example.com',
    name: 'Meridian User',
    resetUrl: 'https://example.com/reset?token=secret',
    traceContext: {},
  };

  function createFixture(): {
    crypto: QueuePayloadCryptoService;
    worker: PasswordResetMailWorker;
    findUniqueMock: ReturnType<typeof jest.fn<FindUniqueStub>>;
    updateManyMock: ReturnType<typeof jest.fn<UpdateManyStub>>;
    sendEmailMock: ReturnType<typeof jest.fn<SendPasswordResetEmailStub>>;
  } {
    const config = createConfig({
      QUEUE_ENABLED: 'true',
      QUEUE_PAYLOAD_ENCRYPTION_KEY: encryptionKey,
    });

    const crypto = new QueuePayloadCryptoService(config);

    const findUniqueMock = jest.fn<FindUniqueStub>();

    const updateManyMock = jest.fn<UpdateManyStub>();

    const sendEmailMock = jest.fn<SendPasswordResetEmailStub>();

    const prisma = {
      passwordResetToken: {
        findUnique: findUniqueMock,
        updateMany: updateManyMock,
      },
    };

    const emailService = {
      sendPasswordResetEmail: sendEmailMock,
    };

    const worker = new PasswordResetMailWorker(
      config,
      crypto,
      emailService as unknown as EmailService,
      prisma as unknown as PrismaService,
    );

    return {
      crypto,
      worker,
      findUniqueMock,
      updateManyMock,
      sendEmailMock,
    };
  }

  it('sends email for a valid reset token', async () => {
    const fixture = createFixture();

    fixture.findUniqueMock.mockResolvedValue({
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    fixture.sendEmailMock.mockResolvedValue(undefined);

    const job = createJob(fixture.crypto.encrypt(payload));

    await processJob(fixture.worker, job);

    expect(fixture.findUniqueMock).toHaveBeenCalledWith({
      where: {
        id: 'reset-id',
      },

      select: {
        usedAt: true,
        expiresAt: true,
      },
    });

    expect(fixture.sendEmailMock).toHaveBeenCalledWith({
      to: 'user@example.com',
      name: 'Meridian User',
      resetUrl: 'https://example.com/reset?token=secret',
    });
  });

  it('skips missing reset tokens', async () => {
    const fixture = createFixture();

    fixture.findUniqueMock.mockResolvedValue(null);

    const job = createJob(fixture.crypto.encrypt(payload));

    await processJob(fixture.worker, job);

    expect(fixture.sendEmailMock).not.toHaveBeenCalled();
  });

  it('skips already-used reset tokens', async () => {
    const fixture = createFixture();

    fixture.findUniqueMock.mockResolvedValue({
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const job = createJob(fixture.crypto.encrypt(payload));

    await processJob(fixture.worker, job);

    expect(fixture.sendEmailMock).not.toHaveBeenCalled();
  });

  it('skips expired reset tokens', async () => {
    const fixture = createFixture();

    fixture.findUniqueMock.mockResolvedValue({
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const job = createJob(fixture.crypto.encrypt(payload));

    await processJob(fixture.worker, job);

    expect(fixture.sendEmailMock).not.toHaveBeenCalled();
  });

  it('throws on SMTP failure so BullMQ can retry', async () => {
    const fixture = createFixture();

    fixture.findUniqueMock.mockResolvedValue({
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    fixture.sendEmailMock.mockRejectedValue(new Error('SMTP unavailable'));

    const job = createJob(fixture.crypto.encrypt(payload), {
      attemptsMade: 0,
      attempts: 4,
    });

    await expect(processJob(fixture.worker, job)).rejects.toThrow('SMTP unavailable');

    expect(fixture.updateManyMock).not.toHaveBeenCalled();
  });

  it('invalidates token after the final failed attempt', async () => {
    const fixture = createFixture();

    fixture.findUniqueMock.mockResolvedValue({
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    fixture.sendEmailMock.mockRejectedValue(new Error('SMTP unavailable'));

    const job = createJob(fixture.crypto.encrypt(payload), {
      attemptsMade: 3,
      attempts: 4,
    });

    await expect(processJob(fixture.worker, job)).rejects.toThrow('SMTP unavailable');

    expect(fixture.updateManyMock).toHaveBeenCalledTimes(1);

    const call = fixture.updateManyMock.mock.calls[0];

    expect(call).toBeDefined();

    if (!call) {
      throw new Error('Expected password reset token invalidation');
    }

    const [input] = call;

    expect(input.where).toEqual({
      id: 'reset-id',
      usedAt: null,
    });

    expect(input.data.usedAt).toBeInstanceOf(Date);
  });

  it('rejects unsupported job types', async () => {
    const fixture = createFixture();

    const job = createJob(fixture.crypto.encrypt(payload), {
      name: 'unsupported-job',
    });

    await expect(processJob(fixture.worker, job)).rejects.toThrow('Unsupported mail job');

    expect(fixture.sendEmailMock).not.toHaveBeenCalled();
  });
});
