import { NextResponse } from 'next/server';

import type {
  Expense,
  UpdateExpenseInput,
} from '../../../../../../features/budget/types/budget.types';
import { authenticatedServerApiFetch } from '../../../../../../lib/api/authenticated-server-api';

type ExpenseRouteContext = {
  params: Promise<{
    id: string;
    expenseId: string;
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
  context: ExpenseRouteContext,
) {
  const { id, expenseId } = await context.params;

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<Expense>(
        `/api/v1/trips/${encodeURIComponent(id)}/expenses/${encodeURIComponent(expenseId)}`,
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

export async function PATCH(
  request: Request,
  context: ExpenseRouteContext,
) {
  const { id, expenseId } = await context.params;

  let body: UpdateExpenseInput;

  try {
    body = (await request.json()) as UpdateExpenseInput;
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
        `/api/v1/trips/${encodeURIComponent(id)}/expenses/${encodeURIComponent(expenseId)}`,
        {
          method: 'PATCH',
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

export async function DELETE(
  _request: Request,
  context: ExpenseRouteContext,
) {
  const { id, expenseId } = await context.params;

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<never>(
        `/api/v1/trips/${encodeURIComponent(id)}/expenses/${encodeURIComponent(expenseId)}`,
        {
          method: 'DELETE',
        },
      );

    if (response.status === 204) {
      return new NextResponse(null, {
        status: 204,
      });
    }

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return serviceUnavailable();
  }
}
