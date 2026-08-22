import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/bootstrap/configure-application';

describe('Security baseline (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    configureApplication(app);

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('sets security headers and hides Express', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');

    expect(response.headers['referrer-policy']).toBeDefined();

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns credentialed CORS for an allowed origin', async () => {
    const allowedOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim();

    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);

    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('keeps DTO whitelist protection active', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Security Test',
        email: 'security-test@meridian.local',
        password: 'MeridianSecurity123!',
        injectedAdmin: true,
      })
      .expect(400);
  });
});
