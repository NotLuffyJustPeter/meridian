type Env = Record<string, unknown>;

const NODE_ENVS = new Set(['development', 'test', 'production']);

function stringValue(env: Env, key: string): string | undefined {
  const value = env[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  return value.trim() || undefined;
}

function required(env: Env, key: string): string {
  const value = stringValue(env, key);

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function validUrl(value: string, key: string, protocols?: string[]): URL {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }

  if (protocols && !protocols.includes(parsed.protocol)) {
    throw new Error(`${key} uses an unsupported URL protocol`);
  }

  return parsed;
}

function integerRange(env: Env, key: string, min: number, max: number): void {
  const raw = stringValue(env, key);

  if (!raw) {
    return;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
}

function booleanValue(env: Env, key: string): void {
  const raw = stringValue(env, key);

  if (raw && raw !== 'true' && raw !== 'false') {
    throw new Error(`${key} must be "true" or "false"`);
  }
}

function validateJwtSecret(value: string, key: string, nodeEnv: string): void {
  if (nodeEnv !== 'test' && value.length < 32) {
    throw new Error(`${key} must contain at least 32 characters outside test environments`);
  }
}

function validateMfaKey(value: string): void {
  const normalized = value.replace(/=+$/, '');

  const decoded = Buffer.from(value, 'base64');

  const roundTrip = decoded.toString('base64').replace(/=+$/, '');

  if (decoded.length !== 32 || roundTrip !== normalized) {
    throw new Error('MFA_ENCRYPTION_KEY must be a valid base64-encoded 32-byte key');
  }
}

function validateCorsOrigins(raw: string): void {
  const origins = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one origin');
  }

  for (const origin of origins) {
    if (origin === '*') {
      throw new Error('CORS_ORIGIN cannot use "*" when credentials are enabled');
    }

    const parsed = validUrl(origin, 'CORS_ORIGIN', ['http:', 'https:']);

    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('Each CORS_ORIGIN entry must be an origin only');
    }
  }
}

export function validateEnvironment(env: Env): Env {
  const result = { ...env };

  const nodeEnv = stringValue(env, 'NODE_ENV') ?? 'development';

  if (!NODE_ENVS.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  result.NODE_ENV = nodeEnv;

  validUrl(required(env, 'DATABASE_URL'), 'DATABASE_URL', ['postgresql:', 'postgres:']);

  const accessSecret = required(env, 'JWT_ACCESS_SECRET');

  const refreshSecret = required(env, 'JWT_REFRESH_SECRET');

  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  validateJwtSecret(accessSecret, 'JWT_ACCESS_SECRET', nodeEnv);

  validateJwtSecret(refreshSecret, 'JWT_REFRESH_SECRET', nodeEnv);

  validateMfaKey(required(env, 'MFA_ENCRYPTION_KEY'));

  const cors = stringValue(env, 'CORS_ORIGIN') ?? 'http://localhost:3000';

  validateCorsOrigins(cors);
  result.CORS_ORIGIN = cors;

  const appOrigin = stringValue(env, 'APP_ORIGIN');

  if (nodeEnv === 'production' && !appOrigin) {
    throw new Error('APP_ORIGIN is required in production');
  }

  if (appOrigin) {
    validUrl(appOrigin, 'APP_ORIGIN', ['http:', 'https:']);
  }

  const trustProxy = stringValue(env, 'TRUST_PROXY') ?? 'false';

  if (!['false', 'true', 'loopback'].includes(trustProxy)) {
    throw new Error('TRUST_PROXY must be false, true, or loopback');
  }

  result.TRUST_PROXY = trustProxy;

  const redisUrl = stringValue(env, 'REDIS_URL');

  if (redisUrl) {
    validUrl(redisUrl, 'REDIS_URL', ['redis:', 'rediss:']);
  }
  integerRange(env, 'PORT', 1, 65535);
  integerRange(env, 'JWT_ACCESS_TTL_SECONDS', 60, 3600);
  integerRange(env, 'JWT_REFRESH_TTL_SECONDS', 3600, 2_592_000);
  integerRange(env, 'PASSWORD_RESET_TTL_MINUTES', 5, 120);
  integerRange(env, 'SMTP_PORT', 1, 65535);

  integerRange(env, 'CACHE_GEOCODING_TTL_SECONDS', 60, 2_592_000);

  integerRange(env, 'CACHE_WEATHER_LOCATION_TTL_SECONDS', 60, 2_592_000);

  integerRange(env, 'CACHE_WEATHER_FORECAST_TTL_SECONDS', 30, 86_400);

  booleanValue(env, 'SMTP_SECURE');

  const mailProvider = stringValue(env, 'MAIL_PROVIDER') ?? 'smtp';

  if (mailProvider !== 'smtp' && mailProvider !== 'mailjet') {
    throw new Error('MAIL_PROVIDER must be smtp or mailjet');
  }

  result.MAIL_PROVIDER = mailProvider;

  if (mailProvider === 'mailjet') {
    required(env, 'MAILJET_API_KEY');
    required(env, 'MAILJET_SECRET_KEY');

    const fromEmail = required(env, 'MAIL_FROM_EMAIL');

    if (!fromEmail.includes('@')) {
      throw new Error('MAIL_FROM_EMAIL must be a valid email address');
    }

    const apiUrl = stringValue(env, 'MAILJET_API_URL') ?? 'https://api.mailjet.com/v3.1/send';

    validUrl(apiUrl, 'MAILJET_API_URL', ['https:']);
    result.MAILJET_API_URL = apiUrl;
  }

  return result;
}
