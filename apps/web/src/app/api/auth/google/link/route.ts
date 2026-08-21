import { NextResponse } from 'next/server';

import type { SecurityStatus } from '../../../../../features/auth/types/auth.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

export async function POST(
  request: Request,
) {
  let body: unknown;

  try {
    body =
      await request.json();
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
      await authenticatedServerApiFetch<SecurityStatus>(
        '/api/v1/auth/google/link',
        {
          method: 'POST',
          body:
            JSON.stringify(
              body,
            ),
        },
      );

    return NextResponse.json(
      payload,
      {
        status:
          response.status,
      },
    );
  } catch {
    return NextResponse.json(
      {
        statusCode: 502,
        message:
          'Google account linking service is unavailable',
        error:
          'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}

export async function DELETE() {
  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<SecurityStatus>(
        '/api/v1/auth/google/link',
        {
          method:
            'DELETE',
        },
      );

    return NextResponse.json(
      payload,
      {
        status:
          response.status,
      },
    );
  } catch {
    return NextResponse.json(
      {
        statusCode: 502,
        message:
          'Google account linking service is unavailable',
        error:
          'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
