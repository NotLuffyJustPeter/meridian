import {
  NextResponse,
} from 'next/server';

import type {
  TripWeather,
} from '../../../../../features/weather/types/weather.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

type WeatherRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message:
        'Weather service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  _request: Request,
  context: WeatherRouteContext,
) {
  const { id } =
    await context.params;

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        TripWeather
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/weather`,
        {
          method: 'GET',
        },
      );

    return NextResponse.json(
      payload,
      {
        status: response.status,
      },
    );
  } catch {
    return serviceUnavailable();
  }
}
