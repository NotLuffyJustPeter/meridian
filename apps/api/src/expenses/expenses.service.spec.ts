import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { PrismaService } from '../database/prisma.service';
import { TripsService } from '../trips/trips.service';
import { ExpensesService } from './expenses.service';

const OWNER_ID = '54c8aabc-d305-421d-8e61-b99e563131f9';

const TRIP_ID = 'b8658c9d-f7b0-4839-99f1-f0fcacb3b97e';

const EXPENSE_ID = '2d1a122f-fd20-491f-9acd-ad085326a2df';

const CREATED_AT = new Date('2026-08-21T05:19:15.685Z');

const UPDATED_AT = new Date('2026-08-21T05:20:15.685Z');

type ExpenseCategoryValue =
  'ACCOMMODATION' | 'FOOD' | 'TRANSPORT' | 'ACTIVITIES' | 'SHOPPING' | 'HEALTH' | 'OTHER';

type DecimalLike = {
  toFixed: (digits?: number) => string;
};

type TripRecord = {
  id: string;
  currency: string;
};

type ExpenseRecord = {
  id: string;
  tripId: string;
  title: string;
  category: ExpenseCategoryValue;
  amount: DecimalLike;
  spentAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExpenseCreateMock = (args: unknown) => Promise<ExpenseRecord>;

type ExpenseFindManyMock = (args: unknown) => Promise<ExpenseRecord[]>;

type ExpenseFindFirstMock = (args: unknown) => Promise<ExpenseRecord | null>;

type ExpenseUpdateMock = (args: unknown) => Promise<ExpenseRecord>;

type ExpenseDeleteMock = (args: unknown) => Promise<ExpenseRecord>;

type FindOwnedTripMock = (ownerId: string, tripId: string) => Promise<TripRecord>;

function decimal(value: string): DecimalLike {
  return {
    toFixed: () => value,
  };
}

function expenseRecord(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  return {
    id: EXPENSE_ID,
    tripId: TRIP_ID,
    title: 'Malpensa Express',
    category: 'TRANSPORT',
    amount: decimal('13.00'),
    spentAt: new Date('2026-10-10T08:00:00.000Z'),
    notes: 'Airport transfer',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

describe('ExpensesService', () => {
  let service: ExpensesService;

  let expenseCreate: jest.Mock<ExpenseCreateMock>;

  let expenseFindMany: jest.Mock<ExpenseFindManyMock>;

  let expenseFindFirst: jest.Mock<ExpenseFindFirstMock>;

  let expenseUpdate: jest.Mock<ExpenseUpdateMock>;

  let expenseDelete: jest.Mock<ExpenseDeleteMock>;

  let findOwnedTripOrThrow: jest.Mock<FindOwnedTripMock>;

  beforeEach(() => {
    expenseCreate = jest.fn<ExpenseCreateMock>();

    expenseFindMany = jest.fn<ExpenseFindManyMock>();

    expenseFindFirst = jest.fn<ExpenseFindFirstMock>();

    expenseUpdate = jest.fn<ExpenseUpdateMock>();

    expenseDelete = jest.fn<ExpenseDeleteMock>();

    findOwnedTripOrThrow = jest.fn<FindOwnedTripMock>();

    const prisma = {
      expense: {
        create: expenseCreate,
        findMany: expenseFindMany,
        findFirst: expenseFindFirst,
        update: expenseUpdate,
        delete: expenseDelete,
      },
    } as unknown as PrismaService;

    const tripsService = {
      findOwnedTripOrThrow,
    } as unknown as TripsService;

    service = new ExpensesService(prisma, tripsService);

    findOwnedTripOrThrow.mockResolvedValue({
      id: TRIP_ID,
      currency: 'EUR',
    });
  });

  it('creates and normalizes an expense', async () => {
    expenseCreate.mockResolvedValue(expenseRecord());

    const result = await service.create(OWNER_ID, TRIP_ID, {
      title: '  Malpensa Express  ',
      category: 'TRANSPORT',
      amount: '13',
      spentAt: '2026-10-10T08:00:00.000Z',
      notes: '  Airport transfer  ',
    });

    expect(expenseCreate).toHaveBeenCalledWith({
      data: {
        tripId: TRIP_ID,
        title: 'Malpensa Express',
        category: 'TRANSPORT',
        amount: '13.00',
        spentAt: new Date('2026-10-10T08:00:00.000Z'),
        notes: 'Airport transfer',
      },
    });

    expect(result.amount).toBe('13.00');
  });

  it('accepts the Decimal(14,2) maximum expense amount', async () => {
    expenseCreate.mockResolvedValue(
      expenseRecord({
        amount: decimal('999999999999.99'),
      }),
    );

    const result = await service.create(OWNER_ID, TRIP_ID, {
      title: 'Maximum amount',
      amount: '999999999999.99',
      spentAt: '2026-10-10T08:00:00.000Z',
    });

    expect(result.amount).toBe('999999999999.99');
  });

  it('rejects over-max and scientific expense amounts', async () => {
    await expect(
      service.create(OWNER_ID, TRIP_ID, {
        title: 'Too large',
        amount: '1000000000000.00',
        spentAt: '2026-10-10T08:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.create(OWNER_ID, TRIP_ID, {
        title: 'Scientific',
        amount: '1e3',
        spentAt: '2026-10-10T08:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('defaults category to OTHER', async () => {
    expenseCreate.mockResolvedValue(
      expenseRecord({
        category: 'OTHER',
      }),
    );

    await service.create(OWNER_ID, TRIP_ID, {
      title: 'Tip',
      amount: '5.5',
      spentAt: '2026-10-10T10:00:00.000Z',
    });

    expect(expenseCreate).toHaveBeenCalledWith({
      data: {
        tripId: TRIP_ID,
        title: 'Tip',
        category: 'OTHER',
        amount: '5.50',
        spentAt: new Date('2026-10-10T10:00:00.000Z'),
      },
    });
  });

  it('lists owned expenses newest first', async () => {
    expenseFindMany.mockResolvedValue([expenseRecord()]);

    const result = await service.findAllOwned(OWNER_ID, TRIP_ID);

    expect(expenseFindMany).toHaveBeenCalledWith({
      where: {
        tripId: TRIP_ID,
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

    expect(result).toHaveLength(1);
  });

  it('updates supplied fields and clears notes with null', async () => {
    expenseFindFirst.mockResolvedValue(expenseRecord());

    expenseUpdate.mockResolvedValue(
      expenseRecord({
        title: 'Malpensa Express Ticket',
        amount: decimal('15.50'),
        notes: null,
      }),
    );

    const result = await service.update(OWNER_ID, TRIP_ID, EXPENSE_ID, {
      title: '  Malpensa Express Ticket  ',
      amount: '15.5',
      notes: null,
    });

    expect(expenseUpdate).toHaveBeenCalledWith({
      where: {
        id: EXPENSE_ID,
      },
      data: {
        title: 'Malpensa Express Ticket',
        amount: '15.50',
        notes: null,
      },
    });

    expect(result.amount).toBe('15.50');

    expect(result.notes).toBeNull();
  });

  it('rejects empty updates', async () => {
    await expect(service.update(OWNER_ID, TRIP_ID, EXPENSE_ID, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(expenseFindFirst).not.toHaveBeenCalled();

    expect(expenseUpdate).not.toHaveBeenCalled();
  });

  it('rejects zero amounts', async () => {
    await expect(
      service.create(OWNER_ID, TRIP_ID, {
        title: 'Invalid',
        amount: '0',
        spentAt: '2026-10-10T10:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(expenseCreate).not.toHaveBeenCalled();
  });

  it('hides expenses when trip ownership fails', async () => {
    findOwnedTripOrThrow.mockRejectedValue(new NotFoundException('Trip not found'));

    await expect(service.findOne(OWNER_ID, TRIP_ID, EXPENSE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(expenseFindFirst).not.toHaveBeenCalled();
  });

  it('deletes an owned expense', async () => {
    expenseFindFirst.mockResolvedValue(expenseRecord());

    expenseDelete.mockResolvedValue(expenseRecord());

    await service.remove(OWNER_ID, TRIP_ID, EXPENSE_ID);

    expect(expenseDelete).toHaveBeenCalledWith({
      where: {
        id: EXPENSE_ID,
      },
    });
  });
});
