
import { NextResponse } from 'next/server';

import type {
  ApiEnvelope,
  LoginApiData,
  MfaRequiredApiData,
  SuccessfulLoginApiData,
} from '../../../../features/auth/types/auth.types';
import { serverApiFetch } from '../../../../lib/api/server-api';
import {
  clearMfaChallengeCookie,
  setAuthCookies,
  setMfaChallengeCookie,
} from '../../../../lib/auth/auth-cookies';

function isMfaRequired(
  data: LoginApiData,
): data is MfaRequiredApiData {
  return (
    'mfaRequired' in data &&
    data.mfaRequired === true
  );
}

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
        error: 'Bad Request',
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

    if (
      isMfaRequired(
        result.data,
      )
    ) {
      await setMfaChallengeCookie(
        result.data.challengeToken,
      );

      return NextResponse.json(
        {
          data: {
            mfaRequired:
              true,
          },
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
    }

    const login =
      result.data as SuccessfulLoginApiData;

    await clearMfaChallengeCookie();

    await setAuthCookies(
      login.accessToken,
      login.refreshToken,
    );

    return NextResponse.json(
      {
        data:
          login.user,
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
          'Google authentication service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
