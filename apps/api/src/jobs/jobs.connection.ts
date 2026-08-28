import type { ConnectionOptions } from 'bullmq';

export type QueueRedisRole = 'producer' | 'worker';

export function createQueueRedisOptions(redisUrl: string, role: QueueRedisRole): ConnectionOptions {
  const parsed = new URL(redisUrl);

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('QUEUE_REDIS_URL must use redis:// or rediss://');
  }

  const port = parsed.port ? Number(parsed.port) : 6379;

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error('QUEUE_REDIS_URL contains an invalid port');
  }

  const rawDb = parsed.pathname.replace(/^\/+/, '').trim();

  const db = rawDb ? Number(rawDb) : 0;

  if (!Number.isInteger(db) || db < 0) {
    throw new Error('QUEUE_REDIS_URL contains an invalid database number');
  }

  return {
    host: parsed.hostname,

    port,

    db,

    ...(parsed.username
      ? {
          username: decodeURIComponent(parsed.username),
        }
      : {}),

    ...(parsed.password
      ? {
          password: decodeURIComponent(parsed.password),
        }
      : {}),

    maxRetriesPerRequest: role === 'worker' ? null : 1,

    enableReadyCheck: true,

    ...(parsed.protocol === 'rediss:'
      ? {
          tls: {},
        }
      : {}),
  };
}
