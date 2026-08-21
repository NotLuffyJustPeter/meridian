import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { GEOCODING_PROVIDER } from './geocoding.types';
import type { GeocodingProvider, GeocodingSearchResponse } from './geocoding.types';

@Injectable()
export class GeocodingService {
  constructor(
    @Inject(GEOCODING_PROVIDER)
    private readonly provider: GeocodingProvider,
  ) {}

  async search(query: string): Promise<GeocodingSearchResponse> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    if (normalizedQuery.length < 3) {
      throw new BadRequestException('Search query must contain at least 3 characters');
    }

    return this.provider.search(normalizedQuery);
  }
}
