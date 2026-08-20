import { NextResponse } from 'next/server';

import type {
  CreatePlaceInput,
  Place,
} from '../../../../../features/places/types/place.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

type PlacesRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message: 'Places service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  _request: Request,
  context: PlacesRouteContext,
) {
  const { id } =
    await context.params;

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        Place[]
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/places`,
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

export async function POST(
  request: Request,
  context: PlacesRouteContext,
) {
  const { id } =
    await context.params;

  let body:
    CreatePlaceInput;

  try {
    body =
      (await request.json()) as CreatePlaceInput;
  } catch {
    return NextResponse.json(
      {
        statusCode: 400,
        message:
          'Request body must be valid JSON',
        error:
          'Bad Request',
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
        Place
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/places`,
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