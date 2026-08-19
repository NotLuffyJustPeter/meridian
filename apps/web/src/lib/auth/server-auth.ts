import { redirect } from 'next/navigation';

import type {
  ApiEnvelope,
  PublicUser,
  RefreshApiData,
} from '../../features/auth/types/auth.types';
import { serverApiFetch } from '../api/server-api';
import {
  clearAuthCookies,
  getAuthTokens,
  setAuthCookies,
} from './auth-cookies';

async function fetchCurrentUser(
  accessToken: string,
) {
  return serverApiFetch<PublicUser>(
    '/api/v1/auth/me',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
}

export async function getAuthenticatedUser(): Promise<
  PublicUser | null
> {
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
        const result =
          currentUserResponse.payload as ApiEnvelope<PublicUser>;

        return result.data;
      }

      if (
        currentUserResponse.response
          .status !== 401
      ) {
        return null;
      }
    }

    if (!refreshToken) {
      return null;
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

      return null;
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
      return null;
    }

    const result =
      retryResponse.payload as ApiEnvelope<PublicUser>;

    return result.data;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(): Promise<PublicUser> {
  const user =
    await getAuthenticatedUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}