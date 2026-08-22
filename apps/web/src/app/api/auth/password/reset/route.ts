import {
  NextResponse,
} from 'next/server';

import {
  serverApiFetch,
} from '../../../../../lib/api/server-api';
import {
  clearAuthCookies,
  clearMfaChallengeCookie,
} from '../../../../../lib/auth/auth-cookies';

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
      await serverApiFetch<null>(
        '/api/v1/auth/password/reset',
        {
          method:
            'POST',
          body:
            JSON.stringify(
              body,
            ),
        },
      );

    if (response.ok) {
      await clearAuthCookies();
      await clearMfaChallengeCookie();
    }

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
          'Password recovery service is unavailable',
        error:
          'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
