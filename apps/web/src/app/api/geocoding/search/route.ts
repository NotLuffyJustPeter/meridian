import { NextResponse } from 'next/server';

import type { GeocodingSearchResponse } from '../../../../features/geocoding/types/geocoding.types';
import { authenticatedServerApiFetch } from '../../../../lib/api/authenticated-server-api';

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message: 'Geocoding service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const query = url.searchParams.get('q') ?? '';

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<GeocodingSearchResponse>(
        `/api/v1/geocoding/search?q=${encodeURIComponent(query)}`,
        {
          method: 'GET',
        },
      );

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return serviceUnavailable();
  }
}