import { NextResponse } from 'next/server';

import { authenticatedServerApiFetch } from '../../../../lib/api/authenticated-server-api';

interface RealtimeTicketResponse {
  ticket: string;
  expiresInSeconds: number;
}

export async function POST() {
  try {
    const {
      response,
      payload,
    } =
      await authenticatedServerApiFetch<RealtimeTicketResponse>(
        '/api/v1/realtime/ticket',
        {
          method: 'POST',
        },
      );

    return NextResponse.json(
      payload,
      {
        status: response.status,
      },
    );
  } catch {
    return NextResponse.json(
      {
        statusCode: 502,
        message:
          'Realtime service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
