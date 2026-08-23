import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

interface PublicUserResponse {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

interface LoginResponseData {
  user: PublicUserResponse;
  accessToken: string;
  refreshToken: string;
}

interface TripResponse {
  id: string;
  ownerId: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  timezone: string;
  currency: string;
  status: 'DRAFT' | 'PLANNED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

interface ApiEnvelope<T> {
  data: T;
}

type PossiblyWrapped<T extends object> = T | ApiEnvelope<T>;

interface CreateTripPayload {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  timezone: string;
  currency: string;
}

function parseJson<T>(response: { text: string }): T {
  const parsed: unknown = JSON.parse(response.text);

  return parsed as T;
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

describe('Trips API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let initialized = false;

  const userA = {
    name: 'Traveler A',
    email: 'trips-a@meridian.local',
    password: 'MeridianE2e123!',
  };

  const userB = {
    name: 'Traveler B',
    email: 'trips-b@meridian.local',
    password: 'MeridianE2e123!',
  };

  const defaultTrip: CreateTripPayload = {
    name: 'Northern Italy',
    destination: 'Milan, Italy',
    startDate: '2026-10-10T00:00:00.000Z',
    endDate: '2026-10-18T00:00:00.000Z',
    timezone: 'Europe/Rome',
    currency: 'eur',
  };

  async function cleanDatabase(): Promise<void> {
    assertTestDatabase();

    await prisma.authSession.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.user.deleteMany();
  }

  async function registerAndLogin(user: {
    name: string;
    email: string;
    password: string;
  }): Promise<LoginResponseData> {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(user).expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.password,
      })
      .expect(200);

    const payload = parseJson<PossiblyWrapped<LoginResponseData>>(loginResponse);

    return unwrap(payload);
  }

  async function createTrip(
    accessToken: string,
    payload: CreateTripPayload = defaultTrip,
  ): Promise<TripResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);

    const responsePayload = parseJson<PossiblyWrapped<TripResponse>>(response);

    return unwrap(responsePayload);
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
  });

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

  it('creates and lists only trips belonging to the authenticated user', async () => {
    const loginA = await registerAndLogin(userA);

    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    expect(trip.ownerId).toBe(loginA.user.id);

    expect(trip.name).toBe('Northern Italy');

    expect(trip.currency).toBe('EUR');

    expect(trip.status).toBe('DRAFT');

    const ownerListResponse = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const ownerTrips = parseJson<TripResponse[]>(ownerListResponse);

    expect(ownerTrips).toHaveLength(1);

    expect(ownerTrips[0]?.id).toBe(trip.id);

    const foreignListResponse = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(200);

    const foreignTrips = parseJson<TripResponse[]>(foreignListResponse);

    expect(foreignTrips).toHaveLength(0);
  });

  it('allows the owner to get a trip and hides it from other users', async () => {
    const loginA = await registerAndLogin(userA);

    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const payload = parseJson<PossiblyWrapped<TripResponse>>(response);

    const foundTrip = unwrap(payload);

    expect(foundTrip.id).toBe(trip.id);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/v1/trips/not-a-uuid')
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(400);
  });

  it('updates owned trips and prevents foreign updates', async () => {
    const loginA = await registerAndLogin(userA);

    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        name: 'Northern Italy Escape',
        currency: 'eur',
        status: 'PLANNED',
      })
      .expect(200);

    const updatePayload = parseJson<PossiblyWrapped<TripResponse>>(updateResponse);

    const updatedTrip = unwrap(updatePayload);

    expect(updatedTrip.name).toBe('Northern Italy Escape');

    expect(updatedTrip.currency).toBe('EUR');

    expect(updatedTrip.status).toBe('PLANNED');

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .send({
        name: 'Stolen Trip',
      })
      .expect(404);

    const verifyResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const verifyPayload = parseJson<PossiblyWrapped<TripResponse>>(verifyResponse);

    expect(unwrap(verifyPayload).name).toBe('Northern Italy Escape');
  });

  it('archives and restores an owned trip', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    const archiveResponse = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        status: 'ARCHIVED',
      })
      .expect(200);

    const archivePayload = parseJson<PossiblyWrapped<TripResponse>>(archiveResponse);

    expect(unwrap(archivePayload).status).toBe('ARCHIVED');

    const archivedTripResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const archivedTripPayload = parseJson<PossiblyWrapped<TripResponse>>(archivedTripResponse);

    expect(unwrap(archivedTripPayload).status).toBe('ARCHIVED');

    const restoreResponse = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        status: 'PLANNED',
      })
      .expect(200);

    const restorePayload = parseJson<PossiblyWrapped<TripResponse>>(restoreResponse);

    expect(unwrap(restorePayload).status).toBe('PLANNED');
  });

  it('prevents foreign deletes and allows the owner to permanently delete a trip', async () => {
    const loginA = await registerAndLogin(userA);

    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(404);

    const storedTrip = await prisma.trip.findUnique({
      where: {
        id: trip.id,
      },
    });

    expect(storedTrip).toBeNull();
  });

  it('cascades connected journey data when the owner deletes a trip', async () => {
    const loginA = await registerAndLogin(userA);
    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    const day = await prisma.tripDay.create({
      data: {
        tripId: trip.id,
        date: new Date('2026-10-10T00:00:00.000Z'),
        dayNumber: 1,
      },
    });

    const place = await prisma.place.create({
      data: {
        tripId: trip.id,
        name: 'Duomo di Milano',
        category: 'LANDMARK',
      },
    });

    const activity = await prisma.activity.create({
      data: {
        tripDayId: day.id,
        placeId: place.id,
        title: 'Visit the Duomo',
        category: 'SIGHTSEEING',
        position: 0,
      },
    });

    const budget = await prisma.budget.create({
      data: {
        tripId: trip.id,
        totalAmount: '1500.00',
      },
    });

    const limit = await prisma.budgetCategoryLimit.create({
      data: {
        budgetId: budget.id,
        category: 'FOOD',
        amount: '300.00',
      },
    });

    const expense = await prisma.expense.create({
      data: {
        tripId: trip.id,
        title: 'Dinner',
        category: 'FOOD',
        amount: '42.50',
        spentAt: new Date('2026-10-10T19:00:00.000Z'),
      },
    });

    const member = await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: loginB.user.id,
        role: 'VIEWER',
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(204);

    const [
      storedTrip,
      storedDay,
      storedPlace,
      storedActivity,
      storedBudget,
      storedLimit,
      storedExpense,
      storedMember,
    ] = await Promise.all([
      prisma.trip.findUnique({
        where: {
          id: trip.id,
        },
      }),
      prisma.tripDay.findUnique({
        where: {
          id: day.id,
        },
      }),
      prisma.place.findUnique({
        where: {
          id: place.id,
        },
      }),
      prisma.activity.findUnique({
        where: {
          id: activity.id,
        },
      }),
      prisma.budget.findUnique({
        where: {
          id: budget.id,
        },
      }),
      prisma.budgetCategoryLimit.findUnique({
        where: {
          id: limit.id,
        },
      }),
      prisma.expense.findUnique({
        where: {
          id: expense.id,
        },
      }),
      prisma.tripMember.findUnique({
        where: {
          id: member.id,
        },
      }),
    ]);

    expect(storedTrip).toBeNull();
    expect(storedDay).toBeNull();
    expect(storedPlace).toBeNull();
    expect(storedActivity).toBeNull();
    expect(storedBudget).toBeNull();
    expect(storedLimit).toBeNull();
    expect(storedExpense).toBeNull();
    expect(storedMember).toBeNull();
  });

  it('regenerates empty itinerary days when trip dates change', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    const initialItineraryResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/itinerary`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const initialItinerary = unwrap(
      parseJson<
        PossiblyWrapped<{
          tripId: string;
          days: Array<{
            id: string;
            dayNumber: number;
            date: string;
          }>;
        }>
      >(initialItineraryResponse),
    );

    expect(initialItinerary.days).toHaveLength(9);

    const oldDayIds = initialItinerary.days.map((day) => day.id);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        startDate: '2026-10-11T00:00:00.000Z',

        endDate: '2026-10-15T00:00:00.000Z',
      })
      .expect(200);

    const updatedTrip = unwrap(parseJson<PossiblyWrapped<TripResponse>>(updateResponse));

    expect(updatedTrip.startDate).toBe('2026-10-11T00:00:00.000Z');

    expect(updatedTrip.endDate).toBe('2026-10-15T00:00:00.000Z');

    const regeneratedResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/itinerary`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const regenerated = unwrap(
      parseJson<
        PossiblyWrapped<{
          tripId: string;
          days: Array<{
            id: string;
            dayNumber: number;
            date: string;
          }>;
        }>
      >(regeneratedResponse),
    );

    expect(regenerated.days).toHaveLength(5);

    expect(regenerated.days[0]?.dayNumber).toBe(1);

    expect(regenerated.days[4]?.dayNumber).toBe(5);

    const newDayIds = regenerated.days.map((day) => day.id);

    for (const oldDayId of oldDayIds) {
      expect(newDayIds).not.toContain(oldDayId);
    }

    const storedDayCount = await prisma.tripDay.count({
      where: {
        tripId: trip.id,
      },
    });

    expect(storedDayCount).toBe(5);
  });

  it('blocks trip date changes when itinerary activities already exist', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    const itineraryResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/itinerary`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const itinerary = unwrap(
      parseJson<
        PossiblyWrapped<{
          tripId: string;
          days: Array<{
            id: string;
            dayNumber: number;
            date: string;
          }>;
        }>
      >(itineraryResponse),
    );

    const firstDay = itinerary.days[0];

    expect(firstDay).toBeDefined();

    if (!firstDay) {
      throw new Error('Expected itinerary day');
    }

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/itinerary/days/${firstDay.id}/activities`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        title: 'Protected activity',
        category: 'SIGHTSEEING',
        startTime: '10:00',
        endTime: '11:00',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        startDate: '2026-10-11T00:00:00.000Z',

        endDate: '2026-10-15T00:00:00.000Z',
      })
      .expect(409);

    const verifyTripResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const storedTrip = unwrap(parseJson<PossiblyWrapped<TripResponse>>(verifyTripResponse));

    expect(storedTrip.startDate).toBe(trip.startDate);

    expect(storedTrip.endDate).toBe(trip.endDate);

    const activityCount = await prisma.activity.count({
      where: {
        tripDay: {
          tripId: trip.id,
        },
      },
    });

    expect(activityCount).toBe(1);
  });

  it('rejects invalid trip mutations and unauthenticated access', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        ...defaultTrip,
        startDate: '2026-10-20T00:00:00.000Z',
        endDate: '2026-10-10T00:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        startDate: '2026-10-25T00:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        name: null,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        startDate: null,
      })
      .expect(400);

    await request(app.getHttpServer()).get('/api/v1/trips').expect(401);

    await request(app.getHttpServer()).post('/api/v1/trips').send(defaultTrip).expect(401);
  });
});
