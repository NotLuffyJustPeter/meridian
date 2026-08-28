import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  EXPENSE_CATEGORIES,
  isExpenseCategory,
  type ExpenseCategoryValue,
} from '../common/expense-categories';
import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { UpsertCategoryLimitDto } from './dto/upsert-category-limit.dto';

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
  ) {}

  async getBudget(ownerId: string, tripId: string) {
    const trip = await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    const budget = await this.prisma.budget.findUnique({
      where: {
        tripId,
      },
    });

    if (!budget) {
      return {
        tripId: trip.id,
        currency: trip.currency,
        configured: false,
        budget: null,
      };
    }

    return {
      tripId: trip.id,
      currency: trip.currency,
      configured: true,
      budget: this.serializeBudget(budget),
    };
  }

  async upsertBudget(ownerId: string, tripId: string, dto: UpsertBudgetDto) {
    const trip = await this.tripsService.findEditableTripOrThrow(ownerId, tripId);
    const totalAmount = this.normalizeMoney(dto.totalAmount, 'totalAmount');

    const existingBudget = await this.prisma.budget.findUnique({
      where: {
        tripId,
      },
      include: {
        categoryLimits: true,
      },
    });

    if (existingBudget) {
      const configuredLimitCents = existingBudget.categoryLimits.reduce(
        (sum, limit) => sum + this.moneyToCents(limit.amount.toFixed(2)),
        0n,
      );

      if (configuredLimitCents > this.moneyToCents(totalAmount)) {
        throw new BadRequestException(
          'Total budget cannot be lower than configured category limits',
        );
      }
    }

    const budget = await this.prisma.budget.upsert({
      where: {
        tripId,
      },
      create: {
        tripId,
        totalAmount,
      },
      update: {
        totalAmount,
      },
    });

    return {
      tripId: trip.id,
      currency: trip.currency,
      configured: true,
      budget: this.serializeBudget(budget),
    };
  }

  async listCategoryLimits(ownerId: string, tripId: string) {
    const trip = await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    const budget = await this.prisma.budget.findUnique({
      where: {
        tripId,
      },
    });

    if (!budget) {
      return {
        tripId: trip.id,
        currency: trip.currency,
        configured: false,
        categoryLimits: [],
      };
    }

    const limits = await this.prisma.budgetCategoryLimit.findMany({
      where: {
        budgetId: budget.id,
      },
    });

    return {
      tripId: trip.id,
      currency: trip.currency,
      configured: true,
      categoryLimits: this.sortCategoryLimits(limits).map((limit) =>
        this.serializeCategoryLimit(limit),
      ),
    };
  }

  async upsertCategoryLimit(
    ownerId: string,
    tripId: string,
    categoryValue: string,
    dto: UpsertCategoryLimitDto,
  ) {
    const trip = await this.tripsService.findEditableTripOrThrow(ownerId, tripId);
    const category = this.parseCategory(categoryValue);
    const amount = this.normalizeMoney(dto.amount, 'amount');

    const budget = await this.prisma.budget.findUnique({
      where: {
        tripId,
      },
      include: {
        categoryLimits: true,
      },
    });

    if (!budget) {
      throw new BadRequestException('Budget must be configured before setting category limits');
    }

    const otherLimitCents = budget.categoryLimits.reduce(
      (sum, limit) =>
        limit.category === category ? sum : sum + this.moneyToCents(limit.amount.toFixed(2)),
      0n,
    );
    const proposedLimitCents = otherLimitCents + this.moneyToCents(amount);
    const budgetCents = this.moneyToCents(budget.totalAmount.toFixed(2));

    if (proposedLimitCents > budgetCents) {
      throw new BadRequestException('Category limits cannot exceed total budget');
    }

    const limit = await this.prisma.budgetCategoryLimit.upsert({
      where: {
        budgetId_category: {
          budgetId: budget.id,
          category,
        },
      },
      create: {
        budgetId: budget.id,
        category,
        amount,
      },
      update: {
        amount,
      },
    });

    return {
      tripId: trip.id,
      currency: trip.currency,
      categoryLimit: this.serializeCategoryLimit(limit),
    };
  }

  async removeCategoryLimit(ownerId: string, tripId: string, categoryValue: string): Promise<void> {
    await this.tripsService.findEditableTripOrThrow(ownerId, tripId);
    const category = this.parseCategory(categoryValue);

    const budget = await this.prisma.budget.findUnique({
      where: {
        tripId,
      },
    });

    if (!budget) {
      throw new NotFoundException('Budget category limit not found');
    }

    const result = await this.prisma.budgetCategoryLimit.deleteMany({
      where: {
        budgetId: budget.id,
        category,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Budget category limit not found');
    }
  }

  async getOverview(ownerId: string, tripId: string) {
    const trip = await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    const [budget, groupedExpenses] = await Promise.all([
      this.prisma.budget.findUnique({
        where: {
          tripId,
        },
        include: {
          categoryLimits: true,
        },
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: {
          tripId,
        },
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const groupedByCategory = new Map<
      ExpenseCategoryValue,
      {
        spentAmount: string;
        expensesCount: number;
      }
    >();

    let spentCents = 0n;
    let expensesCount = 0;

    for (const group of groupedExpenses) {
      const categorySpentAmount = group._sum.amount?.toFixed(2) ?? '0.00';
      const categorySpentCents = this.moneyToCents(categorySpentAmount);

      spentCents += categorySpentCents;
      expensesCount += group._count._all;

      groupedByCategory.set(group.category, {
        spentAmount: categorySpentAmount,
        expensesCount: group._count._all,
      });
    }

    const spentAmount = this.centsToMoney(spentCents);

    const budgetAmount = budget?.totalAmount.toFixed(2) ?? null;
    const budgetCents = budgetAmount !== null ? this.moneyToCents(budgetAmount) : null;

    const remainingAmount =
      budgetCents !== null ? this.centsToMoney(budgetCents - spentCents) : null;

    const usagePercentage =
      budgetCents !== null ? this.percentageFromCents(spentCents, budgetCents) : null;

    const limitsByCategory = new Map<
      ExpenseCategoryValue,
      NonNullable<Awaited<ReturnType<PrismaService['budgetCategoryLimit']['findUnique']>>>
    >();

    for (const limit of budget?.categoryLimits ?? []) {
      limitsByCategory.set(limit.category, limit);
    }

    const categories = EXPENSE_CATEGORIES.map((category) => {
      const grouped = groupedByCategory.get(category);
      const categorySpentAmount = grouped?.spentAmount ?? '0.00';
      const categorySpentCents = this.moneyToCents(categorySpentAmount);
      const limit = limitsByCategory.get(category);
      const limitAmount = limit?.amount.toFixed(2) ?? null;
      const limitCents = limitAmount !== null ? this.moneyToCents(limitAmount) : null;

      return {
        category,
        spentAmount: categorySpentAmount,
        expensesCount: grouped?.expensesCount ?? 0,
        limitAmount,
        remainingAmount:
          limitCents !== null ? this.centsToMoney(limitCents - categorySpentCents) : null,
        usagePercentage:
          limitCents !== null ? this.percentageFromCents(categorySpentCents, limitCents) : null,
      };
    });

    return {
      tripId: trip.id,
      currency: trip.currency,
      configured: budget !== null,
      budget: budget ? this.serializeBudget(budget) : null,
      totals: {
        budgetAmount,
        spentAmount,
        remainingAmount,
        usagePercentage,
        expensesCount,
      },
      categories,
    };
  }

  private parseCategory(value: string): ExpenseCategoryValue {
    if (!isExpenseCategory(value)) {
      throw new BadRequestException('Invalid expense category');
    }

    return value;
  }

  private normalizeMoney(value: string, fieldName: string): string {
    const trimmed = value.trim();

    if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(trimmed)) {
      throw new BadRequestException(
        `${fieldName} must use up to 12 integer digits and 2 decimal places`,
      );
    }

    const [integerPart, decimalPart = ''] = trimmed.split('.');

    const isZero = integerPart === '0' && (decimalPart === '' || /^0+$/.test(decimalPart));

    if (isZero) {
      throw new BadRequestException(`${fieldName} must be greater than 0`);
    }

    return `${integerPart}.${decimalPart.padEnd(2, '0')}`;
  }

  private moneyToCents(value: string): bigint {
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const [integerPart, decimalPart = ''] = unsigned.split('.');
    const cents = BigInt(integerPart) * 100n + BigInt(decimalPart.padEnd(2, '0').slice(0, 2));

    return negative ? -cents : cents;
  }

  private centsToMoney(value: bigint): string {
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    const integerPart = absolute / 100n;
    const decimalPart = (absolute % 100n).toString().padStart(2, '0');

    return `${negative ? '-' : ''}${integerPart}.${decimalPart}`;
  }

  private percentageFromCents(numerator: bigint, denominator: bigint): number | null {
    if (denominator <= 0n) {
      return null;
    }

    const basisPoints = (numerator * 10000n + denominator / 2n) / denominator;

    return Number(basisPoints) / 100;
  }

  private sortCategoryLimits<
    T extends {
      category: ExpenseCategoryValue;
    },
  >(limits: T[]): T[] {
    return [...limits].sort(
      (left, right) =>
        EXPENSE_CATEGORIES.indexOf(left.category) - EXPENSE_CATEGORIES.indexOf(right.category),
    );
  }

  private serializeBudget(
    budget: NonNullable<Awaited<ReturnType<PrismaService['budget']['findUnique']>>>,
  ) {
    return {
      id: budget.id,
      tripId: budget.tripId,
      totalAmount: budget.totalAmount.toFixed(2),
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }

  private serializeCategoryLimit(
    limit: NonNullable<Awaited<ReturnType<PrismaService['budgetCategoryLimit']['findUnique']>>>,
  ) {
    return {
      id: limit.id,
      budgetId: limit.budgetId,
      category: limit.category,
      amount: limit.amount.toFixed(2),
      createdAt: limit.createdAt,
      updatedAt: limit.updatedAt,
    };
  }
}
