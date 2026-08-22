import {
  NextResponse,
} from 'next/server';

import type {
  PublicUser,
} from '../../../../features/auth/types/auth.types';
import {
  authenticatedServerApiFetch,
} from '../../../../lib/api/authenticated-server-api';

export async function PATCH(
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
      await authenticatedServerApiFetch<PublicUser>(
        '/api/v1/auth/profile',
        {
          method:
            'PATCH',
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
          'Profile service is unavailable',
        error:
          'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
