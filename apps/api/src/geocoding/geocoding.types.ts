export interface GeocodingResult {
  provider: string;
  providerPlaceId: string;

  name: string;
  displayName: string;

  latitude: number;
  longitude: number;

  category: string | null;
  type: string | null;

  website: string | null;
}

export interface GeocodingSearchResponse {
  provider: string;

  attribution: string;

  results: GeocodingResult[];
}

export interface GeocodingProvider {
  search(query: string): Promise<GeocodingSearchResponse>;
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
