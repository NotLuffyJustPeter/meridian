
import { NextResponse } from 'next/server';

import type {
  ApiEnvelope,
  LoginApiData,
} from '../../../../features/auth/types/auth.types';
import { serverApiFetch } from '../../../../lib/api/server-api';
import { setAuthCookies } from '../../../../lib/auth/auth-cookies';

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
      await serverApiFetch<LoginApiData>(
        '/api/v1/auth/google',
        {
          method: 'POST',
          body:
            JSON.stringify(
              body,
            ),
        },
      );

    if (!response.ok) {
      return NextResponse.json(
        payload,
        {
          status:
            response.status,
        },
      );
    }

    const result =
      payload as ApiEnvelope<LoginApiData>;

    await setAuthCookies(
      result.data.accessToken,
      result.data.refreshToken,
    );

    return NextResponse.json(
      {
        data:
          result.data.user,
        meta:
          result.meta,
        message:
          result.message,
      },
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
          'Authentication service is unavailable',
        error:
          'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
