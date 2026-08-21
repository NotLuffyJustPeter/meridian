import {
  NextResponse,
} from 'next/server';

import type {
  CreateTripInput,
  Trip,
} from '../../../features/trips/types/trip.types';
import { authenticatedServerApiFetch } from '../../../lib/api/authenticated-server-api';

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

export async function GET() {
  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<
        Trip[]
      >(
        '/api/v1/trips',
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
) {
  let body: CreateTripInput;

  try {
    body =
      (await request.json()) as CreateTripInput;
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
        '/api/v1/trips',
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