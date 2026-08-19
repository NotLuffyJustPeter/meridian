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

interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
}

interface ApiEnvelope<T> {
  data: T;
}

type PossiblyWrapped<T extends object> = T | ApiEnvelope<T>;

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

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let initialized = false;
  const email = 'auth-e2e@meridian.local';

  const password = 'MeridianE2e123!';

  const name = 'Meridian E2E';

  async function cleanDatabase(): Promise<void> {
    assertTestDatabase();

    await prisma.authSession.deleteMany();

    await prisma.user.deleteMany();
  }

  async function registerUser(): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name,
        email,
        password,
      })
      .expect(201);
  }

  async function loginUser(): Promise<LoginResponseData> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const payload = parseJson<PossiblyWrapped<LoginResponseData>>(response);

    return unwrap(payload);
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

  it('registers a new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name,
        email,
        password,
      })
      .expect(201);

    const payload = parseJson<PossiblyWrapped<PublicUserResponse>>(response);

    const user = unwrap(payload);

    expect(user.email).toBe(email);

    expect(user.name).toBe(name);

    expect(user.role).toBe('USER');

    expect(user).not.toHaveProperty('passwordHash');

    const storedUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    expect(storedUser).not.toBeNull();

    expect(storedUser?.passwordHash).not.toBe(password);
  });

  it('logs in and accesses /me using the access token', async () => {
    await registerUser();

    const login = await loginUser();

    expect(login.accessToken).toEqual(expect.any(String));

    expect(login.refreshToken).toEqual(expect.any(String));

    expect(login.user.email).toBe(email);

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const payload = parseJson<PossiblyWrapped<PublicUserResponse>>(response);

    const currentUser = unwrap(payload);

    expect(currentUser.email).toBe(email);

    expect(currentUser.id).toBe(login.user.id);

    expect(currentUser).not.toHaveProperty('passwordHash');
  });

  it('rotates refresh tokens and revokes the session after replay detection', async () => {
    await registerUser();

    const login = await loginUser();

    const oldRefreshToken = login.refreshToken;

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: oldRefreshToken,
      })
      .expect(200);

    const refreshPayload = parseJson<PossiblyWrapped<RefreshResponseData>>(refreshResponse);

    const refreshed = unwrap(refreshPayload);

    expect(refreshed.accessToken).toEqual(expect.any(String));

    expect(refreshed.refreshToken).toEqual(expect.any(String));

    expect(refreshed.refreshToken).not.toBe(oldRefreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: oldRefreshToken,
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: refreshed.refreshToken,
      })
      .expect(401);

    const sessions = await prisma.authSession.findMany();

    expect(sessions).toHaveLength(1);

    expect(sessions[0]?.revokedAt).not.toBeNull();
  });

  it('revokes the refresh session on logout', async () => {
    await registerUser();

    const login = await loginUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({
        refreshToken: login.refreshToken,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: login.refreshToken,
      })
      .expect(401);

    const sessions = await prisma.authSession.findMany();

    expect(sessions).toHaveLength(1);

    expect(sessions[0]?.revokedAt).not.toBeNull();
  });

  it('rejects /me without an access token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
