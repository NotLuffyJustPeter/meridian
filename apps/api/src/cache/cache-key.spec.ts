import { buildCacheKey } from './cache-key';

describe('buildCacheKey', () => {
  it('creates deterministic SHA-256 cache keys', () => {
    const first = buildCacheKey('weather.location', {
      query: 'mexico city',
    });

    const second = buildCacheKey('weather.location', {
      query: 'mexico city',
    });

    expect(first).toBe(second);

    expect(first).toMatch(/^meridian:v2:weather\.location:[0-9a-f]{64}$/);
  });

  it('does not expose key material in the Redis key', () => {
    const key = buildCacheKey('geocoding.search', {
      query: 'Aguascalientes, Mexico',
    });

    expect(key).not.toContain('Aguascalientes');

    expect(key).not.toContain('Mexico');
  });

  it('separates namespaces', () => {
    const material = {
      query: 'same-value',
    };

    expect(buildCacheKey('geocoding.search', material)).not.toBe(
      buildCacheKey('weather.location', material),
    );
  });
});
