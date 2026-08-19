import { NextResponse } from 'next/server';

import type {
  ApiEnvelope,
  PublicUser,
  RefreshApiData,
} from '../../../../features/auth/types/auth.types';
import { serverApiFetch } from '../../../../lib/api/server-api';
import {
  clearAuthCookies,
  getAuthTokens,
  setAuthCookies,
} from '../../../../lib/auth/auth-cookies';

async function fetchCurrentUser(
  accessToken: string,
) {
  return serverApiFetch<PublicUser>(
    '/api/v1/auth/me',
    {
      method: 'GET',
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
      },
    },
  );
}

export async function GET() {
  const {
    accessToken,
    refreshToken,
  } = await getAuthTokens();

  try {
    if (accessToken) {
      const currentUserResponse =
        await fetchCurrentUser(
          accessToken,
        );

      if (
        currentUserResponse.response.ok
      ) {
        return NextResponse.json(
          currentUserResponse.payload,
          {
            status: 200,
          },
        );
      }

      if (
        currentUserResponse.response
          .status !== 401
      ) {
        return NextResponse.json(
          currentUserResponse.payload,
          {
            status:
              currentUserResponse
                .response.status,
          },
        );
      }
    }

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

    const refreshResponse =
      await serverApiFetch<RefreshApiData>(
        '/api/v1/auth/refresh',
        {
          method: 'POST',
          body: JSON.stringify({
            refreshToken,
          }),
        },
      );

    if (!refreshResponse.response.ok) {
      if (
        refreshResponse.response
          .status === 401
      ) {
        await clearAuthCookies();
      }

      return NextResponse.json(
        refreshResponse.payload,
        {
          status:
            refreshResponse.response
              .status,
        },
      );
    }

    const refreshed =
      refreshResponse.payload as ApiEnvelope<RefreshApiData>;

    await setAuthCookies(
      refreshed.data.accessToken,
      refreshed.data.refreshToken,
    );

    const retryResponse =
      await fetchCurrentUser(
        refreshed.data.accessToken,
      );

    if (!retryResponse.response.ok) {
      if (
        retryResponse.response.status ===
        401
      ) {
        await clearAuthCookies();
      }

      return NextResponse.json(
        retryResponse.payload,
        {
          status:
            retryResponse.response
              .status,
        },
      );
    }

    return NextResponse.json(
      retryResponse.payload,
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