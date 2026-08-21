import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AI_PROVIDER, type AiProvider } from './../src/ai/providers/ai.provider';
import type { AiProviderRequest } from './../src/ai/types/ai-recommendation.types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import { WEATHER_PROVIDER, type WeatherProvider } from './../src/weather/weather.provider';
import type { ProviderForecast, WeatherLocation } from './../src/weather/weather.types';

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

interface AiResponse {
  tripId: string;
  model: string;
  summary: string;
  recommendations: Array<{
    id: string;
    day: string;
    title: string;
    estimatedCost: string;
    currency: string;
  }>;
  insights: string[];
}

const weatherLocation: WeatherLocation = {
  name: 'Milan',
  country: 'Italy',
  latitude: 45.46427,
  longitude: 9.18951,
};

const weatherForecast: ProviderForecast = {
  days: [
    {
      date: '2026-08-21',
      weatherCode: 1,
      temperatureMaxC: 28,
      temperatureMinC: 18,
      precipitationProbabilityMax: 10,
      precipitationMm: 0,
      windSpeedMaxKmh: 14,
      sunrise: '2026-08-21T06:25',
      sunset: '2026-08-21T20:20',
    },
    {
      date: '2026-08-22',
      weatherCode: 61,
      temperatureMaxC: 24,
      temperatureMinC: 17,
      precipitationProbabilityMax: 70,
      precipitationMm: 5,
      windSpeedMaxKmh: 20,
      sunrise: '2026-08-22T06:26',
      sunset: '2026-08-22T20:18',
    },
  ],
};

const weatherProvider: WeatherProvider = {
  resolveLocation() {
    return Promise.resolve(weatherLocation);
  },

  getForecast() {
    return Promise.resolve(weatherForecast);
  },
};

let capturedRequest: AiProviderRequest | null = null;

const aiProvider: AiProvider = {
  generateRecommendations(providerRequest) {
    capturedRequest = providerRequest;

    return Promise.resolve({
      summary: 'A balanced Milan proposal.',
      recommendations: [
        {
          day: '2026-08-21',
          title: 'Explore Brera',
          category: 'SIGHTSEEING',
          suggestedStartTime: '10:00',
          suggestedEndTime: '12:00',
          location: 'Brera, Milan',
          reason: 'Fits culture and architecture interests.',
          estimatedCost: 25,
          weatherAware: true,
        },
      ],
      insights: ['Keep outdoor time earlier.'],
    });
  },

  getModelName() {
    return 'gemini-e2e';
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

describe('AI API (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  let initialized = false;

  const userA = {
    name: 'AI Traveler A',
    email: 'ai-a@meridian.local',
    password: 'MeridianE2e123!',
  };

  const userB = {
    name: 'AI Traveler B',
    email: 'ai-b@meridian.local',
    password: 'MeridianE2e123!',
  };

  const defaultTrip: CreateTripPayload = {
    name: 'Milan AI Weekend',
    destination: 'Milan, Italy',
    startDate: '2026-08-21T00:00:00.000Z',
    endDate: '2026-08-22T00:00:00.000Z',
    timezone: 'Europe/Rome',
    currency: 'eur',
  };

  async function cleanDatabase(): Promise<void> {
    assertTestDatabase();

    await prisma.authSession.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.user.deleteMany();

    capturedRequest = null;
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

    return unwrap(parseJson<PossiblyWrapped<LoginResponseData>>(loginResponse));
  }

  async function createTrip(accessToken: string): Promise<TripResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(defaultTrip)
      .expect(201);

    return unwrap(parseJson<PossiblyWrapped<TripResponse>>(response));
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

  it('generates a proposal using owner-scoped journey context without persisting activities', async () => {
    const login = await registerAndLogin(userA);

    const trip = await createTrip(login.accessToken);

    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        pace: 'BALANCED',
        interests: ['CULTURE', 'ARCHITECTURE'],
        budgetPreference: 'BALANCED',
        notes: 'Prefer local experiences',
      })
      .expect(200);

    const result = unwrap(parseJson<PossiblyWrapped<AiResponse>>(response));

    expect(result.tripId).toBe(trip.id);

    expect(result.model).toBe('gemini-e2e');

    expect(result.recommendations[0]).toMatchObject({
      day: '2026-08-21',
      estimatedCost: '25.00',
      currency: 'EUR',
    });

    expect(capturedRequest?.context.trip.destination).toBe('Milan, Italy');

    expect(capturedRequest?.context.weather.availability).toBe('AVAILABLE');

    const activityCount = await prisma.activity.count();

    expect(activityCount).toBe(0);
  });

  it('hides another owners trip from the AI endpoint', async () => {
    const loginA = await registerAndLogin(userA);

    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .send({})
      .expect(404);

    expect(capturedRequest).toBeNull();
  });

  it('requires authentication and validates planning preferences', async () => {
    const login = await registerAndLogin(userA);

    const trip = await createTrip(login.accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .send({})
      .expect(401);

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        pace: 'IMPOSSIBLE',
        interests: [],
        budgetPreference: 'BALANCED',
      })
      .expect(400);
  });
});
