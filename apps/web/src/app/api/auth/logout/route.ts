import { NextResponse } from 'next/server';

import { serverApiFetch } from '../../../../lib/api/server-api';
import {
  clearAuthCookies,
  getRefreshToken,
} from '../../../../lib/auth/auth-cookies';

export async function POST() {
  const refreshToken =
    await getRefreshToken();

  if (!refreshToken) {
    await clearAuthCookies();

    return NextResponse.json(
      {
        data: null,
        meta: null,
        message:
          'Signed out successfully',
      },
      {
        status: 200,
      },
    );
  }

  try {
    const {
      response,
      payload,
    } = await serverApiFetch<null>(
      '/api/v1/auth/logout',
      {
        method: 'POST',
        body: JSON.stringify({
          refreshToken,
        }),
      },
    );

    await clearAuthCookies();

    if (
      !response.ok &&
      response.status !== 401
    ) {
      return NextResponse.json(
        payload,
        {
          status: response.status,
        },
      );
    }

    return NextResponse.json(
      {
        data: null,
        meta: null,
        message:
          'Signed out successfully',
      },
      {
        status: 200,
      },
    );
  } catch {
    await clearAuthCookies();

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