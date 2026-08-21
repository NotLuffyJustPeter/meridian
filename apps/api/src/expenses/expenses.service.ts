import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { MONEY_PATTERN, type CreateExpenseDto } from './dto/create-expense.dto';
import { type UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripsService: TripsService,
  ) {}

  async create(ownerId: string, tripId: string, dto: CreateExpenseDto) {
    await this.tripsService.findEditableTripOrThrow(ownerId, tripId);

    const title = dto.title.trim();

    if (!title) {
      throw new BadRequestException('Expense title is required');
    }

    const amount = this.normalizeMoney(dto.amount);

    const notes = this.normalizeNullableText(dto.notes);

    const expense = await this.prisma.expense.create({
      data: {
        tripId,
        title,
        category: dto.category ?? 'OTHER',
        amount,
        spentAt: new Date(dto.spentAt),
        ...(notes !== undefined && {
          notes,
        }),
      },
    });

    return this.serializeExpense(expense);
  }

  async findAllOwned(ownerId: string, tripId: string) {
    await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    const expenses = await this.prisma.expense.findMany({
      where: {
        tripId,
      },
      orderBy: [
        {
          spentAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return expenses.map((expense) => this.serializeExpense(expense));
  }

  async findOwnedExpenseOrThrow(ownerId: string, tripId: string, expenseId: string) {
    await this.tripsService.findAccessibleTripOrThrow(ownerId, tripId);

    return this.findExpenseInTripOrThrow(tripId, expenseId);
  }

  async findOne(ownerId: string, tripId: string, expenseId: string) {
    const expense = await this.findOwnedExpenseOrThrow(ownerId, tripId, expenseId);

    return this.serializeExpense(expense);
  }

  async update(ownerId: string, tripId: string, expenseId: string, dto: UpdateExpenseDto) {
    const hasUpdates =
      dto.title !== undefined ||
      dto.category !== undefined ||
      dto.amount !== undefined ||
      dto.spentAt !== undefined ||
      dto.notes !== undefined;

    if (!hasUpdates) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.tripsService.findEditableTripOrThrow(ownerId, tripId);

    const existing = await this.findExpenseInTripOrThrow(tripId, expenseId);

    const title = dto.title !== undefined ? dto.title.trim() : undefined;

    if (title !== undefined && !title) {
      throw new BadRequestException('Expense title is required');
    }

    const amount = dto.amount !== undefined ? this.normalizeMoney(dto.amount) : undefined;

    const notes = dto.notes !== undefined ? this.normalizeNullableText(dto.notes) : undefined;

    const expense = await this.prisma.expense.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(title !== undefined && {
          title,
        }),
        ...(dto.category !== undefined && {
          category: dto.category,
        }),
        ...(amount !== undefined && {
          amount,
        }),
        ...(dto.spentAt !== undefined && {
          spentAt: new Date(dto.spentAt),
        }),
        ...(dto.notes !== undefined && {
          notes: notes ?? null,
        }),
      },
    });

    return this.serializeExpense(expense);
  }

  async remove(ownerId: string, tripId: string, expenseId: string): Promise<void> {
    await this.tripsService.findEditableTripOrThrow(ownerId, tripId);

    const existing = await this.findExpenseInTripOrThrow(tripId, expenseId);

    await this.prisma.expense.delete({
      where: {
        id: existing.id,
      },
    });
  }

  private async findExpenseInTripOrThrow(tripId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id: expenseId,
        tripId,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  private normalizeMoney(value: string): string {
    const trimmed = value.trim();

    if (!MONEY_PATTERN.test(trimmed)) {
      throw new BadRequestException(
        'amount must be a valid monetary amount with up to 2 decimal places',
      );
    }

    const [integerPart, decimalPart = ''] = trimmed.split('.');

    const isZero = integerPart === '0' && (decimalPart === '' || /^0+$/.test(decimalPart));

    if (isZero) {
      throw new BadRequestException('amount must be greater than 0');
    }

    return `${integerPart}.${decimalPart.padEnd(2, '0')}`;
  }

  private normalizeNullableText(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed || null;
  }

  private serializeExpense(
    expense: NonNullable<Awaited<ReturnType<PrismaService['expense']['findFirst']>>>,
  ) {
    return {
      id: expense.id,
      tripId: expense.tripId,
      title: expense.title,
      category: expense.category,
      amount: expense.amount.toFixed(2),
      spentAt: expense.spentAt,
      notes: expense.notes,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }
}
