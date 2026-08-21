import { NextResponse } from 'next/server';

import type {
  BudgetResponse,
  UpsertBudgetInput,
} from '../../../../../features/budget/types/budget.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

type BudgetRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message: 'Budget service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  _request: Request,
  context: BudgetRouteContext,
) {
  const { id } = await context.params;

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<BudgetResponse>(
        `/api/v1/trips/${encodeURIComponent(id)}/budget`,
        {
          method: 'GET',
        },
      );

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return serviceUnavailable();
  }
}

export async function PUT(
  request: Request,
  context: BudgetRouteContext,
) {
  const { id } = await context.params;

  let body: UpsertBudgetInput;

  try {
    body = (await request.json()) as UpsertBudgetInput;
  } catch {
    return NextResponse.json(
      {
        statusCode: 400,
        message: 'Request body must be valid JSON',
        error: 'Bad Request',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<BudgetResponse>(
        `/api/v1/trips/${encodeURIComponent(id)}/budget`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        },
      );

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return serviceUnavailable();
  }
}
