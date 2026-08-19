import { cookies } from 'next/headers';

export const ACCESS_COOKIE_NAME =
  'meridian_access';

export const REFRESH_COOKIE_NAME =
  'meridian_refresh';

const DEFAULT_ACCESS_MAX_AGE =
  15 * 60;

const DEFAULT_REFRESH_MAX_AGE =
  7 * 24 * 60 * 60;

function getPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return parsed;
}

function shouldUseSecureCookies(): boolean {
  const configured =
    process.env.AUTH_COOKIE_SECURE;

  if (configured !== undefined) {
    return configured === 'true';
  }

  return (
    process.env.NODE_ENV ===
    'production'
  );
}

function getAccessMaxAge(): number {
  return getPositiveInteger(
    process.env
      .AUTH_ACCESS_COOKIE_MAX_AGE_SECONDS,
    DEFAULT_ACCESS_MAX_AGE,
  );
}

function getRefreshMaxAge(): number {
  return getPositiveInteger(
    process.env
      .AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS,
    DEFAULT_REFRESH_MAX_AGE,
  );
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const cookieStore =
    await cookies();

  const commonOptions = {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: 'lax' as const,
    path: '/',
  };

  cookieStore.set(
    ACCESS_COOKIE_NAME,
    accessToken,
    {
      ...commonOptions,
      maxAge: getAccessMaxAge(),
    },
  );

  cookieStore.set(
    REFRESH_COOKIE_NAME,
    refreshToken,
    {
      ...commonOptions,
      maxAge: getRefreshMaxAge(),
    },
  );
}

export async function getAccessToken(): Promise<
  string | undefined
> {
  const cookieStore =
    await cookies();

  return cookieStore.get(
    ACCESS_COOKIE_NAME,
  )?.value;
}

export async function getRefreshToken(): Promise<
  string | undefined
> {
  const cookieStore =
    await cookies();

  return cookieStore.get(
    REFRESH_COOKIE_NAME,
  )?.value;
}

export async function getAuthTokens(): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> {
  const cookieStore =
    await cookies();

  return {
    accessToken: cookieStore.get(
      ACCESS_COOKIE_NAME,
    )?.value,
    refreshToken: cookieStore.get(
      REFRESH_COOKIE_NAME,
    )?.value,
  };
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore =
    await cookies();

  cookieStore.delete(
    ACCESS_COOKIE_NAME,
  );

  cookieStore.delete(
    REFRESH_COOKIE_NAME,
  );
}