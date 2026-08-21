import {
  NextResponse,
} from 'next/server';

import type {
  Activity,
  CreateActivityInput,
} from '../../../../../../../../features/itinerary/types/itinerary.types';
import { authenticatedServerApiFetch } from '../../../../../../../../lib/api/authenticated-server-api';

type ActivitiesRouteContext = {
  params: Promise<{
    id: string;
    dayId: string;
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

export async function POST(
  request: Request,
  context: ActivitiesRouteContext,
) {
  const {
    id,
    dayId,
  } =
    await context.params;

  let body:
    CreateActivityInput;

  try {
    body =
      (await request.json()) as CreateActivityInput;
  } catch {
    return NextResponse.json(
      {
        statusCode: 400,
        message:
          'Request body must be valid JSON',
        error: 'Bad Request',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        Activity
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/itinerary/days/${encodeURIComponent(dayId)}/activities`,
        {
          method: 'POST',
          body: JSON.stringify(
            body,
          ),
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