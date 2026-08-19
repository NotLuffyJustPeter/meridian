import {
  NextRequest,
  NextResponse,
} from 'next/server';

import type {
  ApiEnvelope,
  RefreshApiData,
} from '../../../../features/auth/types/auth.types';
import { serverApiFetch } from '../../../../lib/api/server-api';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../../../../lib/auth/auth-cookies';

function getPositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return parsed;
}

function shouldUseSecureCookies(): boolean {
  return (
    process.env.AUTH_COOKIE_SECURE ===
    'true'
  );
}

function getPublicOrigin(): string {
  const configured =
    process.env.APP_ORIGIN?.trim();

  if (configured) {
    return configured.replace(
      /\/+$/,
      '',
    );
  }

  return 'http://localhost:3000';
}

function getSafeNextPath(
  request: NextRequest,
): string {
  const nextPath =
    request.nextUrl.searchParams.get(
      'next',
    );

  if (
    !nextPath ||
    !nextPath.startsWith('/') ||
    nextPath.startsWith('//')
  ) {
    return '/dashboard';
  }

  return nextPath;
}

function clearCookies(
  response: NextResponse,
): void {
  const secure =
    shouldUseSecureCookies();

  response.cookies.set(
    ACCESS_COOKIE_NAME,
    '',
    {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  );

  response.cookies.set(
    REFRESH_COOKIE_NAME,
    '',
    {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  const nextPath =
    getSafeNextPath(request);

  const origin =
    getPublicOrigin();

  const loginUrl =
    new URL(
      '/login',
      origin,
    );

  const destinationUrl =
    new URL(
      nextPath,
      origin,
    );

  const refreshToken =
    request.cookies.get(
      REFRESH_COOKIE_NAME,
    )?.value;

  if (!refreshToken) {
    const response =
      NextResponse.redirect(
        loginUrl,
      );

    clearCookies(response);

    return response;
  }

  try {
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
      console.error(
        '[auth/continue] Refresh failed:',
        refreshResponse.response.status,
      );

      const response =
        NextResponse.redirect(
          loginUrl,
        );

      clearCookies(response);

      return response;
    }

    const refreshed =
      refreshResponse.payload as ApiEnvelope<RefreshApiData>;

    const accessMaxAge =
      getPositiveNumber(
        process.env
          .AUTH_ACCESS_COOKIE_MAX_AGE_SECONDS,
        900,
      );

    const refreshMaxAge =
      getPositiveNumber(
        process.env
          .AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS,
        604800,
      );

    const secure =
      shouldUseSecureCookies();

    const response =
      NextResponse.redirect(
        destinationUrl,
      );

    response.cookies.set(
      ACCESS_COOKIE_NAME,
      refreshed.data.accessToken,
      {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: accessMaxAge,
      },
    );

    response.cookies.set(
      REFRESH_COOKIE_NAME,
      refreshed.data.refreshToken,
      {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: refreshMaxAge,
      },
    );

    return response;
  } catch (error) {
    console.error(
      '[auth/continue] Unexpected refresh error',
      error,
    );

    const response =
      NextResponse.redirect(
        loginUrl,
      );

    clearCookies(response);

    return response;
  }
}