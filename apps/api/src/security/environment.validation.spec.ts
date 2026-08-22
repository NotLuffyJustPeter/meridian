import { describe, expect, it } from '@jest/globals';

import { validateEnvironment } from './environment.validation';

const MFA_KEY = Buffer.alloc(32, 7).toString('base64');

function validEnvironment() {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://meridian:password@127.0.0.1:5433/meridian?schema=public',
    JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-thirty-two-characters',
    JWT_REFRESH_SECRET: 'refresh-secret-that-is-different-and-at-least-thirty-two-characters',
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_REFRESH_TTL_SECONDS: '604800',
    MFA_ENCRYPTION_KEY: MFA_KEY,
    CORS_ORIGIN: 'https://meridian.example.com',
    APP_ORIGIN: 'https://meridian.example.com',
    TRUST_PROXY: 'loopback',
  };
}

describe('validateEnvironment', () => {
  it('accepts hardened production configuration', () => {
    expect(validateEnvironment(validEnvironment())).toMatchObject({
      NODE_ENV: 'production',
      TRUST_PROXY: 'loopback',
    });
  });

  it('rejects short JWT secrets outside tests', () => {
    const env = validEnvironment();

    env.JWT_ACCESS_SECRET = 'too-short';

    expect(() => validateEnvironment(env)).toThrow('JWT_ACCESS_SECRET');
  });

  it('rejects wildcard credentialed CORS', () => {
    const env = validEnvironment();

    env.CORS_ORIGIN = '*';

    expect(() => validateEnvironment(env)).toThrow('CORS_ORIGIN');
  });

  it('rejects an invalid MFA key', () => {
    const env = validEnvironment();

    env.MFA_ENCRYPTION_KEY = 'invalid';

    expect(() => validateEnvironment(env)).toThrow('MFA_ENCRYPTION_KEY');
  });
});
