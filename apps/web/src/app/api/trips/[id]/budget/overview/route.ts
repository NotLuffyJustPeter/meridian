import { NextResponse } from 'next/server';

import type { BudgetOverview } from '../../../../../../features/budget/types/budget.types';
import { authenticatedServerApiFetch } from '../../../../../../lib/api/authenticated-server-api';

type BudgetOverviewRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: BudgetOverviewRouteContext,
) {
  const { id } = await context.params;

  try {
    const { response, payload } =
      await authenticatedServerApiFetch<BudgetOverview>(
        `/api/v1/trips/${encodeURIComponent(id)}/budget/overview`,
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
        message: 'Budget analytics service is unavailable',
        error: 'Bad Gateway',
      },
      {
        status: 502,
      },
    );
  }
}
