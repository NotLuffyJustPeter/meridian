import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

interface LoginResponse {
  data: {
    accessToken: string;
  };
}

interface TripResponse {
  id: string;
}

interface ActivityResponse {
  id: string;
  tripDayId: string;
  title: string;
  category: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  position: number;
}

interface TripDayResponse {
  id: string;
  tripId: string;
  date: string;
  dayNumber: number;
  activities: ActivityResponse[];
}

interface ItineraryResponse {
  tripId: string;
  startDate: string;
  endDate: string;
  timezone: string;
  days: TripDayResponse[];
}

const TEST_PASSWORD = 'MeridianTest123!';

function getResponseBody<T>(response: { body: unknown }): T {
  return response.body as T;
}

function assertTestDatabase(): void {
  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for E2E tests');
  }

  const parsed = new URL(databaseUrl);

  const databaseName = parsed.pathname.replace(/^\//, '');

  const allowedHosts = new Set(['localhost', '127.0.0.1']);

  if (
    databaseName !== 'meridian_test' ||
    !allowedHosts.has(parsed.hostname) ||
    parsed.port !== '5433'
  ) {
    throw new Error(
      `Refusing to run E2E tests against ${parsed.hostname}:${parsed.port}/${databaseName}`,
    );
  }
}

describe('Itinerary E2E', () => {
  let app: INestApplication;

  let httpServer: Server;

  let prisma: PrismaService;

  let ownerToken: string;

  let foreignToken: string;

  let tripId: string;

  async function cleanDatabase(): Promise<void> {
    await prisma.activity.deleteMany();

    await prisma.tripDay.deleteMany();

    await prisma.trip.deleteMany();

    await prisma.authSession.deleteMany();

    await prisma.user.deleteMany();
  }

  async function registerAndLogin(email: string, name: string): Promise<string> {
    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({
        name,
        email,
        password: TEST_PASSWORD,
      })
      .expect(201);

    const response = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: TEST_PASSWORD,
      })
      .expect(200);

    const body = getResponseBody<LoginResponse>(response);

    return body.data.accessToken;
  }

  async function createOwnerTrip(): Promise<string> {
    const response = await request(httpServer)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Japan Autumn',
        destination: 'Tokyo, Kyoto & Osaka',
        startDate: '2027-11-05T00:00:00.000Z',
        endDate: '2027-11-18T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
        currency: 'JPY',
      })
      .expect(201);

    const body = getResponseBody<TripResponse>(response);

    return body.id;
  }

  async function getOwnerItinerary(): Promise<ItineraryResponse> {
    const response = await request(httpServer)
      .get(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    return getResponseBody<ItineraryResponse>(response);
  }

  beforeAll(async () => {
    assertTestDatabase();

    const moduleFixture = await Test.createTestingModule({
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

    httpServer = app.getHttpServer() as Server;

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();

    ownerToken = await registerAndLogin('itinerary-owner@meridian.test', 'Itinerary Owner');

    foreignToken = await registerAndLogin('itinerary-foreign@meridian.test', 'Foreign User');

    tripId = await createOwnerTrip();
  });

  afterAll(async () => {
    if (prisma) {
      await cleanDatabase();
    }

    if (app) {
      await app.close();
    }
  });

  it('generates 14 days and remains idempotent', async () => {
    const first = await getOwnerItinerary();

    expect(first.days).toHaveLength(14);

    expect(first.days[0].dayNumber).toBe(1);

    expect(first.days[0].date).toBe('2027-11-05T00:00:00.000Z');

    expect(first.days[13].dayNumber).toBe(14);

    expect(first.days[13].date).toBe('2027-11-18T00:00:00.000Z');

    const firstIds = first.days.map((day) => day.id);

    const second = await getOwnerItinerary();

    expect(second.days).toHaveLength(14);

    expect(second.days.map((day) => day.id)).toEqual(firstIds);
  });

  it('creates, retrieves and partially updates activities', async () => {
    const itinerary = await getOwnerItinerary();

    const dayId = itinerary.days[0].id;

    const firstResponse = await request(httpServer)
      .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Arrive at Haneda Airport',
        description: 'Arrival in Tokyo',
        category: 'TRANSPORT',
        startTime: '09:00',
        endTime: '10:30',
        location: 'Haneda Airport',
      })
      .expect(201);

    const firstActivity = getResponseBody<ActivityResponse>(firstResponse);

    expect(firstActivity.position).toBe(0);

    const secondResponse = await request(httpServer)
      .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Lunch in Shibuya',
        category: 'FOOD',
        startTime: '13:00',
        endTime: '14:00',
      })
      .expect(201);

    const secondActivity = getResponseBody<ActivityResponse>(secondResponse);

    expect(secondActivity.position).toBe(1);

    const withActivities = await getOwnerItinerary();

    expect(withActivities.days[0].activities.map((activity) => activity.title)).toEqual([
      'Arrive at Haneda Airport',
      'Lunch in Shibuya',
    ]);

    const patchResponse = await request(httpServer)
      .patch(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/${firstActivity.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Arrive at Tokyo Haneda',
        endTime: '10:00',
        notes: 'Pick up Suica',
      })
      .expect(200);

    const updated = getResponseBody<ActivityResponse>(patchResponse);

    expect(updated.title).toBe('Arrive at Tokyo Haneda');

    expect(updated.startTime).toBe('09:00');

    expect(updated.endTime).toBe('10:00');

    expect(updated.notes).toBe('Pick up Suica');
  });

  it('rejects invalid activity input and invalid time ranges', async () => {
    const itinerary = await getOwnerItinerary();

    const dayId = itinerary.days[0].id;

    await request(httpServer)
      .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Broken activity',
        startTime: '9pm',
      })
      .expect(400);

    const activityResponse = await request(httpServer)
      .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Valid activity',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);

    const activity = getResponseBody<ActivityResponse>(activityResponse);

    await request(httpServer)
      .patch(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/${activity.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        startTime: '17:00',
        endTime: '15:00',
      })
      .expect(400);

    await request(httpServer)
      .patch(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/${activity.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect(400);
  });

  it('reorders all activities and persists the order', async () => {
    const itinerary = await getOwnerItinerary();

    const dayId = itinerary.days[0].id;

    const createActivity = async (title: string): Promise<ActivityResponse> => {
      const response = await request(httpServer)
        .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title,
          category: 'OTHER',
        })
        .expect(201);

      return getResponseBody<ActivityResponse>(response);
    };

    const activityA = await createActivity('Activity A');

    const activityB = await createActivity('Activity B');

    const activityC = await createActivity('Activity C');

    const reorderResponse = await request(httpServer)
      .patch(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        activityIds: [activityC.id, activityA.id, activityB.id],
      })
      .expect(200);

    const reordered = getResponseBody<ActivityResponse[]>(reorderResponse);

    expect(
      reordered.map((activity) => ({
        title: activity.title,
        position: activity.position,
      })),
    ).toEqual([
      {
        title: 'Activity C',
        position: 0,
      },
      {
        title: 'Activity A',
        position: 1,
      },
      {
        title: 'Activity B',
        position: 2,
      },
    ]);

    const persisted = await getOwnerItinerary();

    expect(persisted.days[0].activities.map((activity) => activity.title)).toEqual([
      'Activity C',
      'Activity A',
      'Activity B',
    ]);

    await request(httpServer)
      .patch(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        activityIds: [activityC.id, activityA.id],
      })
      .expect(400);

    await request(httpServer)
      .patch(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        activityIds: [activityC.id, activityC.id, activityB.id],
      })
      .expect(400);
  });

  it('returns 404 when another user accesses itinerary resources', async () => {
    const itinerary = await getOwnerItinerary();

    const dayId = itinerary.days[0].id;

    const activityResponse = await request(httpServer)
      .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Owner activity',
      })
      .expect(201);

    const activity = getResponseBody<ActivityResponse>(activityResponse);

    await request(httpServer)
      .get(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(404);

    await request(httpServer)
      .patch(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/${activity.id}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({
        title: 'Stolen activity',
      })
      .expect(404);

    await request(httpServer)
      .delete(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/${activity.id}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(404);

    const ownerCheck = await getOwnerItinerary();

    expect(ownerCheck.days[0].activities[0].title).toBe('Owner activity');
  });

  it('deletes an activity and returns 404 when deleting it again', async () => {
    const itinerary = await getOwnerItinerary();

    const dayId = itinerary.days[0].id;

    const activityResponse = await request(httpServer)
      .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Temporary activity',
      })
      .expect(201);

    const activity = getResponseBody<ActivityResponse>(activityResponse);

    await request(httpServer)
      .delete(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/${activity.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);

    const afterDelete = await getOwnerItinerary();

    expect(afterDelete.days[0].activities).toHaveLength(0);

    await request(httpServer)
      .delete(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities/${activity.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });

  it('protects itinerary routes with authentication and UUID validation', async () => {
    const itinerary = await getOwnerItinerary();

    const dayId = itinerary.days[0].id;

    await request(httpServer).get(`/api/v1/trips/${tripId}/itinerary`).expect(401);

    await request(httpServer)
      .post(`/api/v1/trips/${tripId}/itinerary/days/not-a-uuid/activities`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Invalid',
      })
      .expect(400);

    await request(httpServer)
      .patch(`/api/v1/trips/not-a-uuid/itinerary/days/${dayId}/activities/reorder`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        activityIds: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(400);
  });
});
