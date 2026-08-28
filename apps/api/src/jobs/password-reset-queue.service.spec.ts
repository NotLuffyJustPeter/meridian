import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';

import {
  PASSWORD_RESET_BACKOFF_MS,
  PASSWORD_RESET_JOB_ATTEMPTS,
  PASSWORD_RESET_JOB_NAME,
} from './jobs.constants';
import type { EncryptedJobPayload, PasswordResetJobPayload } from './jobs.types';
import { PasswordResetQueueService } from './password-reset-queue.service';
import { QueuePayloadCryptoService } from './queue-payload-crypto.service';

interface QueueJobOptions {
  jobId: string;
  attempts: number;
  backoff: {
    type: string;
    delay: number;
  };
  removeOnComplete: {
    age: number;
    count: number;
  };
  removeOnFail: {
    age: number;
    count: number;
  };
}

type QueueAddStub = (
  name: string,
  data: EncryptedJobPayload,
  options: QueueJobOptions,
) => Promise<{
  id?: string;
}>;

type QueueCloseStub = () => Promise<void>;

interface QueueStub {
  add: QueueAddStub;
  close: QueueCloseStub;
}

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function createCrypto(): QueuePayloadCryptoService {
  return new QueuePayloadCryptoService(
    createConfig({
      QUEUE_ENABLED: 'true',
      QUEUE_PAYLOAD_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString('base64'),
    }),
  );
}

function createService(crypto: QueuePayloadCryptoService): PasswordResetQueueService {
  return new PasswordResetQueueService(
    createConfig({
      QUEUE_ENABLED: 'false',
    }),
    crypto,
  );
}

function injectQueue(service: PasswordResetQueueService, queue: QueueStub): void {
  Object.defineProperty(service, 'queue', {
    configurable: true,
    value: queue,
  });
}

describe('PasswordResetQueueService', () => {
  it('stays disabled when QUEUE_ENABLED is false', async () => {
    const service = createService(createCrypto());

    expect(service.isEnabled()).toBe(false);

    await expect(
      service.enqueuePasswordReset({
        resetTokenId: 'reset-id',
        to: 'user@example.com',
        name: 'User',
        resetUrl: 'https://example.com/reset',
      }),
    ).rejects.toThrow('Password reset queue is disabled');
  });

  it('requires QUEUE_REDIS_URL when queues are enabled', () => {
    expect(
      () =>
        new PasswordResetQueueService(
          createConfig({
            QUEUE_ENABLED: 'true',
          }),
          createCrypto(),
        ),
    ).toThrow('QUEUE_REDIS_URL is required when QUEUE_ENABLED=true');
  });

  it('publishes password reset jobs with retry and cleanup policies', async () => {
    const crypto = createCrypto();

    const service = createService(crypto);

    const addMock = jest.fn<QueueAddStub>();

    const closeMock = jest.fn<QueueCloseStub>();

    addMock.mockResolvedValue({
      id: 'password-reset-reset-id',
    });

    closeMock.mockResolvedValue(undefined);

    injectQueue(service, {
      add: addMock,
      close: closeMock,
    });

    expect(service.isEnabled()).toBe(true);

    const result = await service.enqueuePasswordReset({
      resetTokenId: 'reset-id',
      to: 'user@example.com',
      name: 'User',
      resetUrl: 'https://example.com/reset?token=secret',
    });

    expect(result).toBe('password-reset-reset-id');

    expect(addMock).toHaveBeenCalledTimes(1);

    const call = addMock.mock.calls[0];

    expect(call).toBeDefined();

    if (!call) {
      throw new Error('Expected Queue.add to have been called');
    }

    const [jobName, encrypted, options] = call;

    expect(jobName).toBe(PASSWORD_RESET_JOB_NAME);

    const decrypted = crypto.decrypt<PasswordResetJobPayload>(encrypted);

    expect(decrypted.resetTokenId).toBe('reset-id');

    expect(decrypted.to).toBe('user@example.com');

    expect(decrypted.name).toBe('User');

    expect(decrypted.resetUrl).toBe('https://example.com/reset?token=secret');

    expect(typeof decrypted.traceContext).toBe('object');

    expect(options).toEqual({
      jobId: 'password-reset-reset-id',

      attempts: PASSWORD_RESET_JOB_ATTEMPTS,

      backoff: {
        type: 'exponential',
        delay: PASSWORD_RESET_BACKOFF_MS,
      },

      removeOnComplete: {
        age: 60 * 60,
        count: 1_000,
      },

      removeOnFail: {
        age: 24 * 60 * 60,
        count: 1_000,
      },
    });
  });

  it('propagates Redis publish failures', async () => {
    const crypto = createCrypto();

    const service = createService(crypto);

    const addMock = jest.fn<QueueAddStub>();

    const closeMock = jest.fn<QueueCloseStub>();

    addMock.mockRejectedValue(new Error('Redis unavailable'));

    closeMock.mockResolvedValue(undefined);

    injectQueue(service, {
      add: addMock,
      close: closeMock,
    });

    await expect(
      service.enqueuePasswordReset({
        resetTokenId: 'reset-id',
        to: 'user@example.com',
        name: 'User',
        resetUrl: 'https://example.com/reset',
      }),
    ).rejects.toThrow('Redis unavailable');
  });

  it('closes the queue during module shutdown', async () => {
    const crypto = createCrypto();

    const service = createService(crypto);

    const addMock = jest.fn<QueueAddStub>();

    const closeMock = jest.fn<QueueCloseStub>();

    closeMock.mockResolvedValue(undefined);

    injectQueue(service, {
      add: addMock,
      close: closeMock,
    });

    await service.onModuleDestroy();

    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
