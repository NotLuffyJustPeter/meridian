import {
  NextResponse,
} from 'next/server';

import type {
  Itinerary,
} from '../../../../../features/itinerary/types/itinerary.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

type ItineraryRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message:
        'Itinerary service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  _request: Request,
  context: ItineraryRouteContext,
) {
  const { id } =
    await context.params;

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        Itinerary
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/itinerary`,
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
