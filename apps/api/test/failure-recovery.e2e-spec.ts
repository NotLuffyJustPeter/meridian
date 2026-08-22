import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import {
  AI_PROVIDER,
  AiProviderResponseError,
  AiProviderUnavailableError,
  type AiProvider,
} from './../src/ai/providers/ai.provider';
import type { AiProviderResult } from './../src/ai/types/ai-recommendation.types';
import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/bootstrap/configure-application';
import { PrismaService } from './../src/database/prisma.service';
import { GEOCODING_PROVIDER, type GeocodingProvider } from './../src/geocoding/geocoding.types';
import {
  WEATHER_PROVIDER,
  WeatherProviderUnavailableError,
  type WeatherProvider,
} from './../src/weather/weather.provider';

interface LoginData {
  accessToken: string;
}

interface TripData {
  id: string;
}

interface ApiEnvelope<T> {
  data: T;
}

type MaybeEnvelope<T extends object> = T | ApiEnvelope<T>;

type AiMode = 'success' | 'unavailable' | 'malformed' | 'unexpected';

type WeatherMode = 'success' | 'unavailable' | 'missing-location';

type GeocodingMode = 'success' | 'unavailable';

function unwrap<T extends object>(payload: MaybeEnvelope<T>): T {
  return 'data' in payload ? payload.data : payload;
}

function parseJson<T>(response: { text: string }): T {
  return JSON.parse(response.text) as T;
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

const successProposal: AiProviderResult = {
  summary: 'A resilient plan.',
  recommendations: [
    {
      day: '2026-11-01',
      title: 'Museum morning',
      category: 'SIGHTSEEING',
      suggestedStartTime: '10:00',
      suggestedEndTime: '12:00',
      location: 'Tokyo National Museum',
      reason: 'Keeps the morning focused.',
      estimatedCost: 1000,
      weatherAware: false,
    },
  ],
  insights: ['Keep the afternoon flexible.'],
};

describe('Failure and recovery boundaries (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  let aiMode: AiMode = 'success';

  let weatherMode: WeatherMode = 'success';

  let geocodingMode: GeocodingMode = 'success';

  let accessToken: string;

  let trip: TripData;

  const aiProvider: AiProvider = {
    generateRecommendations() {
      switch (aiMode) {
        case 'success':
          return Promise.resolve(successProposal);

        case 'unavailable':
          return Promise.reject(
            new AiProviderUnavailableError('Gemini is temporarily unavailable'),
          );

        case 'malformed':
          return Promise.reject(
            new AiProviderResponseError('Gemini returned malformed structured output'),
          );

        case 'unexpected':
          return Promise.reject(new Error('sensitive internal provider detail'));
      }
    },

    getModelName() {
      return 'failure-recovery-e2e';
    },
  };

  const weatherProvider: WeatherProvider = {
    resolveLocation() {
      if (weatherMode === 'unavailable') {
        return Promise.reject(new WeatherProviderUnavailableError('upstream weather detail'));
      }

      if (weatherMode === 'missing-location') {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        name: 'Tokyo',
        country: 'Japan',
        latitude: 35.6762,
        longitude: 139.6503,
      });
    },

    getForecast() {
      if (weatherMode === 'unavailable') {
        return Promise.reject(new WeatherProviderUnavailableError('upstream weather detail'));
      }

      return Promise.resolve({
        days: [],
      });
    },
  };

  const geocodingProvider: GeocodingProvider = {
    search() {
      if (geocodingMode === 'unavailable') {
        return Promise.reject(new ServiceUnavailableException('Geocoding provider is unavailable'));
      }

      return Promise.resolve({
        provider: 'nominatim',
        attribution: '© OpenStreetMap contributors',
        results: [],
      });
    },
  };

  async function cleanDatabase(): Promise<void> {
    assertTestDatabase();

    await prisma.authSession.deleteMany();

    await prisma.trip.deleteMany();

    await prisma.user.deleteMany();
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
      .overrideProvider(GEOCODING_PROVIDER)
      .useValue(geocodingProvider)
      .compile();

    app = moduleFixture.createNestApplication();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);
  }, 30000);

  beforeEach(async () => {
    aiMode = 'success';

    weatherMode = 'success';

    geocodingMode = 'success';

    await cleanDatabase();

    const user = {
      name: 'Failure Recovery User',
      email: 'failure-recovery@meridian.local',
      password: 'MeridianE2e123!',
    };

    await request(app.getHttpServer()).post('/api/v1/auth/register').send(user).expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: user.password,
      })
      .expect(200);

    accessToken = unwrap(parseJson<MaybeEnvelope<LoginData>>(loginResponse)).accessToken;

    const tripResponse = await request(app.getHttpServer())
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Failure Recovery Trip',
        destination: 'Tokyo, Japan',
        startDate: '2026-11-01T00:00:00.000Z',
        endDate: '2026-11-03T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
        currency: 'JPY',
      })
      .expect(201);

    trip = unwrap(parseJson<MaybeEnvelope<TripData>>(tripResponse));
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it('maps an unavailable AI provider to a safe 503 response', async () => {
    aiMode = 'unavailable';

    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(503);

    expect(response.text).toContain('Gemini is temporarily unavailable');

    expect(response.text).not.toContain('stack');
  });

  it('maps malformed AI output to 502 instead of accepting it', async () => {
    aiMode = 'malformed';

    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(502);

    expect(response.text).toContain('malformed structured output');
  });

  it('does not leak unexpected provider exception details', async () => {
    aiMode = 'unexpected';

    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(500);

    expect(response.text).toContain('Internal server error');

    expect(response.text).not.toContain('sensitive internal provider detail');
  });

  it('returns safe weather degradation states', async () => {
    weatherMode = 'missing-location';

    const missingLocation = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/weather`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(missingLocation.text).toContain('LOCATION_NOT_FOUND');

    weatherMode = 'unavailable';

    const unavailable = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/weather`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(503);

    expect(unavailable.text).toContain('Weather service is currently unavailable');

    expect(unavailable.text).not.toContain('upstream weather detail');
  });

  it('keeps Meridian AI usable when weather is temporarily unavailable', async () => {
    weatherMode = 'unavailable';

    aiMode = 'success';

    const response = await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(200);

    expect(response.text).toContain('A resilient plan.');
  });

  it('returns a safe 503 when geocoding is unavailable and recovers on the next request', async () => {
    geocodingMode = 'unavailable';

    const failed = await request(app.getHttpServer())
      .get('/api/v1/geocoding/search?q=Tokyo')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(503);

    expect(failed.text).toContain('Geocoding provider is unavailable');

    geocodingMode = 'success';

    await request(app.getHttpServer())
      .get('/api/v1/geocoding/search?q=Tokyo')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('keeps normal trip reads healthy after downstream failures', async () => {
    aiMode = 'unavailable';

    await request(app.getHttpServer())
      .post(`/api/v1/trips/${trip.id}/ai/recommendations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(503);

    weatherMode = 'unavailable';

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/weather`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(503);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
