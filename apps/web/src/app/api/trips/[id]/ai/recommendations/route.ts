import {
  NextResponse,
} from 'next/server';

import type {
  AiRecommendationsResponse,
  GenerateAiRecommendationsInput,
} from '../../../../../../features/ai/types/ai.types';
import {
  authenticatedServerApiFetch,
} from '../../../../../../lib/api/authenticated-server-api';

type AiRecommendationsRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message:
        'Meridian AI is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function POST(
  request: Request,
  context:
    AiRecommendationsRouteContext,
) {
  const { id } =
    await context.params;

  let body:
    GenerateAiRecommendationsInput;

  try {
    body =
      (await request.json()) as GenerateAiRecommendationsInput;
  } catch {
    return NextResponse.json(
      {
        statusCode: 400,
        message:
          'Request body must be valid JSON',
        error:
          'Bad Request',
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
      await authenticatedServerApiFetch<
        AiRecommendationsResponse
      >(
        `/api/v1/trips/${encodeURIComponent(id)}/ai/recommendations`,
        {
          method: 'POST',
          body:
            JSON.stringify(
              body,
            ),
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
    return serviceUnavailable();
  }
}
