import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CACHE_TTL_DEFAULTS } from '../../cache/cache.constants';
import { CacheService } from '../../cache/cache.service';
import type { GeocodingProvider, GeocodingSearchResponse } from '../geocoding.types';
import { NominatimGeocodingProvider } from './nominatim-geocoding.provider';

@Injectable()
export class CachedGeocodingProvider implements GeocodingProvider {
  constructor(
    private readonly source: NominatimGeocodingProvider,

    private readonly cache: CacheService,

    private readonly configService: ConfigService,
  ) {}

  async search(query: string): Promise<GeocodingSearchResponse> {
    const normalized = query.trim().replace(/\s+/g, ' ').toLowerCase();

    if (!normalized) {
      return this.source.search(query);
    }

    return this.cache.remember(
      'geocoding.search',

      {
        query: normalized,
      },

      this.ttl('CACHE_GEOCODING_TTL_SECONDS', CACHE_TTL_DEFAULTS.geocodingSeconds),

      () => this.source.search(query),
    );
  }

  private ttl(key: string, fallback: number): number {
    const configured = this.configService.get<string | number>(key);

    if (configured === undefined) {
      return fallback;
    }

    return Number(configured);
  }
}
