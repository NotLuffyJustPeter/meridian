import { NextResponse } from 'next/server';

import type { PublicUser } from '../../../../features/auth/types/auth.types';
import { serverApiFetch } from '../../../../lib/api/server-api';

export async function POST(
  request: Request,
) {
  let body: unknown;

  try {
    body = await request.json();
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
      await serverApiFetch<PublicUser>(
        '/api/v1/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
      );

    return NextResponse.json(
      payload,
      {
        status: response.status,
      },
    );
  } catch {
    return NextResponse.json(
      {
        statusCode: 502,
        message:
          'Authentication service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}