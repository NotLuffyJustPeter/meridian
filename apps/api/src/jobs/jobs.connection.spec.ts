import { describe, expect, it } from '@jest/globals';

import { createQueueRedisOptions } from './jobs.connection';

interface QueueRedisOptionsView {
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest: number | null;
  enableReadyCheck: boolean;
  tls?: Record<string, never>;
}

function asQueueRedisOptions(value: unknown): QueueRedisOptionsView {
  return value as QueueRedisOptionsView;
}

describe('createQueueRedisOptions', () => {
  it('builds producer connection options from a Redis URL', () => {
    const result = asQueueRedisOptions(
      createQueueRedisOptions('redis://localhost:6380/2', 'producer'),
    );

    expect(result).toMatchObject({
      host: 'localhost',
      port: 6380,
      db: 2,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
    });
  });

  it('uses BullMQ-compatible worker retry configuration', () => {
    const result = asQueueRedisOptions(createQueueRedisOptions('redis://localhost:6379', 'worker'));

    expect(result.maxRetriesPerRequest).toBeNull();
  });

  it('supports username and password credentials', () => {
    const result = asQueueRedisOptions(
      createQueueRedisOptions('redis://meridian:secret%20password@localhost:6379/3', 'producer'),
    );

    expect(result).toMatchObject({
      host: 'localhost',
      port: 6379,
      db: 3,
      username: 'meridian',
      password: 'secret password',
    });
  });

  it('enables TLS for rediss URLs', () => {
    const result = asQueueRedisOptions(
      createQueueRedisOptions('rediss://queue.example.com:6380/1', 'worker'),
    );

    expect(result.host).toBe('queue.example.com');
    expect(result.port).toBe(6380);
    expect(result.db).toBe(1);
    expect(result.tls).toEqual({});
  });

  it('rejects unsupported protocols', () => {
    expect(() => createQueueRedisOptions('http://localhost:6379', 'producer')).toThrow(
      'QUEUE_REDIS_URL must use redis:// or rediss://',
    );
  });

  it('rejects invalid ports', () => {
    expect(() => createQueueRedisOptions('redis://localhost:0', 'producer')).toThrow(
      'QUEUE_REDIS_URL contains an invalid port',
    );
  });

  it('rejects invalid database numbers', () => {
    expect(() => createQueueRedisOptions('redis://localhost:6379/-1', 'producer')).toThrow(
      'QUEUE_REDIS_URL contains an invalid database number',
    );
  });

  it('defaults to Redis database zero', () => {
    const result = asQueueRedisOptions(
      createQueueRedisOptions('redis://localhost:6379', 'producer'),
    );

    expect(result.db).toBe(0);
  });
});
