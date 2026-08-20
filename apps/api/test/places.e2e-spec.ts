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

interface PlaceResponse {
  id: string;
  tripId: string;
  name: string;

  category:
    | 'LANDMARK'
    | 'FOOD'
    | 'LODGING'
    | 'SHOPPING'
    | 'TRANSPORT'
    | 'ENTERTAINMENT'
    | 'NATURE'
    | 'OTHER';

  address: string | null;

  latitude: number | null;

  longitude: number | null;

  notes: string | null;

  website: string | null;

  sourceProvider: string | null;

  sourcePlaceId: string | null;

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

describe('Places API (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  let initialized = false;

  const userA = {
    name: 'Places Traveler A',

    email: 'places-a@meridian.local',

    password: 'PlacesE2e123!',
  };

  const userB = {
    name: 'Places Traveler B',

    email: 'places-b@meridian.local',

    password: 'PlacesE2e123!',
  };

  const defaultTrip: CreateTripPayload = {
    name: 'Japan Autumn',

    destination: 'Tokyo, Kyoto & Osaka',

    startDate: '2027-11-05T00:00:00.000Z',

    endDate: '2027-11-18T00:00:00.000Z',

    timezone: 'Asia/Tokyo',

    currency: 'JPY',
  };

  async function cleanDatabase(): Promise<void> {
    assertTestDatabase();

    await prisma.place.deleteMany();

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

  async function createTrip(accessToken: string): Promise<TripResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(defaultTrip)
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<TripResponse>>(response));
  }

  async function createPlace(
    accessToken: string,

    tripId: string,
  ): Promise<PlaceResponse> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '  Meiji Shrine  ',

        category: 'LANDMARK',

        address: '1-1 Yoyogikamizonocho, Shibuya, Tokyo',

        latitude: 35.6764,

        longitude: 139.6993,

        notes: 'Visit early',

        website: 'https://www.meijijingu.or.jp/',
      })
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<PlaceResponse>>(response));
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

  it('creates, lists, reads, updates and deletes an owned place', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    const place = await createPlace(loginA.accessToken, trip.id);

    expect(place.name).toBe('Meiji Shrine');

    expect(place.category).toBe('LANDMARK');

    expect(place.latitude).toBe(35.6764);

    expect(place.longitude).toBe(139.6993);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/places`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const places = parseJson<PlaceResponse[]>(listResponse);

    expect(places).toHaveLength(1);

    expect(places[0]?.id).toBe(place.id);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(200);

    const detail = unwrap(parseJson<PossiblyWrapped<PlaceResponse>>(detailResponse));

    expect(detail.id).toBe(place.id);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        notes: 'Go before 9 AM',
      })
      .expect(200);

    const updated = unwrap(parseJson<PossiblyWrapped<PlaceResponse>>(updateResponse));

    expect(updated.notes).toBe('Go before 9 AM');

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(404);

    const stored = await prisma.place.findUnique({
      where: {
        id: place.id,
      },
    });

    expect(stored).toBeNull();
  });

  it('allows optional place data to be cleared', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    const place = await createPlace(loginA.accessToken, trip.id);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        address: null,

        latitude: null,

        longitude: null,

        notes: null,

        website: null,

        sourceProvider: null,

        sourcePlaceId: null,
      })
      .expect(200);

    const updated = unwrap(parseJson<PossiblyWrapped<PlaceResponse>>(response));

    expect(updated.address).toBeNull();

    expect(updated.latitude).toBeNull();

    expect(updated.longitude).toBeNull();

    expect(updated.notes).toBeNull();

    expect(updated.website).toBeNull();
  });

  it('hides trips and places from other users', async () => {
    const loginA = await registerAndLogin(userA);

    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    const place = await createPlace(loginA.accessToken, trip.id);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/places`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/places`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .send({
        name: 'Stolen place',
      })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .send({
        name: 'Stolen place',
      })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);

    const stored = await prisma.place.findUnique({
      where: {
        id: place.id,
      },
    });

    expect(stored).not.toBeNull();
  });

  it('rejects invalid place mutations', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    const place = await createPlace(loginA.accessToken, trip.id);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/places`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        name: 'Broken coordinates',

        latitude: 35.6764,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/places`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        name: 'Invalid latitude',

        latitude: 120,

        longitude: 139,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/places`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        name: 'Invalid website',

        website: 'not-a-url',
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        name: null,
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/trips/${trip.id}/places/${place.id}`)
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .send({
        latitude: null,
      })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/trips/not-a-uuid/places')
      .set('Authorization', `Bearer ${loginA.accessToken}`)
      .expect(400);
  });

  it('requires authentication', async () => {
    const loginA = await registerAndLogin(userA);

    const trip = await createTrip(loginA.accessToken);

    await request(app.getHttpServer()).get(`/api/v1/trips/${trip.id}/places`).expect(401);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/places`)
      .send({
        name: 'Unauthorized place',
      })
      .expect(401);
  });
});
