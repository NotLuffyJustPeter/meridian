import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import { WEATHER_PROVIDER, type WeatherProvider } from './../src/weather/weather.provider';
import type {
  ProviderForecast,
  TripWeather,
  WeatherLocation,
} from './../src/weather/weather.types';

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

const location: WeatherLocation = {
  name: 'Milan',
  country: 'Italy',
  latitude: 45.46427,
  longitude: 9.18951,
};

const forecast: ProviderForecast = {
  days: [
    {
      date: '2026-08-21',
      weatherCode: 1,
      temperatureMaxC: 28.4,
      temperatureMinC: 18.2,
      precipitationProbabilityMax: 10,
      precipitationMm: 0,
      windSpeedMaxKmh: 15.1,
      sunrise: '2026-08-21T06:25',
      sunset: '2026-08-21T20:20',
    },
    {
      date: '2026-08-22',
      weatherCode: 61,
      temperatureMaxC: 24.2,
      temperatureMinC: 17.9,
      precipitationProbabilityMax: 72,
      precipitationMm: 5.4,
      windSpeedMaxKmh: 21.3,
      sunrise: '2026-08-22T06:26',
      sunset: '2026-08-22T20:18',
    },
    {
      date: '2026-08-23',
      weatherCode: 2,
      temperatureMaxC: 26,
      temperatureMinC: 18,
      precipitationProbabilityMax: 20,
      precipitationMm: 0.4,
      windSpeedMaxKmh: 16,
      sunrise: '2026-08-23T06:27',
      sunset: '2026-08-23T20:16',
    },
  ],
};

const weatherProvider: WeatherProvider = {
  resolveLocation(query) {
    return Promise.resolve(query.includes('Unknown') ? null : location);
  },

  getForecast() {
    return Promise.resolve(forecast);
  },
};

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

describe('Weather API (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  let initialized = false;

  const userA = {
    name: 'Weather Traveler A',
    email: 'weather-a@meridian.local',
    password: 'MeridianE2e123!',
  };

  const userB = {
    name: 'Weather Traveler B',
    email: 'weather-b@meridian.local',
    password: 'MeridianE2e123!',
  };

  const defaultTrip: CreateTripPayload = {
    name: 'Milan Forecast',
    destination: 'Milan, Italy',
    startDate: '2026-08-21T00:00:00.000Z',
    endDate: '2026-08-23T00:00:00.000Z',
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
    })
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

  it('returns normalized weather for an owned trip', async () => {
    const login = await registerAndLogin(userA);

    const trip = await createTrip(login.accessToken);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/weather`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const payload = parseJson<PossiblyWrapped<TripWeather>>(response);

    const weather = unwrap(payload);

    expect(weather.tripId).toBe(trip.id);

    expect(weather.availability).toBe('AVAILABLE');

    expect(weather.location).toMatchObject({
      name: 'Milan',
      country: 'Italy',
    });

    expect(weather.days).toHaveLength(3);

    expect(weather.days[0]).toMatchObject({
      date: '2026-08-21',
      available: true,
      condition: 'MOSTLY_CLEAR',
      temperatureMaxC: 28.4,
    });

    expect(weather.days[1]?.condition).toBe('RAIN');
  });

  it('preserves owner isolation and authentication', async () => {
    const loginA = await registerAndLogin(userA);

    const loginB = await registerAndLogin(userB);

    const trip = await createTrip(loginA.accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/weather`)
      .set('Authorization', `Bearer ${loginB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer()).get(`/api/v1/trips/${trip.id}/weather`).expect(401);
  });

  it('returns out-of-range dates without failing', async () => {
    const login = await registerAndLogin(userA);

    const trip = await createTrip(login.accessToken, {
      ...defaultTrip,
      name: 'Future Milan',
      startDate: '2026-09-10T00:00:00.000Z',
      endDate: '2026-09-12T00:00:00.000Z',
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/weather`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const weather = unwrap(parseJson<PossiblyWrapped<TripWeather>>(response));

    expect(weather.availability).toBe('OUT_OF_RANGE');

    expect(weather.days.every((day) => !day.available)).toBe(true);
  });

  it('returns a graceful state when destination geocoding has no match', async () => {
    const login = await registerAndLogin(userA);

    const trip = await createTrip(login.accessToken, {
      ...defaultTrip,
      destination: 'Unknown Meridian Place',
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/trips/${trip.id}/weather`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const weather = unwrap(parseJson<PossiblyWrapped<TripWeather>>(response));

    expect(weather.availability).toBe('LOCATION_NOT_FOUND');

    expect(weather.location).toBeNull();
  });
});
