import {
  NextResponse,
} from 'next/server';

import type {
  Trip,
  UpdateTripInput,
} from '../../../../features/trips/types/trip.types';
import { authenticatedServerApiFetch } from '../../../../lib/api/authenticated-server-api';

type TripRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message:
        'Trips service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  _request: Request,
  context: TripRouteContext,
) {
  const { id } =
    await context.params;

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        Trip
      >(
        `/api/v1/trips/${encodeURIComponent(id)}`,
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

export async function PATCH(
  request: Request,
  context: TripRouteContext,
) {
  const { id } =
    await context.params;

  let body: UpdateTripInput;

  try {
    body =
      (await request.json()) as UpdateTripInput;
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
        Trip
      >(
        `/api/v1/trips/${encodeURIComponent(id)}`,
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
  context: TripRouteContext,
) {
  const { id } =
    await context.params;

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        never
      >(
        `/api/v1/trips/${encodeURIComponent(id)}`,
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