import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { EmailService } from './../src/auth/email.service';
import { GoogleIdentityService } from './../src/auth/google-identity.service';
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

interface MfaRequiredResponseData {
  mfaRequired: true;
  challengeToken: string;
}

interface MfaEnrollmentResponseData {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
}

interface MfaConfirmationResponseData {
  status: {
    enabled: boolean;
    recoveryCodesRemaining: number;
  };
  recoveryCodes: string[];
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

function decodeBase32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  let bits = '';

  for (const character of input.toUpperCase()) {
    const value = alphabet.indexOf(character);

    if (value < 0) {
      throw new Error('Invalid base32 value');
    }

    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateTotp(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);

  const message = Buffer.alloc(8);

  message.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();

  const offset = digest[digest.length - 1] & 0x0f;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 1_000_000).toString().padStart(6, '0');
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

  const googleIdentityService = {
    verifyCredential: jest.fn<
      (credential: string) => Promise<{
        providerSubject: string;
        email: string;
        name: string | null;
      }>
    >(),
  };

  const emailService = {
    sendPasswordResetEmail:
      jest.fn<(message: { to: string; name: string; resetUrl: string }) => Promise<void>>(),
  };

  const email = 'auth-e2e@meridian.local';

  const password = 'MeridianE2e123!';

  const name = 'Meridian E2E';

  async function cleanDatabase(): Promise<void> {
    assertTestDatabase();

    await prisma.authSession.deleteMany();

    await prisma.mfaChallenge.deleteMany();

    await prisma.mfaRecoveryCode.deleteMany();

    await prisma.totpCredential.deleteMany();

    await prisma.authIdentity.deleteMany();

    await prisma.passwordResetToken.deleteMany();

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

  async function enableMfa(accessToken: string): Promise<{
    secret: string;
    recoveryCodes: string[];
  }> {
    const enrollmentResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/enroll')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201);

    const enrollment = unwrap(
      parseJson<PossiblyWrapped<MfaEnrollmentResponseData>>(enrollmentResponse),
    );

    expect(enrollment.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const confirmationResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/confirm')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: generateTotp(enrollment.secret),
      })
      .expect(200);

    const confirmation = unwrap(
      parseJson<PossiblyWrapped<MfaConfirmationResponseData>>(confirmationResponse),
    );

    expect(confirmation.status.enabled).toBe(true);

    expect(confirmation.recoveryCodes).toHaveLength(10);

    return {
      secret: enrollment.secret,
      recoveryCodes: confirmation.recoveryCodes,
    };
  }

  beforeAll(async () => {
    assertTestDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleIdentityService)
      .useValue(googleIdentityService)
      .overrideProvider(EmailService)
      .useValue(emailService)
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

    googleIdentityService.verifyCredential.mockReset();

    emailService.sendPasswordResetEmail.mockReset();
    emailService.sendPasswordResetEmail.mockResolvedValue();
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

  it('creates and signs in a new Google user using a verified external identity', async () => {
    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-e2e-subject',
      email: 'google-e2e@meridian.local',
      name: 'Google E2E',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        credential: 'fake-google-credential-for-e2e',
      })
      .expect(200);

    const payload = parseJson<PossiblyWrapped<LoginResponseData>>(response);

    const login = unwrap(payload);

    expect(login.accessToken).toEqual(expect.any(String));

    expect(login.refreshToken).toEqual(expect.any(String));

    expect(login.user.email).toBe('google-e2e@meridian.local');

    const storedUser = await prisma.user.findUnique({
      where: {
        email: 'google-e2e@meridian.local',
      },
      include: {
        identities: true,
      },
    });

    expect(storedUser?.passwordHash).toBeNull();

    expect(storedUser?.identities).toHaveLength(1);

    expect(storedUser?.identities[0]).toMatchObject({
      provider: 'GOOGLE',
      providerSubject: 'google-e2e-subject',
    });
  });

  it('does not silently link Google to an existing password account with the same email', async () => {
    await registerUser();

    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-existing-email',
      email,
      name: 'Meridian E2E',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        credential: 'fake-google-credential-for-conflict',
      })
      .expect(409);

    const identityCount = await prisma.authIdentity.count();

    expect(identityCount).toBe(0);
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

  it('links Google explicitly to an authenticated password account', async () => {
    await registerUser();

    const login = await loginUser();

    const beforeResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/security')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const before = unwrap(
      parseJson<
        PossiblyWrapped<{
          password: {
            enabled: boolean;
          };
          google: {
            connected: boolean;
            canDisconnect: boolean;
          };
        }>
      >(beforeResponse),
    );

    expect(before.password.enabled).toBe(true);
    expect(before.google.connected).toBe(false);

    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-linked-subject',
      email,
      name,
    });

    const linkResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        credential: 'fake-google-link-credential',
      })
      .expect(200);

    const linked = unwrap(
      parseJson<
        PossiblyWrapped<{
          password: {
            enabled: boolean;
          };
          google: {
            connected: boolean;
            canDisconnect: boolean;
          };
        }>
      >(linkResponse),
    );

    expect(linked.google.connected).toBe(true);
    expect(linked.google.canDisconnect).toBe(true);

    const identity = await prisma.authIdentity.findFirst({
      where: {
        userId: login.user.id,
        provider: 'GOOGLE',
      },
    });

    expect(identity?.providerSubject).toBe('google-linked-subject');
  });

  it('rejects linking a Google account with a different email', async () => {
    await registerUser();

    const login = await loginUser();

    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-other-email',
      email: 'someone-else@meridian.local',
      name: 'Someone Else',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        credential: 'fake-google-mismatched-email',
      })
      .expect(400);

    expect(await prisma.authIdentity.count()).toBe(0);
  });

  it('disconnects Google when a password sign-in method remains', async () => {
    await registerUser();

    const login = await loginUser();

    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-removable-subject',
      email,
      name,
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        credential: 'fake-google-link-before-delete',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .delete('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const status = unwrap(
      parseJson<
        PossiblyWrapped<{
          password: {
            enabled: boolean;
          };
          google: {
            connected: boolean;
            canDisconnect: boolean;
          };
        }>
      >(response),
    );

    expect(status.google.connected).toBe(false);
    expect(await prisma.authIdentity.count()).toBe(0);
  });

  it('prevents a Google-only user from disconnecting its only sign-in method', async () => {
    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-only-protected',
      email: 'google-only@meridian.local',
      name: 'Google Only',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        credential: 'fake-google-only-credential',
      })
      .expect(200);

    const login = unwrap(parseJson<PossiblyWrapped<LoginResponseData>>(response));

    await request(app.getHttpServer())
      .delete('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(400);

    const identity = await prisma.authIdentity.findFirst({
      where: {
        userId: login.user.id,
        provider: 'GOOGLE',
      },
    });

    expect(identity).not.toBeNull();
  });

  it('enables TOTP and requires a second factor before creating a new session', async () => {
    await registerUser();

    const firstLogin = await loginUser();

    const { secret } = await enableMfa(firstLogin.accessToken);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const challenge = unwrap(parseJson<PossiblyWrapped<MfaRequiredResponseData>>(loginResponse));

    expect(challenge.mfaRequired).toBe(true);

    const verifyResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({
        challengeToken: challenge.challengeToken,
        code: generateTotp(secret),
      })
      .expect(200);

    const verified = unwrap(parseJson<PossiblyWrapped<LoginResponseData>>(verifyResponse));

    expect(verified.accessToken).toEqual(expect.any(String));

    expect(verified.refreshToken).toEqual(expect.any(String));
  });

  it('accepts a recovery code once and rejects replay', async () => {
    await registerUser();

    const firstLogin = await loginUser();

    const { recoveryCodes } = await enableMfa(firstLogin.accessToken);

    const recoveryCode = recoveryCodes[0];

    expect(recoveryCode).toBeDefined();

    const firstChallengeResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const firstChallenge = unwrap(
      parseJson<PossiblyWrapped<MfaRequiredResponseData>>(firstChallengeResponse),
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({
        challengeToken: firstChallenge.challengeToken,
        code: recoveryCode,
      })
      .expect(200);

    const secondChallengeResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);

    const secondChallenge = unwrap(
      parseJson<PossiblyWrapped<MfaRequiredResponseData>>(secondChallengeResponse),
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .send({
        challengeToken: secondChallenge.challengeToken,
        code: recoveryCode,
      })
      .expect(401);
  });

  it('applies MFA to Google sign-in for a linked account', async () => {
    await registerUser();

    const passwordLogin = await loginUser();

    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-mfa-linked-subject',
      email,
      name,
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${passwordLogin.accessToken}`)
      .send({
        credential: 'fake-google-link-for-mfa',
      })
      .expect(200);

    await enableMfa(passwordLogin.accessToken);

    const googleResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        credential: 'fake-google-login-with-mfa',
      })
      .expect(200);

    const challenge = unwrap(parseJson<PossiblyWrapped<MfaRequiredResponseData>>(googleResponse));

    expect(challenge.mfaRequired).toBe(true);

    expect(challenge.challengeToken).toEqual(expect.any(String));
  });

  it('disables MFA only after validating a current factor', async () => {
    await registerUser();

    const firstLogin = await loginUser();

    const { secret } = await enableMfa(firstLogin.accessToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/disable')
      .set('Authorization', `Bearer ${firstLogin.accessToken}`)
      .send({
        code: generateTotp(secret),
      })
      .expect(200);

    const loginAfterDisable = await loginUser();

    expect(loginAfterDisable.accessToken).toEqual(expect.any(String));
  });

  it('updates the authenticated profile name', async () => {
    await registerUser();

    const login = await loginUser();

    const response = await request(app.getHttpServer())
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        name: 'Updated Meridian Traveler',
      })
      .expect(200);

    const updated = unwrap(parseJson<PossiblyWrapped<PublicUserResponse>>(response));

    expect(updated.name).toBe('Updated Meridian Traveler');

    const stored = await prisma.user.findUnique({
      where: {
        id: login.user.id,
      },
    });

    expect(stored?.name).toBe('Updated Meridian Traveler');
  });

  it('does not reveal whether a forgot-password email exists', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({
        email: 'missing@meridian.local',
      })
      .expect(202);

    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();

    await registerUser();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({
        email,
      })
      .expect(202);

    expect(
      parseJson<{
        message: string;
      }>(response).message,
    ).toContain('If an account exists');

    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('resets the password and revokes existing sessions', async () => {
    await registerUser();

    const previousLogin = await loginUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({
        email,
      })
      .expect(202);

    const call = emailService.sendPasswordResetEmail.mock.calls[0];

    expect(call).toBeDefined();

    const resetUrl = call?.[0].resetUrl ?? '';

    const token = new URL(resetUrl).searchParams.get('token');

    expect(token).toEqual(expect.any(String));

    const nextPassword = 'MeridianReset456!';

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({
        token,
        password: nextPassword,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: nextPassword,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: previousLogin.refreshToken,
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({
        token,
        password: 'AnotherPassword789!',
      })
      .expect(400);
  });

  it('lets a Google-only account establish a password through verified email recovery', async () => {
    const googleEmail = 'google-recovery@meridian.local';

    googleIdentityService.verifyCredential.mockResolvedValue({
      providerSubject: 'google-recovery-subject',
      email: googleEmail,
      name: 'Google Recovery',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        credential: 'google-recovery-credential',
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .send({
        email: googleEmail,
      })
      .expect(202);

    const call = emailService.sendPasswordResetEmail.mock.calls[0];

    const token = new URL(call?.[0].resetUrl ?? '').searchParams.get('token');

    const newPassword = 'GooglePassword123!';

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({
        token,
        password: newPassword,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: googleEmail,
        password: newPassword,
      })
      .expect(200);

    const user = await prisma.user.findUnique({
      where: {
        email: googleEmail,
      },
    });

    expect(user?.passwordHash).not.toBeNull();
  });

  it('rejects /me without an access token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
