import { NextResponse } from 'next/server';

import type {
  AddCollaboratorInput,
  TripCollaborator,
} from '../../../../../features/trips/types/trip.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

type CollaboratorsRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message: 'Collaborators service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  _request: Request,
  context: CollaboratorsRouteContext,
) {
  const { id } = await context.params;

  try {
    const { response, payload } = await authenticatedServerApiFetch<TripCollaborator[]>(
      `/api/v1/trips/${encodeURIComponent(id)}/collaborators`,
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

export async function POST(
  request: Request,
  context: CollaboratorsRouteContext,
) {
  const { id } = await context.params;

  let body: AddCollaboratorInput;

  try {
    body = (await request.json()) as AddCollaboratorInput;
  } catch {
    return NextResponse.json(
      {
        statusCode: 400,
        message: 'Request body must be valid JSON',
        error: 'Bad Request',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const { response, payload } = await authenticatedServerApiFetch<TripCollaborator>(
      `/api/v1/trips/${encodeURIComponent(id)}/collaborators`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return serviceUnavailable();
  }
}
