import { NextResponse } from 'next/server';

import type {
  TripCollaborator,
  UpdateCollaboratorInput,
} from '../../../../../../features/trips/types/trip.types';
import { authenticatedServerApiFetch } from '../../../../../../lib/api/authenticated-server-api';

type CollaboratorRouteContext = {
  params: Promise<{
    id: string;
    memberId: string;
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

export async function PATCH(
  request: Request,
  context: CollaboratorRouteContext,
) {
  const { id, memberId } = await context.params;

  let body: UpdateCollaboratorInput;

  try {
    body = (await request.json()) as UpdateCollaboratorInput;
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
      `/api/v1/trips/${encodeURIComponent(id)}/collaborators/${encodeURIComponent(memberId)}`,
      {
        method: 'PATCH',
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

export async function DELETE(
  _request: Request,
  context: CollaboratorRouteContext,
) {
  const { id, memberId } = await context.params;

  try {
    const { response, payload } = await authenticatedServerApiFetch<never>(
      `/api/v1/trips/${encodeURIComponent(id)}/collaborators/${encodeURIComponent(memberId)}`,
      {
        method: 'DELETE',
      },
    );

    if (response.status === 204) {
      return new NextResponse(null, {
        status: 204,
      });
    }

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return serviceUnavailable();
  }
}
