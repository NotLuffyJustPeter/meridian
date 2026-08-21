import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

interface LoginResponseData {
  user: {
    id: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface TripResponse {
  id: string;
  currency: string;
}

interface BudgetResponse {
  tripId: string;
  currency: string;
  configured: boolean;
  budget: {
    id: string;
    tripId: string;
    totalAmount: string;
  } | null;
}

interface CategoryLimitResponse {
  id: string;
  budgetId: string;
  category: string;
  amount: string;
}

interface BudgetOverviewResponse {
  totals: {
    budgetAmount: string | null;
    spentAmount: string;
    remainingAmount: string | null;
    usagePercentage: number | null;
    expensesCount: number;
  };
  categories: Array<{
    category: string;
    spentAmount: string;
    expensesCount: number;
    limitAmount: string | null;
    remainingAmount: string | null;
    usagePercentage: number | null;
  }>;
}

interface ApiEnvelope<T> {
  data: T;
}

type PossiblyWrapped<T extends object> = T | ApiEnvelope<T>;

function parseJson<T>(response: { text: string }): T {
  return JSON.parse(response.text) as T;
}

function unwrap<T extends object>(payload: PossiblyWrapped<T>): T {
  if ('data' in payload) {
    return payload.data;
  }

  return payload;
}

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing');
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\/+/, '');

  if (databaseName !== 'meridian_test') {
    throw new Error(`Refusing to modify database "${databaseName}".`);
  }
}

describe('Budget API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let initialized = false;

  const userA = {
    name: 'Budget Traveler A',
    email: 'budget-a@meridian.local',
    password: 'MeridianE2e123!',
  };

  const userB = {
    name: 'Budget Traveler B',
    email: 'budget-b@meridian.local',
    password: 'MeridianE2e123!',
  };

  async function cleanDatabase(): Promise<void> {
    assertTestDatabase();
    await prisma.authSession.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.user.deleteMany();
  }

  async function registerAndLogin(user: typeof userA): Promise<LoginResponseData> {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(user).expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.password,
      })
      .expect(200);

    return unwrap(parseJson<PossiblyWrapped<LoginResponseData>>(response));
  }

  async function createTrip(accessToken: string): Promise<TripResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Budget Journey',
        destination: 'Milan, Italy',
        startDate: '2026-10-10T00:00:00.000Z',
        endDate: '2026-10-18T00:00:00.000Z',
        timezone: 'Europe/Rome',
        currency: 'eur',
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<TripResponse>>(response));
  }

  async function configureBudget(
    accessToken: string,
    tripId: string,
    totalAmount = '1000',
  ): Promise<BudgetResponse> {
    const response = await request(app.getHttpServer())
      .put(`/api/v1/trips/${tripId}/budget`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        totalAmount,
      })
      .expect(200);

    return parseJson<BudgetResponse>(response);
  }

  beforeAll(async () => {
    assertTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);
    initialized = true;
    await cleanDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    if (!initialized) {
      return;
    }

    await cleanDatabase();
    await app.close();
  });

  it('keeps budget ownership protected', async () => {
    const loginA = await registerAndLogin(userA);
    const loginB = await registerAndLogin(userB);
    const trip = await createTrip(loginA.accessToken);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    expect(parseJson<BudgetResponse>(response).configured).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);
  });

  it('upserts one budget with exact two-decimal output', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    const created = await configureBudget(login.accessToken, trip.id, '35000');

    const updated = await configureBudget(login.accessToken, trip.id, '42500.5');

    expect(created.budget?.totalAmount).toBe('35000.00');
    expect(updated.budget?.id).toBe(created.budget?.id);
    expect(updated.budget?.totalAmount).toBe('42500.50');

    const rows = await prisma.budget.findMany({
      where: {
        tripId: trip.id,
      },
    });

    expect(rows).toHaveLength(1);
  });

  it('enforces Decimal(14,2) monetary bounds', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    const maximum = await configureBudget(login.accessToken, trip.id, '999999999999.99');

    expect(maximum.budget?.totalAmount).toBe('999999999999.99');

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        totalAmount: '1000000000000.00',
      })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        totalAmount: '1e3',
      })
      .expect(400);
  });

  it('keeps category limits inside the total budget', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    await configureBudget(login.accessToken, trip.id, '1000');

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({ amount: '600' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/TRANSPORT`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({ amount: '400.01' })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({ totalAmount: '599.99' })
      .expect(400);
  });

  it('requires a budget before category limits', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        amount: '400',
      })
      .expect(400);
  });

  it('creates, updates, lists and deletes category limits', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    await configureBudget(login.accessToken, trip.id);

    const createResponse = await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        amount: '400',
      })
      .expect(200);

    const created = parseJson<{
      categoryLimit: CategoryLimitResponse;
    }>(createResponse);

    expect(created.categoryLimit.amount).toBe('400.00');

    const updateResponse = await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        amount: '450.5',
      })
      .expect(200);

    const updated = parseJson<{
      categoryLimit: CategoryLimitResponse;
    }>(updateResponse);

    expect(updated.categoryLimit.id).toBe(created.categoryLimit.id);
    expect(updated.categoryLimit.amount).toBe('450.50');

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/budget/categories`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const list = parseJson<{
      categoryLimits: CategoryLimitResponse[];
    }>(listResponse);

    expect(list.categoryLimits).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(404);
  });

  it('rejects invalid categories and invalid amounts', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    await configureBudget(login.accessToken, trip.id);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/NOT_REAL`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        amount: '400',
      })
      .expect(400);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        amount: '0',
      })
      .expect(400);
  });

  it('calculates totals and category progress from real expenses', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    await configureBudget(login.accessToken, trip.id, '1000');

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        amount: '400',
      })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/TRANSPORT`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        amount: '250',
      })
      .expect(200);

    for (const expense of [
      {
        title: 'Dinner',
        category: 'FOOD',
        amount: '125.5',
        spentAt: '2026-10-10T19:00:00.000Z',
      },
      {
        title: 'Train',
        category: 'TRANSPORT',
        amount: '25',
        spentAt: '2026-10-11T08:00:00.000Z',
      },
      {
        title: 'Tip',
        category: 'OTHER',
        amount: '50',
        spentAt: '2026-10-11T20:00:00.000Z',
      },
    ]) {
      await request(app.getHttpServer())
        .post(`/api/v1/trips/${trip.id}/expenses`)
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send(expense)
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/budget/overview`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const overview = parseJson<BudgetOverviewResponse>(response);

    expect(overview.totals).toEqual({
      budgetAmount: '1000.00',
      spentAmount: '200.50',
      remainingAmount: '799.50',
      usagePercentage: 20.05,
      expensesCount: 3,
    });

    const food = overview.categories.find((category) => category.category === 'FOOD');

    expect(food).toEqual({
      category: 'FOOD',
      spentAmount: '125.50',
      expensesCount: 1,
      limitAmount: '400.00',
      remainingAmount: '274.50',
      usagePercentage: 31.38,
    });
  });

  it('protects analytics from foreign users', async () => {
    const loginA = await registerAndLogin(userA);
    const loginB = await registerAndLogin(userB);
    const trip = await createTrip(loginA.accessToken);

    await configureBudget(loginA.accessToken, trip.id);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${trip.id}/budget/categories/FOOD`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .send({
        amount: '999',
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/budget/overview`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);
  });
});
