import type {
  ApiEnvelope,
  ApiErrorResponse,
  RefreshApiData,
} from '../../features/auth/types/auth.types';
import {
  clearAuthCookies,
  getAuthTokens,
  setAuthCookies,
} from '../auth/auth-cookies';
import {
  serverApiFetch,
  type ServerApiResult,
} from './server-api';

function withAccessToken(
  init: RequestInit,
  accessToken: string,
): RequestInit {
  const headers =
    new Headers(init.headers);

  headers.set(
    'Authorization',
    `Bearer ${accessToken}`,
  );

  return {
    ...init,
    headers,
  };
}

function createErrorResult<T>(
  status: number,
  message: string,
  error: string,
): ServerApiResult<T> {
  return {
    response: new Response(
      null,
      {
        status,
      },
    ),
    payload: {
      statusCode: status,
      message,
      error,
    },
  };
}

export async function authenticatedServerApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<ServerApiResult<T>> {
  const {
    accessToken,
    refreshToken,
  } = await getAuthTokens();

  if (accessToken) {
    const initialResponse =
      await serverApiFetch<T>(
        path,
        withAccessToken(
          init,
          accessToken,
        ),
      );

    if (
      initialResponse.response
        .status !== 401
    ) {
      return initialResponse;
    }
  }

  if (!refreshToken) {
    await clearAuthCookies();

    return createErrorResult<T>(
      401,
      'Authentication required',
      'Unauthorized',
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

  if (
    !refreshResponse.response.ok
  ) {
    if (
      refreshResponse.response
        .status === 401
    ) {
      await clearAuthCookies();
    }

    return {
      response: new Response(
        null,
        {
          status:
            refreshResponse.response
              .status,
        },
      ),
      payload:
        refreshResponse.payload as ApiErrorResponse,
    };
  }

  if (
    !(
      'data' in
      refreshResponse.payload
    )
  ) {
    await clearAuthCookies();

    return createErrorResult<T>(
      502,
      'Authentication service returned an invalid response',
      'Bad Gateway',
    );
  }

  const refreshed =
    (
      refreshResponse.payload as ApiEnvelope<RefreshApiData>
    ).data;

  await setAuthCookies(
    refreshed.accessToken,
    refreshed.refreshToken,
  );

  const retryResponse =
    await serverApiFetch<T>(
      path,
      withAccessToken(
        init,
        refreshed.accessToken,
      ),
    );

  if (
    retryResponse.response.status ===
    401
  ) {
    await clearAuthCookies();
  }

  return retryResponse;
}