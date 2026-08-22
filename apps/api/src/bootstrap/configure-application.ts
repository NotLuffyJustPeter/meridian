import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

function corsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function configureTrustProxy(app: INestApplication, value: string): void {
  if (value === 'false') {
    return;
  }

  const express = app.getHttpAdapter().getInstance() as {
    set?: (name: string, value: unknown) => void;
  };

  express.set?.('trust proxy', value === 'true' ? 1 : 'loopback');
}

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService);

  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  configureTrustProxy(app, config.get<string>('TRUST_PROXY', 'false'));

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      strictTransportSecurity:
        nodeEnv === 'production'
          ? {
              maxAge: 15_552_000,
              includeSubDomains: true,
            }
          : false,
    }),
  );

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: corsOrigins(config.get<string>('CORS_ORIGIN', 'http://localhost:3000')),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Retry-After'],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
