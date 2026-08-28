import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { QUEUE_PAYLOAD_AAD } from './jobs.constants';
import type { EncryptedJobPayload } from './jobs.types';

@Injectable()
export class QueuePayloadCryptoService {
  private readonly key: Buffer | null;

  constructor(configService: ConfigService) {
    const enabled = configService.get<string>('QUEUE_ENABLED')?.trim() === 'true';

    const rawKey = configService.get<string>('QUEUE_PAYLOAD_ENCRYPTION_KEY')?.trim();

    if (!rawKey) {
      if (enabled) {
        throw new Error('QUEUE_PAYLOAD_ENCRYPTION_KEY is required when QUEUE_ENABLED=true');
      }

      this.key = null;

      return;
    }

    const normalized = rawKey.replace(/=+$/, '');

    const decoded = Buffer.from(rawKey, 'base64');

    const roundTrip = decoded.toString('base64').replace(/=+$/, '');

    if (decoded.length !== 32 || roundTrip !== normalized) {
      throw new Error('QUEUE_PAYLOAD_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key');
    }

    this.key = decoded;
  }

  encrypt<T>(value: T): EncryptedJobPayload {
    const key = this.requireKey();

    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', key, iv);

    cipher.setAAD(Buffer.from(QUEUE_PAYLOAD_AAD, 'utf8'));

    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');

    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return {
      version: 1,

      iv: iv.toString('base64'),

      authTag: authTag.toString('base64'),

      ciphertext: ciphertext.toString('base64'),
    };
  }

  decrypt<T>(envelope: EncryptedJobPayload): T {
    if (envelope.version !== 1) {
      throw new Error('Unsupported queue payload version');
    }

    const key = this.requireKey();

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));

    decipher.setAAD(Buffer.from(QUEUE_PAYLOAD_AAD, 'utf8'));

    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString('utf8')) as T;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new Error('Queue payload encryption key is unavailable');
    }

    return this.key;
  }
}
