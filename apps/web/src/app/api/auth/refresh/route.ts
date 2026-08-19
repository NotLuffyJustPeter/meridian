import { NextResponse } from 'next/server';

import type {
  ApiEnvelope,
  RefreshApiData,
} from '../../../../features/auth/types/auth.types';
import { serverApiFetch } from '../../../../lib/api/server-api';
import {
  clearAuthCookies,
  getRefreshToken,
  setAuthCookies,
} from '../../../../lib/auth/auth-cookies';

export async function POST() {
  const refreshToken =
    await getRefreshToken();

  if (!refreshToken) {
    await clearAuthCookies();

    return NextResponse.json(
      {
        statusCode: 401,
        message:
          'Authentication required',
        error: 'Unauthorized',
      },
      {
        status: 401,
      },
    );
  }

  try {
    const {
      response,
      payload,
    } =
      await serverApiFetch<RefreshApiData>(
        '/api/v1/auth/refresh',
        {
          method: 'POST',
          body: JSON.stringify({
            refreshToken,
          }),
        },
      );

    if (!response.ok) {
      if (response.status === 401) {
        await clearAuthCookies();
      }

      return NextResponse.json(
        payload,
        {
          status: response.status,
        },
      );
    }

    const result =
      payload as ApiEnvelope<RefreshApiData>;

    await setAuthCookies(
      result.data.accessToken,
      result.data.refreshToken,
    );

    return NextResponse.json(
      {
        data: null,
        meta: null,
        message:
          'Session refreshed successfully',
      },
      {
        status: 200,
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
