import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { NominatimGeocodingProvider } from './nominatim-geocoding.provider';

describe('NominatimGeocodingProvider', () => {
  let provider: NominatimGeocodingProvider;

  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    const config = {
      get: <T>(key: string): T | undefined => {
        if (key === 'GEOCODING_BASE_URL') {
          return 'https://nominatim.openstreetmap.org' as T;
        }

        if (key === 'GEOCODING_USER_AGENT') {
          return 'MeridianTest/1.0' as T;
        }

        return undefined;
      },
    } as unknown as ConfigService;

    provider = new NominatimGeocodingProvider(config);

    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('normalizes a successful geocoding response', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            place_id: 123,
            osm_type: 'node',
            osm_id: 456,
            lat: '35.6762',
            lon: '139.6503',
            display_name: 'Tokyo, Japan',
            category: 'place',
            type: 'city',
            namedetails: {
              name: 'Tokyo',
            },
          },
        ]),
        {
          status: 200,
        },
      ),
    );

    const result = await provider.search('Tokyo');

    expect(result.results).toHaveLength(1);

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        name: 'Tokyo',
        latitude: 35.6762,
        longitude: 139.6503,
      }),
    );

    const init = fetchSpy.mock.calls[0]?.[1];

    expect(init?.signal).toBeDefined();
  });

  it('converts network or timeout failures into a safe 503 error', async () => {
    fetchSpy.mockRejectedValue(new Error('connection reset'));

    await expect(provider.search('Osaka')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects invalid upstream JSON safely', async () => {
    fetchSpy.mockResolvedValue(
      new Response('<html>broken</html>', {
        status: 200,
      }),
    );

    await expect(provider.search('Kyoto')).rejects.toThrow(
      'Geocoding provider returned an invalid response',
    );
  });
});
