import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { BudgetService } from './budget.service';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';
const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';
const BUDGET_ID = '7cbfed90-f0fe-43c9-a22f-9bd9acdc5816';
const LIMIT_ID = '3441b558-14d7-4f92-a474-9422174ce821';

const CREATED_AT = new Date('2026-08-21T04:49:05.872Z');
const UPDATED_AT = new Date('2026-08-21T04:49:11.138Z');

type ExpenseCategoryValue =
  'ACCOMMODATION' | 'FOOD' | 'TRANSPORT' | 'ACTIVITIES' | 'SHOPPING' | 'HEALTH' | 'OTHER';

type DecimalLike = {
  toFixed: (digits?: number) => string;
};

type TripRecord = {
  id: string;
  currency: string;
};

type BudgetRecord = {
  id: string;
  tripId: string;
  totalAmount: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
  categoryLimits?: CategoryLimitRecord[];
};

type CategoryLimitRecord = {
  id: string;
  budgetId: string;
  category: ExpenseCategoryValue;
  amount: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
};

type ExpenseAggregateResult = {
  _sum: {
    amount: DecimalLike | null;
  };
  _count: {
    _all: number;
  };
};

type ExpenseGroupResult = {
  category: ExpenseCategoryValue;
  _sum: {
    amount: DecimalLike | null;
  };
  _count: {
    _all: number;
  };
};

type BudgetFindUniqueMock = (args: unknown) => Promise<BudgetRecord | null>;

type BudgetUpsertMock = (args: unknown) => Promise<BudgetRecord>;

type CategoryFindManyMock = (args: unknown) => Promise<CategoryLimitRecord[]>;

type CategoryUpsertMock = (args: unknown) => Promise<CategoryLimitRecord>;

type CategoryDeleteManyMock = (args: unknown) => Promise<{ count: number }>;

type ExpenseAggregateMock = (args: unknown) => Promise<ExpenseAggregateResult>;

type ExpenseGroupByMock = (args: unknown) => Promise<ExpenseGroupResult[]>;

type FindTripAccessMock = (ownerId: string, tripId: string) => Promise<TripRecord>;

function decimal(value: string): DecimalLike {
  return {
    toFixed: () => value,
  };
}

function budgetRecord(amount = '42500.50', categoryLimits?: CategoryLimitRecord[]): BudgetRecord {
  return {
    id: BUDGET_ID,
    tripId: TRIP_ID,
    totalAmount: decimal(amount),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...(categoryLimits !== undefined && {
      categoryLimits,
    }),
  };
}

function limitRecord(
  category: ExpenseCategoryValue = 'FOOD',
  amount = '400.00',
): CategoryLimitRecord {
  return {
    id: LIMIT_ID,
    budgetId: BUDGET_ID,
    category,
    amount: decimal(amount),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  };
}

describe('BudgetService', () => {
  let service: BudgetService;

  let budgetFindUnique: jest.Mock<BudgetFindUniqueMock>;
  let budgetUpsert: jest.Mock<BudgetUpsertMock>;
  let categoryFindMany: jest.Mock<CategoryFindManyMock>;
  let categoryUpsert: jest.Mock<CategoryUpsertMock>;
  let categoryDeleteMany: jest.Mock<CategoryDeleteManyMock>;
  let expenseAggregate: jest.Mock<ExpenseAggregateMock>;
  let expenseGroupBy: jest.Mock<ExpenseGroupByMock>;
  let findAccessibleTripOrThrow: jest.Mock<FindTripAccessMock>;
  let findEditableTripOrThrow: jest.Mock<FindTripAccessMock>;

  beforeEach(() => {
    budgetFindUnique = jest.fn<BudgetFindUniqueMock>();
    budgetUpsert = jest.fn<BudgetUpsertMock>();
    categoryFindMany = jest.fn<CategoryFindManyMock>();
    categoryUpsert = jest.fn<CategoryUpsertMock>();
    categoryDeleteMany = jest.fn<CategoryDeleteManyMock>();
    expenseAggregate = jest.fn<ExpenseAggregateMock>(() =>
      Promise.reject(new Error('expense.aggregate must not be called by getOverview')),
    );
    expenseGroupBy = jest.fn<ExpenseGroupByMock>();
    findAccessibleTripOrThrow = jest.fn<FindTripAccessMock>();
    findEditableTripOrThrow = jest.fn<FindTripAccessMock>();

    const prisma = {
      budget: {
        findUnique: budgetFindUnique,
        upsert: budgetUpsert,
      },
      budgetCategoryLimit: {
        findMany: categoryFindMany,
        upsert: categoryUpsert,
        deleteMany: categoryDeleteMany,
      },
      expense: {
        aggregate: expenseAggregate,
        groupBy: expenseGroupBy,
      },
    } as unknown as PrismaService;

    const tripsService = {
      findAccessibleTripOrThrow,
      findEditableTripOrThrow,
    } as unknown as TripsService;

    service = new BudgetService(prisma, tripsService);

    findAccessibleTripOrThrow.mockResolvedValue({
      id: TRIP_ID,
      currency: 'EUR',
    });

    findEditableTripOrThrow.mockResolvedValue({
      id: TRIP_ID,
      currency: 'EUR',
    });

    expenseGroupBy.mockResolvedValue([]);
  });

  it('returns an unconfigured budget state', async () => {
    budgetFindUnique.mockResolvedValue(null);

    const result = await service.getBudget(OWNER_ID, TRIP_ID);

    expect(result).toEqual({
      tripId: TRIP_ID,
      currency: 'EUR',
      configured: false,
      budget: null,
    });
  });

  it('creates or updates a budget with normalized precision', async () => {
    budgetFindUnique.mockResolvedValue(null);

    budgetUpsert.mockResolvedValue(budgetRecord('35000.00'));

    const result = await service.upsertBudget(OWNER_ID, TRIP_ID, {
      totalAmount: '35000',
    });

    expect(budgetUpsert).toHaveBeenCalledWith({
      where: {
        tripId: TRIP_ID,
      },
      create: {
        tripId: TRIP_ID,
        totalAmount: '35000.00',
      },
      update: {
        totalAmount: '35000.00',
      },
    });

    expect(result.budget.totalAmount).toBe('35000.00');
  });

  it('accepts the Decimal(14,2) maximum budget', async () => {
    budgetFindUnique.mockResolvedValue(null);
    budgetUpsert.mockResolvedValue(budgetRecord('999999999999.99'));

    const result = await service.upsertBudget(OWNER_ID, TRIP_ID, {
      totalAmount: '999999999999.99',
    });

    expect(result.budget.totalAmount).toBe('999999999999.99');
  });

  it('rejects over-max and scientific budget values', async () => {
    await expect(
      service.upsertBudget(OWNER_ID, TRIP_ID, {
        totalAmount: '1000000000000.00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.upsertBudget(OWNER_ID, TRIP_ID, {
        totalAmount: '1e3',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not lower total budget below configured category limits', async () => {
    budgetFindUnique.mockResolvedValue(
      budgetRecord('1000.00', [limitRecord('FOOD', '600.00'), limitRecord('TRANSPORT', '300.00')]),
    );

    await expect(
      service.upsertBudget(OWNER_ID, TRIP_ID, {
        totalAmount: '899.99',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(budgetUpsert).not.toHaveBeenCalled();
  });

  it('rejects a zero budget', async () => {
    await expect(
      service.upsertBudget(OWNER_ID, TRIP_ID, {
        totalAmount: '0',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(budgetUpsert).not.toHaveBeenCalled();
  });

  it('upserts and serializes a category limit', async () => {
    budgetFindUnique.mockResolvedValue(budgetRecord('42500.50', []));

    categoryUpsert.mockResolvedValue(limitRecord('FOOD', '500.00'));

    const result = await service.upsertCategoryLimit(OWNER_ID, TRIP_ID, 'FOOD', {
      amount: '500',
    });

    expect(categoryUpsert).toHaveBeenCalledWith({
      where: {
        budgetId_category: {
          budgetId: BUDGET_ID,
          category: 'FOOD',
        },
      },
      create: {
        budgetId: BUDGET_ID,
        category: 'FOOD',
        amount: '500.00',
      },
      update: {
        amount: '500.00',
      },
    });

    expect(result.categoryLimit.amount).toBe('500.00');
  });

  it('rejects category limits whose sum exceeds the total budget', async () => {
    budgetFindUnique.mockResolvedValue(
      budgetRecord('1000.00', [limitRecord('TRANSPORT', '700.00')]),
    );

    await expect(
      service.upsertCategoryLimit(OWNER_ID, TRIP_ID, 'FOOD', {
        amount: '300.01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(categoryUpsert).not.toHaveBeenCalled();
  });

  it('accepts the Decimal(14,2) maximum category limit when budget allows it', async () => {
    budgetFindUnique.mockResolvedValue(budgetRecord('999999999999.99', []));
    categoryUpsert.mockResolvedValue(limitRecord('FOOD', '999999999999.99'));

    const result = await service.upsertCategoryLimit(OWNER_ID, TRIP_ID, 'FOOD', {
      amount: '999999999999.99',
    });

    expect(result.categoryLimit.amount).toBe('999999999999.99');
  });

  it('requires a configured budget before setting category limits', async () => {
    budgetFindUnique.mockResolvedValue(null);

    await expect(
      service.upsertCategoryLimit(OWNER_ID, TRIP_ID, 'FOOD', {
        amount: '500',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(categoryUpsert).not.toHaveBeenCalled();
  });

  it('rejects invalid category values', async () => {
    await expect(
      service.upsertCategoryLimit(OWNER_ID, TRIP_ID, 'NOT_REAL', {
        amount: '500',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(budgetFindUnique).not.toHaveBeenCalled();
  });

  it('deletes a configured category limit', async () => {
    budgetFindUnique.mockResolvedValue(budgetRecord());

    categoryDeleteMany.mockResolvedValue({
      count: 1,
    });

    await service.removeCategoryLimit(OWNER_ID, TRIP_ID, 'FOOD');

    expect(categoryDeleteMany).toHaveBeenCalledWith({
      where: {
        budgetId: BUDGET_ID,
        category: 'FOOD',
      },
    });
  });

  it('returns 404 when deleting a missing category limit', async () => {
    budgetFindUnique.mockResolvedValue(budgetRecord());

    categoryDeleteMany.mockResolvedValue({
      count: 0,
    });

    await expect(service.removeCategoryLimit(OWNER_ID, TRIP_ID, 'FOOD')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('calculates overview totals and category usage', async () => {
    budgetFindUnique.mockResolvedValue(
      budgetRecord('1000.00', [limitRecord('FOOD', '400.00'), limitRecord('TRANSPORT', '250.00')]),
    );

    expenseGroupBy.mockResolvedValue([
      {
        category: 'FOOD',
        _sum: {
          amount: decimal('200.00'),
        },
        _count: {
          _all: 2,
        },
      },
      {
        category: 'TRANSPORT',
        _sum: {
          amount: decimal('100.00'),
        },
        _count: {
          _all: 1,
        },
      },
    ]);

    const result = await service.getOverview(OWNER_ID, TRIP_ID);

    expect(result.totals).toEqual({
      budgetAmount: '1000.00',
      spentAmount: '300.00',
      remainingAmount: '700.00',
      usagePercentage: 30,
      expensesCount: 3,
    });

    const food = result.categories.find((category) => category.category === 'FOOD');

    expect(food).toEqual({
      category: 'FOOD',
      spentAmount: '200.00',
      expensesCount: 2,
      limitAmount: '400.00',
      remainingAmount: '200.00',
      usagePercentage: 50,
    });
  });

  it('still reports spending without a configured total budget', async () => {
    budgetFindUnique.mockResolvedValue(null);

    expenseGroupBy.mockResolvedValue([
      {
        category: 'OTHER',
        _sum: {
          amount: decimal('50.00'),
        },
        _count: {
          _all: 1,
        },
      },
    ]);

    const result = await service.getOverview(OWNER_ID, TRIP_ID);

    expect(result.totals).toEqual({
      budgetAmount: null,
      spentAmount: '50.00',
      remainingAmount: null,
      usagePercentage: null,
      expensesCount: 1,
    });
  });

  it('does not query financial data when trip access fails', async () => {
    findAccessibleTripOrThrow.mockRejectedValue(new NotFoundException('Trip not found'));

    await expect(service.getOverview(OWNER_ID, TRIP_ID)).rejects.toBeInstanceOf(NotFoundException);

    expect(budgetFindUnique).not.toHaveBeenCalled();

    expect(expenseAggregate).not.toHaveBeenCalled();

    expect(expenseGroupBy).not.toHaveBeenCalled();
  });
});
