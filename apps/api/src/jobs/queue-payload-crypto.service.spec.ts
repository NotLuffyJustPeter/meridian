import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';

import type { EncryptedJobPayload } from './jobs.types';
import { QueuePayloadCryptoService } from './queue-payload-crypto.service';

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('QueuePayloadCryptoService', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');

  it('encrypts and decrypts payloads', () => {
    const service = new QueuePayloadCryptoService(
      createConfig({
        QUEUE_ENABLED: 'true',
        QUEUE_PAYLOAD_ENCRYPTION_KEY: encryptionKey,
      }),
    );

    const original = {
      resetTokenId: 'token-123',
      to: 'user@example.com',
      name: 'Meridian User',
      resetUrl: 'https://meridian.local/reset-password?token=super-secret',
      traceContext: {
        traceparent: 'trace-value',
      },
    };

    const encrypted = service.encrypt(original);

    const decrypted = service.decrypt<typeof original>(encrypted);

    expect(decrypted).toEqual(original);
  });

  it('does not store plaintext sensitive values', () => {
    const service = new QueuePayloadCryptoService(
      createConfig({
        QUEUE_ENABLED: 'true',
        QUEUE_PAYLOAD_ENCRYPTION_KEY: encryptionKey,
      }),
    );

    const encrypted = service.encrypt({
      to: 'sensitive@example.com',
      resetUrl: 'https://example.com/reset?token=secret-token',
    });

    const serialized = JSON.stringify(encrypted);

    expect(serialized).not.toContain('sensitive@example.com');

    expect(serialized).not.toContain('secret-token');
  });

  it('rejects a modified authentication tag', () => {
    const service = new QueuePayloadCryptoService(
      createConfig({
        QUEUE_ENABLED: 'true',
        QUEUE_PAYLOAD_ENCRYPTION_KEY: encryptionKey,
      }),
    );

    const encrypted = service.encrypt({
      value: 'protected',
    });

    const tampered: EncryptedJobPayload = {
      ...encrypted,
      authTag: Buffer.alloc(16, 0).toString('base64'),
    };

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects a modified ciphertext', () => {
    const service = new QueuePayloadCryptoService(
      createConfig({
        QUEUE_ENABLED: 'true',
        QUEUE_PAYLOAD_ENCRYPTION_KEY: encryptionKey,
      }),
    );

    const encrypted = service.encrypt({
      value: 'protected',
    });

    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

    if (ciphertext.length === 0) {
      throw new Error('Encrypted ciphertext unexpectedly empty');
    }

    ciphertext[0] = ciphertext[0] ^ 0xff;

    const tampered: EncryptedJobPayload = {
      ...encrypted,
      ciphertext: ciphertext.toString('base64'),
    };

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('requires an encryption key when queues are enabled', () => {
    expect(
      () =>
        new QueuePayloadCryptoService(
          createConfig({
            QUEUE_ENABLED: 'true',
            QUEUE_PAYLOAD_ENCRYPTION_KEY: undefined,
          }),
        ),
    ).toThrow('QUEUE_PAYLOAD_ENCRYPTION_KEY is required when QUEUE_ENABLED=true');
  });

  it('rejects keys that are not exactly 32 bytes', () => {
    const invalidKey = Buffer.alloc(16).toString('base64');

    expect(
      () =>
        new QueuePayloadCryptoService(
          createConfig({
            QUEUE_ENABLED: 'true',
            QUEUE_PAYLOAD_ENCRYPTION_KEY: invalidKey,
          }),
        ),
    ).toThrow('QUEUE_PAYLOAD_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key');
  });

  it('allows startup without a key when queues are disabled', () => {
    const service = new QueuePayloadCryptoService(
      createConfig({
        QUEUE_ENABLED: 'false',
        QUEUE_PAYLOAD_ENCRYPTION_KEY: undefined,
      }),
    );

    expect(() =>
      service.encrypt({
        value: 'test',
      }),
    ).toThrow('Queue payload encryption key is unavailable');
  });
});
