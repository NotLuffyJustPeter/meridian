import { NextResponse } from 'next/server';

import type {
  Place,
  UpdatePlaceInput,
} from '../../../../../../features/places/types/place.types';
import { authenticatedServerApiFetch } from '../../../../../../lib/api/authenticated-server-api';

type PlaceRouteContext = {
  params: Promise<{
    id: string;
    placeId: string;
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
  context: PlaceRouteContext,
) {
  const {
    id,
    placeId,
  } =
    await context.params;

  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        Place
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/places/${encodeURIComponent(placeId)}`,
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
  context: PlaceRouteContext,
) {
  const {
    id,
    placeId,
  } =
    await context.params;

  let body:
    UpdatePlaceInput;

  try {
    body =
      (await request.json()) as UpdatePlaceInput;
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
        `/api/v1/trips/${encodeURIComponent(id)}/places/${encodeURIComponent(placeId)}`,
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
  context: PlaceRouteContext,
) {
  const {
    id,
    placeId,
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
        `/api/v1/trips/${encodeURIComponent(id)}/places/${encodeURIComponent(placeId)}`,
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