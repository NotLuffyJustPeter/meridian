import { config } from 'dotenv';
import { resolve } from 'node:path';

const envPath = resolve(__dirname, '../.env.test');

const result = config({
  path: envPath,
  override: true,
});

if (result.error) {
  throw new Error(`Unable to load E2E environment from ${envPath}`);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for E2E tests');
}

let parsedDatabaseUrl: URL;

try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error('DATABASE_URL is not a valid URL');
}

const databaseName = parsedDatabaseUrl.pathname.replace(/^\/+/, '');

const allowedHosts = new Set(['127.0.0.1', 'localhost']);

if (databaseName !== 'meridian_test') {
  throw new Error(
    `Refusing to run E2E tests against database "${databaseName}". Expected "meridian_test".`,
  );
}

if (!allowedHosts.has(parsedDatabaseUrl.hostname)) {
  throw new Error(`Refusing to run E2E tests against host "${parsedDatabaseUrl.hostname}".`);
}

if (parsedDatabaseUrl.port !== '5433') {
  throw new Error(
    `Refusing to run E2E tests against PostgreSQL port "${parsedDatabaseUrl.port}". Expected "5433".`,
  );
}

const requiredVariables = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_TTL_SECONDS',
  'JWT_REFRESH_TTL_SECONDS',
] as const;

for (const key of requiredVariables) {
  if (!process.env[key]) {
    throw new Error(`${key} is required for E2E tests`);
  }
}

process.env.NODE_ENV = 'test';
