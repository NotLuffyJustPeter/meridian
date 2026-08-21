import { NextResponse } from 'next/server';

import type { SecurityStatus } from '../../../../features/auth/types/auth.types';
import { authenticatedServerApiFetch } from '../../../../lib/api/authenticated-server-api';

export async function GET() {
  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<SecurityStatus>(
        '/api/v1/auth/security',
        {
          method: 'GET',
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
          'Security settings service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
