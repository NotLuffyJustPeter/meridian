import {
  NextResponse,
} from 'next/server';

import type {
  Activity,
  UpdateActivityInput,
} from '../../../../../../../../../features/itinerary/types/itinerary.types';
import { authenticatedServerApiFetch } from '../../../../../../../../../lib/api/authenticated-server-api';

type ActivityRouteContext = {
  params: Promise<{
    id: string;
    dayId: string;
    activityId: string;
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

export async function PATCH(
  request: Request,
  context: ActivityRouteContext,
) {
  const {
    id,
    dayId,
    activityId,
  } =
    await context.params;

  let body:
    UpdateActivityInput;

  try {
    body =
      (await request.json()) as UpdateActivityInput;
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
        `/api/v1/trips/${encodeURIComponent(id)}/itinerary/days/${encodeURIComponent(dayId)}/activities/${encodeURIComponent(activityId)}`,
        {
          method: 'PATCH',
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

export async function DELETE(
  _request: Request,
  context: ActivityRouteContext,
) {
  const {
    id,
    dayId,
    activityId,
  } =
    await context.params;

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        never
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/itinerary/days/${encodeURIComponent(dayId)}/activities/${encodeURIComponent(activityId)}`,
        {
          method: 'DELETE',
        },
      );

    if (
      response.status === 204
    ) {
      return new NextResponse(
        null,
        {
          status: 204,
        },
      );
    }

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