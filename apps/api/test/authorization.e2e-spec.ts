import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AI_PROVIDER, type AiProvider } from './../src/ai/providers/ai.provider';
import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/bootstrap/configure-application';
import { PrismaService } from './../src/database/prisma.service';
import { WEATHER_PROVIDER, type WeatherProvider } from './../src/weather/weather.provider';

interface LoginData {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface TripData {
  id: string;
  ownerId: string;
  name: string;
  destination: string;
  status: 'DRAFT' | 'PLANNED' | 'ARCHIVED';
  accessRole?: 'OWNER' | 'EDITOR' | 'VIEWER';
}

interface ItineraryData {
  tripId: string;
  days: Array<{
    id: string;
    activities: Array<{
      id: string;
    }>;
  }>;
}

interface PlaceData {
  id: string;
  tripId: string;
  name: string;
}

interface ExpenseData {
  id: string;
  tripId: string;
  title: string;
}

interface CollaboratorData {
  id: string;
  tripId: string;
  userId: string;
  role: 'EDITOR' | 'VIEWER';
}

interface ApiEnvelope<T> {
  data: T;
}

type PossiblyWrapped<T extends object> = T | ApiEnvelope<T>;

type Role = 'EDITOR' | 'VIEWER';

const password = 'MeridianE2e123!';

const aiProvider: AiProvider = {
  generateRecommendations() {
    return Promise.resolve({
      summary: 'Authorization-safe proposal.',
      recommendations: [
        {
          day: '2026-11-01',
          title: 'Walk through Ueno',
          category: 'SIGHTSEEING',
          suggestedStartTime: '10:00',
          suggestedEndTime: '11:30',
          location: 'Ueno Park, Tokyo',
          reason: 'Fits the current day.',
          estimatedCost: 0,
          weatherAware: false,
        },
      ],
      insights: ['Keep the day flexible.'],
    });
  },

  getModelName() {
    return 'authorization-e2e';
  },
};

const weatherProvider: WeatherProvider = {
  resolveLocation() {
    return Promise.resolve({
      name: 'Tokyo',
      country: 'Japan',
      latitude: 35.6762,
      longitude: 139.6503,
    });
  },

  getForecast() {
    return Promise.resolve({
      days: [],
    });
  },
};

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

describe('Authorization boundaries (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  let initialized = false;

  const owner = {
    name: 'Authorization Owner',
    email: 'authorization-owner@meridian.local',
    password,
  };

  const editor = {
    name: 'Authorization Editor',
    email: 'authorization-editor@meridian.local',
    password,
  };

  const viewer = {
    name: 'Authorization Viewer',
    email: 'authorization-viewer@meridian.local',
    password,
  };

  const outsider = {
    name: 'Authorization Outsider',
    email: 'authorization-outsider@meridian.local',
    password,
  };

  let ownerLogin: LoginData;

  let editorLogin: LoginData;

  let viewerLogin: LoginData;

  let outsiderLogin: LoginData;

  let tripA: TripData;

  let tripB: TripData;

  let editorMember: CollaboratorData;

  let viewerMember: CollaboratorData;

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
  }): Promise<LoginData> {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send(user).expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.password,
      })
      .expect(200);

    return unwrap(parseJson<PossiblyWrapped<LoginData>>(response));
  }

  async function createTrip(token: string, name: string): Promise<TripData> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        destination: 'Tokyo, Japan',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-03T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
        currency: 'JPY',
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<TripData>>(response));
  }

  async function addCollaborator(
    ownerToken: string,
    tripId: string,
    email: string,
    role: Role,
  ): Promise<CollaboratorData> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/collaborators`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email,
        role,
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<CollaboratorData>>(response));
  }

  async function getItinerary(token: string, tripId: string): Promise<ItineraryData> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripId}/itinerary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    return unwrap(parseJson<PossiblyWrapped<ItineraryData>>(response));
  }

  async function createPlace(token: string, tripId: string, name: string): Promise<PlaceData> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        category: 'LANDMARK',
        address: `${name}, Tokyo`,
        latitude: 35.6762,
        longitude: 139.6503,
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<PlaceData>>(response));
  }

  async function createExpense(token: string, tripId: string, title: string): Promise<ExpenseData> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title,
        category: 'FOOD',
        amount: '1000',
        spentAt: '2026-11-01T12:00:00.000Z',
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<ExpenseData>>(response));
  }

  async function createActivity(
    token: string,
    tripId: string,
    dayId: string,
    title: string,
    placeId?: string,
  ): Promise<{
    id: string;
  }> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/itinerary/days/${dayId}/activities`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title,
        category: 'SIGHTSEEING',
        ...(placeId
          ? {
              placeId,
            }
          : {}),
      })
      .expect(201);

    return unwrap(
      parseJson<
        PossiblyWrapped<{
          id: string;
        }>
      >(response),
    );
  }

  beforeAll(async () => {
    assertTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AI_PROVIDER)
      .useValue(aiProvider)
      .overrideProvider(WEATHER_PROVIDER)
      .useValue(weatherProvider)
      .compile();

    app = moduleFixture.createNestApplication();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    initialized = true;

    await cleanDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase();

    ownerLogin = await registerAndLogin(owner);

    editorLogin = await registerAndLogin(editor);

    viewerLogin = await registerAndLogin(viewer);

    outsiderLogin = await registerAndLogin(outsider);

    tripA = await createTrip(ownerLogin.accessToken, 'Authorization Trip A');

    tripB = await createTrip(outsiderLogin.accessToken, 'Authorization Trip B');

    editorMember = await addCollaborator(ownerLogin.accessToken, tripA.id, editor.email, 'EDITOR');

    viewerMember = await addCollaborator(ownerLogin.accessToken, tripA.id, viewer.email, 'VIEWER');
  });

  afterAll(async () => {
    if (!initialized) {
      return;
    }

    await cleanDatabase();
    await app.close();
  });

  it('enforces read access for owner, editor, viewer, and outsider', async () => {
    for (const token of [
      ownerLogin.accessToken,
      editorLogin.accessToken,
      viewerLogin.accessToken,
    ]) {
      await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripA.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripA.id}/itinerary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripA.id}/places`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripA.id}/budget/overview`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/trips/${tripA.id}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${outsiderLogin.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripA.id}/itinerary`)
      .set('Authorization', `Bearer ${outsiderLogin.accessToken}`)
      .expect(404);
  });

  it('allows editor content mutations but keeps owner-only controls protected', async () => {
    const itinerary = await getItinerary(editorLogin.accessToken, tripA.id);

    const day = itinerary.days[0];

    expect(day).toBeDefined();

    if (!day) {
      throw new Error('Expected trip day');
    }

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/itinerary/days/${day.id}/activities`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        title: 'Editor activity',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        name: 'Editor place',
        category: 'LANDMARK',
      })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${tripA.id}/budget`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        totalAmount: '100000',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/expenses`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        title: 'Editor lunch',
        category: 'FOOD',
        amount: '1500',
        spentAt: '2026-11-01T12:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        status: 'PLANNED',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/collaborators`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        email: outsider.email,
        role: 'VIEWER',
      })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        status: 'PLANNED',
      })
      .expect(200);
  });

  it('keeps viewers read-only across itinerary, places, budget, expenses, AI, and trip controls', async () => {
    const itinerary = await getItinerary(viewerLogin.accessToken, tripA.id);

    const day = itinerary.days[0];

    expect(day).toBeDefined();

    if (!day) {
      throw new Error('Expected trip day');
    }

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/itinerary/days/${day.id}/activities`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({
        title: 'Viewer mutation',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({
        name: 'Viewer place',
      })
      .expect(404);

    await request(app.getHttpServer())
      .put(`/api/v1/trips/${tripA.id}/budget`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({
        totalAmount: '100000',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/expenses`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({
        title: 'Viewer expense',
        category: 'OTHER',
        amount: '500',
        spentAt: '2026-11-01T12:00:00.000Z',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({})
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({
        status: 'PLANNED',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/collaborators`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({
        email: outsider.email,
        role: 'VIEWER',
      })
      .expect(404);
  });

  it('rejects cross-trip resource identifiers without leaking the foreign resource', async () => {
    const itineraryA = await getItinerary(ownerLogin.accessToken, tripA.id);

    const itineraryB = await getItinerary(outsiderLogin.accessToken, tripB.id);

    const dayA = itineraryA.days[0];

    const dayB = itineraryB.days[0];

    expect(dayA).toBeDefined();

    expect(dayB).toBeDefined();

    if (!dayA || !dayB) {
      throw new Error('Expected trip days');
    }

    const placeA = await createPlace(ownerLogin.accessToken, tripA.id, 'Trip A place');

    const placeB = await createPlace(outsiderLogin.accessToken, tripB.id, 'Trip B place');

    const activityA = await createActivity(
      ownerLogin.accessToken,
      tripA.id,
      dayA.id,
      'Trip A activity',
      placeA.id,
    );

    const activityB = await createActivity(
      outsiderLogin.accessToken,
      tripB.id,
      dayB.id,
      'Trip B activity',
      placeB.id,
    );

    const expenseB = await createExpense(outsiderLogin.accessToken, tripB.id, 'Trip B expense');

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/itinerary/days/${dayA.id}/activities`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        title: 'Foreign place injection',
        placeId: placeB.id,
      })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}/itinerary/days/${dayA.id}/activities/${activityB.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        title: 'Cross-trip overwrite',
      })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}/places/${placeB.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        name: 'Cross-trip place overwrite',
      })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}/expenses/${expenseB.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        amount: '9999',
      })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}/itinerary/days/${dayA.id}/activities/reorder`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        activityIds: [activityA.id, activityB.id],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/itinerary/days/${dayB.id}/activities`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        title: 'Foreign day injection',
      })
      .expect(404);
  });

  it('applies collaborator role changes and removals immediately to existing tokens', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        name: 'Before downgrade',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}/collaborators/${editorMember.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        role: 'VIEWER',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        name: 'After downgrade',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({})
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}/collaborators/${editorMember.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        role: 'EDITOR',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/places`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        name: 'After promotion',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${tripA.id}/collaborators/${editorMember.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .expect(404);
  });

  it('protects collaborator and lifecycle edge cases', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: editor.email,
        role: 'EDITOR',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: owner.email,
        role: 'VIEWER',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripA.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: 'missing-user@meridian.local',
        role: 'VIEWER',
      })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        status: 'PLANNED',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        status: 'ARCHIVED',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/not-a-uuid`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        status: 'PLANNED',
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${tripA.id}/collaborators/not-a-uuid`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        role: 'VIEWER',
      })
      .expect(400);

    expect(viewerMember.role).toBe('VIEWER');
  });
});
