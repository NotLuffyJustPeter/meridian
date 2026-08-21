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

interface ExpenseResponse {
  id: string;
  tripId: string;
  title: string;
  category: string;
  amount: string;
  spentAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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

describe('Expenses API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let initialized = false;

  const userA = {
    name: 'Expense Traveler A',
    email: 'expenses-a@meridian.local',
    password: 'MeridianE2e123!',
  };

  const userB = {
    name: 'Expense Traveler B',
    email: 'expenses-b@meridian.local',
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
        name: 'Expense Journey',
        destination: 'Milan, Italy',
        startDate: '2026-10-10T00:00:00.000Z',
        endDate: '2026-10-18T00:00:00.000Z',
        timezone: 'Europe/Rome',
        currency: 'eur',
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<TripResponse>>(response));
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

  it('requires authentication', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    await request(app.getHttpServer()).get(`/api/v1/trips/${trip.id}/expenses`).expect(401);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .send({
        title: 'Dinner',
        amount: '40',
        spentAt: '2026-10-10T19:00:00.000Z',
      })
      .expect(401);
  });

  it('creates, lists, gets, updates and deletes an expense', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Malpensa Express',
        category: 'TRANSPORT',
        amount: '13',
        spentAt: '2026-10-10T08:00:00.000Z',
        notes: 'Airport transfer',
      })
      .expect(201);

    const created = parseJson<ExpenseResponse>(createResponse);

    expect(created.amount).toBe('13.00');

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const expenses = parseJson<ExpenseResponse[]>(listResponse);

    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.id).toBe(created.id);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/expenses/${created.id}`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/expenses/${created.id}`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Malpensa Express Ticket',
        amount: '15.5',
        notes: null,
      })
      .expect(200);

    const updated = parseJson<ExpenseResponse>(updateResponse);

    expect(updated.id).toBe(created.id);
    expect(updated.amount).toBe('15.50');
    expect(updated.notes).toBeNull();

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}/expenses/${created.id}`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/expenses/${created.id}`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(404);
  });

  it('rejects invalid inputs and empty patches', async () => {
    const login = await registerAndLogin(userA);
    const trip = await createTrip(login.accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Invalid',
        category: 'FOOD',
        amount: '0',
        spentAt: '2026-10-10T12:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Maximum',
        category: 'OTHER',
        amount: '999999999999.99',
        spentAt: '2026-10-10T12:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Too large',
        category: 'OTHER',
        amount: '1000000000000.00',
        spentAt: '2026-10-10T12:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Scientific',
        category: 'OTHER',
        amount: '1e3',
        spentAt: '2026-10-10T12:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Invalid',
        category: 'NOT_REAL',
        amount: '20',
        spentAt: '2026-10-10T12:00:00.000Z',
      })
      .expect(400);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        title: 'Valid',
        amount: '20',
        spentAt: '2026-10-10T12:00:00.000Z',
      })
      .expect(201);

    const created = parseJson<ExpenseResponse>(createResponse);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/expenses/${created.id}`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({})
      .expect(400);
  });

  it('hides expenses from another user', async () => {
    const loginA = await registerAndLogin(userA);
    const loginB = await registerAndLogin(userB);
    const trip = await createTrip(loginA.accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        title: 'Dinner',
        category: 'FOOD',
        amount: '40',
        spentAt: '2026-10-10T19:00:00.000Z',
      })
      .expect(201);

    const created = parseJson<ExpenseResponse>(createResponse);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/expenses/${created.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .send({
        amount: '999',
      })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}/expenses/${created.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);
  });
});
