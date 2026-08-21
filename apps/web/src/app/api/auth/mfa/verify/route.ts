
import { NextResponse } from 'next/server';

import type {
  ApiEnvelope,
  SuccessfulLoginApiData,
} from '../../../../../features/auth/types/auth.types';
import { serverApiFetch } from '../../../../../lib/api/server-api';
import {
  clearMfaChallengeCookie,
  getMfaChallengeToken,
  setAuthCookies,
} from '../../../../../lib/auth/auth-cookies';

export async function POST(
  request: Request,
) {
  const challengeToken =
    await getMfaChallengeToken();

  if (!challengeToken) {
    return NextResponse.json(
      {
        statusCode: 401,
        message:
          'Two-step verification challenge is missing or expired',
        error:
          'Unauthorized',
      },
      {
        status: 401,
      },
    );
  }

  let body:
    | {
        code?: unknown;
      }
    | undefined;

  try {
    body =
      (await request.json()) as {
        code?: unknown;
      };
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
      await serverApiFetch<SuccessfulLoginApiData>(
        '/api/v1/auth/mfa/verify',
        {
          method: 'POST',
          body:
            JSON.stringify({
              challengeToken,
              code:
                body.code,
            }),
        },
      );

    if (!response.ok) {
      if (
        response.status ===
        401
      ) {
        // Keep the challenge cookie for remaining attempts.
      }

      return NextResponse.json(
        payload,
        {
          status:
            response.status,
        },
      );
    }

    const result =
      payload as ApiEnvelope<SuccessfulLoginApiData>;

    await setAuthCookies(
      result.data.accessToken,
      result.data.refreshToken,
    );

    await clearMfaChallengeCookie();

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
          'Two-step verification service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
