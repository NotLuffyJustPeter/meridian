import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  GeocodingProvider,
  GeocodingResult,
  GeocodingSearchResponse,
} from '../geocoding.types';

interface NominatimResult {
  place_id?: number;

  osm_type?: string;
  osm_id?: number;

  lat?: string;
  lon?: string;

  display_name?: string;

  category?: string;
  type?: string;

  extratags?: {
    website?: string;
    contact_website?: string;
  };

  namedetails?: {
    name?: string;
    official_name?: string;
  };
}

interface CachedSearch {
  expiresAt: number;

  response: GeocodingSearchResponse;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const MIN_REQUEST_INTERVAL_MS = 1100;

@Injectable()
export class NominatimGeocodingProvider implements GeocodingProvider {
  private readonly baseUrl: string;

  private readonly userAgent: string;

  private readonly cache = new Map<string, CachedSearch>();

  private requestQueue: Promise<void> = Promise.resolve();

  private lastRequestAt = 0;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('GEOCODING_BASE_URL') ?? 'https://nominatim.openstreetmap.org';

    this.userAgent =
      this.configService.get<string>('GEOCODING_USER_AGENT') ?? 'MeridianTravelPlanner/0.1';
  }

  async search(query: string): Promise<GeocodingSearchResponse> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    const cacheKey = normalizedQuery.toLocaleLowerCase();

    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.response;
    }

    const response = await this.executeRateLimited(() => this.requestSearch(normalizedQuery));

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,

      response,
    });

    return response;
  }

  private async requestSearch(query: string): Promise<GeocodingSearchResponse> {
    const url = new URL('/search', this.baseUrl);

    url.searchParams.set('q', query);

    url.searchParams.set('format', 'jsonv2');

    url.searchParams.set('limit', '5');

    url.searchParams.set('addressdetails', '1');

    url.searchParams.set('extratags', '1');

    url.searchParams.set('namedetails', '1');

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',

        headers: {
          accept: 'application/json',

          'accept-language': 'en,es;q=0.9',

          'user-agent': this.userAgent,
        },
      });
    } catch {
      throw new ServiceUnavailableException('Geocoding provider is unavailable');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Geocoding provider is unavailable');
    }

    let payload: unknown;

    try {
      payload = (await response.json()) as unknown;
    } catch {
      throw new ServiceUnavailableException('Geocoding provider returned an invalid response');
    }

    if (!Array.isArray(payload)) {
      throw new ServiceUnavailableException('Geocoding provider returned an invalid response');
    }

    const results = payload
      .map((raw): GeocodingResult | null => this.normalizeResult(raw))
      .filter((result): result is GeocodingResult => result !== null);

    return {
      provider: 'nominatim',

      attribution: '© OpenStreetMap contributors',

      results,
    };
  }

  private normalizeResult(value: unknown): GeocodingResult | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const raw = value as NominatimResult;

    const latitude = Number(raw.lat);

    const longitude = Number(raw.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !raw.display_name) {
      return null;
    }

    const providerPlaceId =
      raw.osm_type && typeof raw.osm_id === 'number'
        ? `${raw.osm_type}:${raw.osm_id}`
        : String(raw.place_id ?? raw.display_name);

    const name =
      raw.namedetails?.name ??
      raw.namedetails?.official_name ??
      raw.display_name.split(',')[0]?.trim() ??
      raw.display_name;

    const website = raw.extratags?.website ?? raw.extratags?.contact_website ?? null;

    return {
      provider: 'nominatim',

      providerPlaceId,

      name,

      displayName: raw.display_name,

      latitude,

      longitude,

      category: raw.category ?? null,

      type: raw.type ?? null,

      website,
    };
  }

  private async executeRateLimited<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.requestQueue.catch(() => undefined);

    let release: () => void = () => undefined;

    this.requestQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      const elapsed = Date.now() - this.lastRequestAt;

      const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;

      if (waitTime > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, waitTime);
        });
      }

      this.lastRequestAt = Date.now();

      return await operation();
    } finally {
      release();
    }
  }
}
