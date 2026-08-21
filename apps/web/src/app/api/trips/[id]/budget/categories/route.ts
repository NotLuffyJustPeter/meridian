import { NextResponse } from 'next/server';

import type { BudgetCategoryLimitsResponse } from '../../../../../../features/budget/types/budget.types';
import { authenticatedServerApiFetch } from '../../../../../../lib/api/authenticated-server-api';

type BudgetCategoriesRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: BudgetCategoriesRouteContext,
) {
  const { id } = await context.params;

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<BudgetCategoryLimitsResponse>(
        `/api/v1/trips/${encodeURIComponent(id)}/budget/categories`,
        {
          method: 'GET',
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
