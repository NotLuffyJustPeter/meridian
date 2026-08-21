import { NextResponse } from 'next/server';

import type {
  BudgetCategoryLimit,
  UpsertCategoryLimitInput,
} from '../../../../../../../features/budget/types/budget.types';
import { authenticatedServerApiFetch } from '../../../../../../../lib/api/authenticated-server-api';

type BudgetCategoryRouteContext = {
  params: Promise<{
    id: string;
    category: string;
  }>;
};

export async function PUT(
  request: Request,
  context: BudgetCategoryRouteContext,
) {
  const { id, category } = await context.params;

  let body: UpsertCategoryLimitInput;

  try {
    body = (await request.json()) as UpsertCategoryLimitInput;
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
      await authenticatedServerApiFetch<{
        tripId: string;
        currency: string;
        categoryLimit: BudgetCategoryLimit;
      }>(
        `/api/v1/trips/${encodeURIComponent(id)}/budget/categories/${encodeURIComponent(category)}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        },
      );

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        statusCode: 502,
        message: 'Budget category service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: BudgetCategoryRouteContext,
) {
  const { id, category } = await context.params;

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<never>(
        `/api/v1/trips/${encodeURIComponent(id)}/budget/categories/${encodeURIComponent(category)}`,
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
    return NextResponse.json(
      {
        statusCode: 502,
        message: 'Budget category service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
