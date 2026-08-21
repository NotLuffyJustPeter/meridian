import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';

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
  accessRole: 'OWNER' | 'EDITOR' | 'VIEWER';
}

interface CollaboratorData {
  id: string;
  tripId: string;
  userId: string;
  role: 'EDITOR' | 'VIEWER';
  user: {
    id: string;
    email: string;
    name: string;
  };
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

describe('Trip collaboration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let initialized = false;

  const owner = {
    name: 'Collaboration Owner',
    email: 'collab-owner@meridian.local',
    password: 'MeridianE2e123!',
  };

  const editor = {
    name: 'Collaboration Editor',
    email: 'collab-editor@meridian.local',
    password: 'MeridianE2e123!',
  };

  const outsider = {
    name: 'Collaboration Outsider',
    email: 'collab-outsider@meridian.local',
    password: 'MeridianE2e123!',
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

  async function createTrip(accessToken: string): Promise<TripData> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Shared Tokyo',
        destination: 'Tokyo, Japan',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-03T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
        currency: 'JPY',
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<TripData>>(response));
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

  it('lets the owner add and list a collaborator', async () => {
    const ownerLogin = await registerAndLogin(owner);
    const editorLogin = await registerAndLogin(editor);
    const trip = await createTrip(ownerLogin.accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: editor.email,
        role: 'EDITOR',
      })
      .expect(201);

    const collaborator = unwrap(parseJson<PossiblyWrapped<CollaboratorData>>(createResponse));

    expect(collaborator.userId).toBe(editorLogin.user.id);
    expect(collaborator.role).toBe('EDITOR');

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .expect(200);

    const list = parseJson<CollaboratorData[]>(listResponse);

    expect(list).toHaveLength(1);
  });

  it('shows shared trips to collaborators and gives them itinerary access', async () => {
    const ownerLogin = await registerAndLogin(owner);
    const editorLogin = await registerAndLogin(editor);
    const trip = await createTrip(ownerLogin.accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: editor.email,
        role: 'EDITOR',
      })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/trips')
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .expect(200);

    const sharedTrips = parseJson<TripData[]>(listResponse);

    expect(sharedTrips).toHaveLength(1);
    expect(sharedTrips[0]?.accessRole).toBe('EDITOR');

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/itinerary`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .expect(200);
  });

  it('allows editors to create itinerary activities', async () => {
    const ownerLogin = await registerAndLogin(owner);
    const editorLogin = await registerAndLogin(editor);
    const trip = await createTrip(ownerLogin.accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: editor.email,
        role: 'EDITOR',
      })
      .expect(201);

    const itineraryResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/itinerary`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .expect(200);

    const itinerary = unwrap(
      parseJson<
        PossiblyWrapped<{
          tripId: string;
          days: Array<{
            id: string;
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
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        title: 'Editor activity',
        category: 'SIGHTSEEING',
      })
      .expect(201);
  });

  it('lets viewers read the itinerary but blocks editing', async () => {
    const ownerLogin = await registerAndLogin(owner);
    const viewerLogin = await registerAndLogin(editor);
    const trip = await createTrip(ownerLogin.accessToken);

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: editor.email,
        role: 'VIEWER',
      })
      .expect(201);

    const collaborator = unwrap(parseJson<PossiblyWrapped<CollaboratorData>>(createResponse));

    const itineraryResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/itinerary`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .expect(200);

    const itinerary = unwrap(
      parseJson<
        PossiblyWrapped<{
          days: Array<{
            id: string;
          }>;
        }>
      >(itineraryResponse),
    );

    const firstDay = itinerary.days[0];

    if (!firstDay) {
      throw new Error('Expected itinerary day');
    }

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/itinerary/days/${firstDay.id}/activities`)
      .set('Authorization', `Bearer ${viewerLogin.accessToken}`)
      .send({
        title: 'Forbidden viewer activity',
      })
      .expect(404);

    expect(collaborator.role).toBe('VIEWER');
  });

  it('keeps trip mutation and collaborator management owner-only', async () => {
    const ownerLogin = await registerAndLogin(owner);
    const editorLogin = await registerAndLogin(editor);
    await registerAndLogin(outsider);

    const trip = await createTrip(ownerLogin.accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: editor.email,
        role: 'EDITOR',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        name: 'Editor cannot rename',
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .send({
        email: outsider.email,
        role: 'EDITOR',
      })
      .expect(404);
  });

  it('lets the owner change roles and revoke access', async () => {
    const ownerLogin = await registerAndLogin(owner);
    const editorLogin = await registerAndLogin(editor);
    const trip = await createTrip(ownerLogin.accessToken);

    const addResponse = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/collaborators`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        email: editor.email,
        role: 'EDITOR',
      })
      .expect(201);

    const collaborator = unwrap(parseJson<PossiblyWrapped<CollaboratorData>>(addResponse));

    const patchResponse = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/collaborators/${collaborator.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .send({
        role: 'VIEWER',
      })
      .expect(200);

    const updated = unwrap(parseJson<PossiblyWrapped<CollaboratorData>>(patchResponse));

    expect(updated.role).toBe('VIEWER');

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}/collaborators/${collaborator.id}`)
      .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${editorLogin.accessToken}`)
      .expect(404);
  });
});
