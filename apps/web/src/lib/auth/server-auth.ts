import { redirect } from 'next/navigation';

import type {
  ApiEnvelope,
  PublicUser,
} from '../../features/auth/types/auth.types';
import { serverApiFetch } from '../api/server-api';
import { getAuthTokens } from './auth-cookies';

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
  const { accessToken } =
    await getAuthTokens();

  if (!accessToken) {
    return null;
  }

  try {
    const currentUserResponse =
      await fetchCurrentUser(accessToken);

    if (
      !currentUserResponse.response.ok
    ) {
      return null;
    }

    const result =
      currentUserResponse.payload as ApiEnvelope<PublicUser>;

    return result.data;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(): Promise<PublicUser> {
  const user =
    await getAuthenticatedUser();

  if (user) {
    return user;
  }

  redirect(
    '/api/auth/continue?next=/dashboard',
  );
}