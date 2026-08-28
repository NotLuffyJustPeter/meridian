import type { ConfigService } from '@nestjs/config';

import { CacheService } from './cache.service';

describe('CacheService', () => {
  function createService(): CacheService {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    return new CacheService(configService);
  }

  it('fails open when Redis is not configured', async () => {
    const service = createService();

    const loader = jest.fn().mockResolvedValue({
      value: 42,
    });

    const result = await service.remember(
      'test.namespace',
      {
        id: 'one',
      },
      60,
      loader,
    );

    expect(result).toEqual({
      value: 42,
    });

    expect(loader).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
  });

  it('coalesces concurrent loads for the same cache key', async () => {
    const service = createService();

    let resolveLoader: ((value: string) => void) | undefined;

    const loader = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const first = service.remember(
      'test.namespace',
      {
        id: 'same',
      },
      60,
      loader,
    );

    const second = service.remember(
      'test.namespace',
      {
        id: 'same',
      },
      60,
      loader,
    );

    // Allow both remember() calls to pass the
    // asynchronous cache lookup. The first call
    // starts the loader and registers the in-flight
    // promise before the second continues.
    await Promise.resolve();

    expect(loader).toHaveBeenCalledTimes(1);

    if (!resolveLoader) {
      throw new Error('Loader did not start');
    }

    resolveLoader('loaded');

    await expect(first).resolves.toBe('loaded');

    await expect(second).resolves.toBe('loaded');

    expect(loader).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
  });

  it('does not coalesce different cache keys', async () => {
    const service = createService();

    const loader = jest.fn().mockResolvedValue('loaded');

    await Promise.all([
      service.remember(
        'test.namespace',
        {
          id: 'one',
        },
        60,
        loader,
      ),

      service.remember(
        'test.namespace',
        {
          id: 'two',
        },
        60,
        loader,
      ),
    ]);

    expect(loader).toHaveBeenCalledTimes(2);

    service.onModuleDestroy();
  });
});
