import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { trace } from '@opentelemetry/api';
import Redis from 'ioredis';

import { buildCacheKey } from './cache-key';

type CacheLookup<T> =
  | {
      hit: true;
      value: T;
    }
  | {
      hit: false;
    };

const cacheTracer = trace.getTracer('meridian-cache');

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  private readonly redis: Redis | null;

  private readonly inFlight = new Map<string, Promise<unknown>>();

  private redisUnavailableLogged = false;

  constructor(configService: ConfigService) {
    const redisUrl = configService.get<string>('REDIS_URL')?.trim();

    if (!redisUrl) {
      this.redis = null;

      return;
    }

    this.redis = new Redis(redisUrl, {
      enableOfflineQueue: false,

      maxRetriesPerRequest: 1,

      connectTimeout: 1000,

      retryStrategy(attempts) {
        return Math.min(attempts * 250, 2000);
      },
    });

    this.redis.on('ready', () => {
      if (this.redisUnavailableLogged) {
        this.logger.log('Redis cache connection restored');
      }

      this.redisUnavailableLogged = false;
    });

    this.redis.on('error', () => {
      this.logRedisUnavailable();
    });
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }

  async remember<T>(
    namespace: string,
    keyMaterial: unknown,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const key = buildCacheKey(namespace, keyMaterial);

    const cached = await this.get<T>(namespace, key);

    if (cached.hit) {
      return cached.value;
    }

    const existing = this.inFlight.get(key);

    if (existing) {
      return existing as Promise<T>;
    }

    const pending = (async () => {
      const value = await loader();

      await this.set(namespace, key, value, ttlSeconds);

      return value;
    })();

    this.inFlight.set(key, pending);

    try {
      return await pending;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async get<T>(namespace: string, key: string): Promise<CacheLookup<T>> {
    if (!this.redis) {
      return {
        hit: false,
      };
    }

    return cacheTracer.startActiveSpan(
      `cache.get ${namespace}`,
      async (span): Promise<CacheLookup<T>> => {
        span.setAttribute('meridian.cache.namespace', namespace);

        span.setAttribute('meridian.cache.backend', 'redis');

        try {
          const raw = await this.redis?.get(key);

          if (raw === null || raw === undefined) {
            span.setAttribute('meridian.cache.hit', false);

            return {
              hit: false,
            };
          }

          try {
            const value = JSON.parse(raw) as T;

            span.setAttribute('meridian.cache.hit', true);

            return {
              hit: true,
              value,
            };
          } catch {
            span.addEvent('cache.decode_error');

            try {
              await this.redis?.del(key);
            } catch {
              // Fail open.
            }

            return {
              hit: false,
            };
          }
        } catch {
          span.setAttribute('meridian.cache.hit', false);

          span.setAttribute('meridian.cache.fail_open', true);

          span.addEvent('cache.backend_error');

          this.logRedisUnavailable();

          return {
            hit: false,
          };
        } finally {
          span.end();
        }
      },
    );
  }

  private async set<T>(
    namespace: string,
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    await cacheTracer.startActiveSpan(`cache.set ${namespace}`, async (span) => {
      span.setAttribute('meridian.cache.namespace', namespace);

      span.setAttribute('meridian.cache.backend', 'redis');

      span.setAttribute('meridian.cache.ttl_seconds', ttlSeconds);

      try {
        const payload = JSON.stringify(value);

        if (payload === undefined) {
          return;
        }

        await this.redis?.set(key, payload, 'EX', ttlSeconds);
      } catch {
        span.setAttribute('meridian.cache.fail_open', true);

        span.addEvent('cache.backend_error');

        this.logRedisUnavailable();
      } finally {
        span.end();
      }
    });
  }

  private logRedisUnavailable(): void {
    if (this.redisUnavailableLogged) {
      return;
    }

    this.redisUnavailableLogged = true;

    this.logger.warn('Redis cache unavailable; continuing without distributed cache');
  }
}
