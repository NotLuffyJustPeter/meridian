import { NextResponse } from 'next/server';

import type {
  CreateExpenseInput,
  Expense,
} from '../../../../../features/budget/types/budget.types';
import { authenticatedServerApiFetch } from '../../../../../lib/api/authenticated-server-api';

type ExpensesRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function serviceUnavailable() {
  return NextResponse.json(
    {
      statusCode: 502,
      message: 'Expense service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  _request: Request,
  context: ExpensesRouteContext,
) {
  const { id } = await context.params;

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<Expense[]>(
        `/api/v1/trips/${encodeURIComponent(id)}/expenses`,
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

export async function POST(
  request: Request,
  context: ExpensesRouteContext,
) {
  const { id } = await context.params;

  let body: CreateExpenseInput;

  try {
    body = (await request.json()) as CreateExpenseInput;
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
      await authenticatedServerApiFetch<Expense>(
        `/api/v1/trips/${encodeURIComponent(id)}/expenses`,
        {
          method: 'POST',
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
