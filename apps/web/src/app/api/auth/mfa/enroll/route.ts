
import { NextResponse } from 'next/server';

import type { MfaEnrollmentData } from '../../../../../features/auth/types/auth.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

export async function POST() {
  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<MfaEnrollmentData>(
        '/api/v1/auth/mfa/enroll',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

    return NextResponse.json(
      payload,
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
