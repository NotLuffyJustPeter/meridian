import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';

import type { AuthSession, AuthProvider, User } from '../generated/prisma/client';
import {
  UsersService,
  type CreateExternalUserData,
  type CreateUserData,
} from '../users/users.service';
import { AuthSessionsService, type CreateAuthSessionData } from './auth-sessions.service';
import { AuthService } from './auth.service';
import type { RefreshTokenPayload } from './auth.types';
import { GoogleIdentityService, type VerifiedGoogleIdentity } from './google-identity.service';

const TEST_PASSWORD = 'Meridian123!';

const ACCESS_SECRET = 'unit-test-access-secret';

const REFRESH_SECRET = 'unit-test-refresh-secret';

type UsersServiceMock = {
  findByEmail: jest.Mock<(email: string) => Promise<User | null>>;
  findById: jest.Mock<(id: string) => Promise<User | null>>;
  findByExternalIdentity: jest.Mock<
    (provider: AuthProvider, providerSubject: string) => Promise<User | null>
  >;
  create: jest.Mock<(data: CreateUserData) => Promise<User>>;
  createWithExternalIdentity: jest.Mock<(data: CreateExternalUserData) => Promise<User>>;
};

type AuthSessionsServiceMock = {
  create: jest.Mock<(data: CreateAuthSessionData) => Promise<AuthSession>>;
  findById: jest.Mock<(id: string) => Promise<AuthSession | null>>;
  rotate: jest.Mock<
    (id: string, refreshTokenHash: string, expiresAt: Date) => Promise<AuthSession>
  >;
  revoke: jest.Mock<(id: string) => Promise<AuthSession>>;
};

type JwtServiceMock = {
  signAsync: jest.Mock<(payload: object, options: object) => Promise<string>>;
  verifyAsync: jest.Mock<(token: string, options: object) => Promise<RefreshTokenPayload>>;
};

type ConfigServiceMock = {
  get: jest.Mock<(key: string) => string | undefined>;
};

type GoogleIdentityServiceMock = {
  verifyCredential: jest.Mock<(credential: string) => Promise<VerifiedGoogleIdentity>>;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService', () => {
  let authService: AuthService;

  let validPasswordHash: string;

  let usersService: UsersServiceMock;

  let authSessionsService: AuthSessionsServiceMock;

  let jwtService: JwtServiceMock;

  let configService: ConfigServiceMock;

  let googleIdentityService: GoogleIdentityServiceMock;

  const makeUser = (overrides: Partial<User> = {}): User => ({
    id: 'user-1',
    email: 'test@meridian.local',
    name: 'Test User',
    passwordHash: validPasswordHash,
    role: 'USER',
    createdAt: new Date('2026-08-19T12:00:00.000Z'),
    updatedAt: new Date('2026-08-19T12:00:00.000Z'),
    ...overrides,
  });

  const makeSession = (
    refreshToken: string,
    overrides: Partial<AuthSession> = {},
  ): AuthSession => ({
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const makeGoogleIdentity = (
    overrides: Partial<VerifiedGoogleIdentity> = {},
  ): VerifiedGoogleIdentity => ({
    providerSubject: 'google-subject-1',
    email: 'google@meridian.local',
    name: 'Google Traveler',
    ...overrides,
  });

  beforeAll(async () => {
    validPasswordHash = await argon2.hash(TEST_PASSWORD);
  });

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn<(email: string) => Promise<User | null>>(),

      findById: jest.fn<(id: string) => Promise<User | null>>(),

      findByExternalIdentity:
        jest.fn<(provider: AuthProvider, providerSubject: string) => Promise<User | null>>(),

      create: jest.fn<(data: CreateUserData) => Promise<User>>(),

      createWithExternalIdentity: jest.fn<(data: CreateExternalUserData) => Promise<User>>(),
    };

    authSessionsService = {
      create: jest.fn<(data: CreateAuthSessionData) => Promise<AuthSession>>(),

      findById: jest.fn<(id: string) => Promise<AuthSession | null>>(),

      rotate:
        jest.fn<(id: string, refreshTokenHash: string, expiresAt: Date) => Promise<AuthSession>>(),

      revoke: jest.fn<(id: string) => Promise<AuthSession>>(),
    };

    jwtService = {
      signAsync: jest.fn<(payload: object, options: object) => Promise<string>>(),

      verifyAsync: jest.fn<(token: string, options: object) => Promise<RefreshTokenPayload>>(),
    };

    configService = {
      get: jest.fn<(key: string) => string | undefined>((key) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: ACCESS_SECRET,
          JWT_REFRESH_SECRET: REFRESH_SECRET,
          JWT_ACCESS_TTL_SECONDS: '900',
          JWT_REFRESH_TTL_SECONDS: '604800',
        };

        return values[key];
      }),
    };

    googleIdentityService = {
      verifyCredential: jest.fn<(credential: string) => Promise<VerifiedGoogleIdentity>>(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: AuthSessionsService,
          useValue: authSessionsService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: GoogleIdentityService,
          useValue: googleIdentityService,
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('creates a user with a hashed password', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      usersService.create.mockImplementation((data) =>
        Promise.resolve(
          makeUser({
            email: data.email,
            name: data.name,
            passwordHash: data.passwordHash,
          }),
        ),
      );

      const result = await authService.register({
        name: 'Test User',
        email: 'test@meridian.local',
        password: TEST_PASSWORD,
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('test@meridian.local');

      expect(usersService.create).toHaveBeenCalledTimes(1);

      const firstCall = usersService.create.mock.calls[0];

      expect(firstCall).toBeDefined();

      if (!firstCall) {
        throw new Error('Expected UsersService.create to be called');
      }

      const createData = firstCall[0];

      expect(createData.passwordHash).not.toBe(TEST_PASSWORD);

      const passwordMatches = await argon2.verify(createData.passwordHash, TEST_PASSWORD);

      expect(passwordMatches).toBe(true);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@meridian.local',
        name: 'Test User',
        role: 'USER',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects an already registered email', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(
        authService.register({
          name: 'Test User',
          email: 'test@meridian.local',
          password: TEST_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'missing@meridian.local',
          password: TEST_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authSessionsService.create).not.toHaveBeenCalled();
    });

    it('rejects a federated-only account on the password endpoint', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({
          passwordHash: null,
        }),
      );

      await expect(
        authService.login({
          email: 'google@meridian.local',
          password: TEST_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authSessionsService.create).not.toHaveBeenCalled();
    });

    it('rejects an incorrect password', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(
        authService.login({
          email: 'test@meridian.local',
          password: 'WrongPassword123!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();

      expect(authSessionsService.create).not.toHaveBeenCalled();
    });

    it('returns tokens and persists the refresh session', async () => {
      const user = makeUser();

      usersService.findByEmail.mockResolvedValue(user);

      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      authSessionsService.create.mockResolvedValue(makeSession('refresh-token'));

      const result = await authService.login({
        email: user.email,
        password: TEST_PASSWORD,
      });

      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const firstCall = authSessionsService.create.mock.calls[0];

      expect(firstCall).toBeDefined();

      if (!firstCall) {
        throw new Error('Expected AuthSessionsService.create to be called');
      }

      const sessionData = firstCall[0];

      expect(sessionData.userId).toBe(user.id);

      expect(sessionData.refreshTokenHash).toBe(hashToken('refresh-token'));

      expect(sessionData.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('loginWithGoogle', () => {
    it('signs in a returning Google identity', async () => {
      const identity = makeGoogleIdentity();

      const user = makeUser({
        email: identity.email,
        name: identity.name ?? 'Traveler',
        passwordHash: null,
      });

      googleIdentityService.verifyCredential.mockResolvedValue(identity);

      usersService.findByExternalIdentity.mockResolvedValue(user);

      jwtService.signAsync
        .mockResolvedValueOnce('google-access-token')
        .mockResolvedValueOnce('google-refresh-token');

      authSessionsService.create.mockResolvedValue(makeSession('google-refresh-token'));

      const result = await authService.loginWithGoogle('google-credential');

      expect(usersService.findByExternalIdentity).toHaveBeenCalledWith(
        'GOOGLE',
        identity.providerSubject,
      );

      expect(usersService.findByEmail).not.toHaveBeenCalled();

      expect(result.user.email).toBe(identity.email);

      expect(result.accessToken).toBe('google-access-token');
    });

    it('creates a federated-only Meridian account for a new Google identity', async () => {
      const identity = makeGoogleIdentity();

      const user = makeUser({
        email: identity.email,
        name: identity.name ?? 'Traveler',
        passwordHash: null,
      });

      googleIdentityService.verifyCredential.mockResolvedValue(identity);

      usersService.findByExternalIdentity.mockResolvedValue(null);

      usersService.findByEmail.mockResolvedValue(null);

      usersService.createWithExternalIdentity.mockResolvedValue(user);

      jwtService.signAsync
        .mockResolvedValueOnce('new-google-access')
        .mockResolvedValueOnce('new-google-refresh');

      authSessionsService.create.mockResolvedValue(makeSession('new-google-refresh'));

      const result = await authService.loginWithGoogle('google-credential');

      expect(usersService.createWithExternalIdentity).toHaveBeenCalledWith({
        email: identity.email,
        name: identity.name ?? identity.email.split('@')[0] ?? 'Traveler',
        provider: 'GOOGLE',
        providerSubject: identity.providerSubject,
      });

      expect(result.user.email).toBe(identity.email);
    });

    it('does not silently link Google to an existing password account', async () => {
      const identity = makeGoogleIdentity({
        email: 'test@meridian.local',
      });

      googleIdentityService.verifyCredential.mockResolvedValue(identity);

      usersService.findByExternalIdentity.mockResolvedValue(null);

      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(authService.loginWithGoogle('google-credential')).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(usersService.createWithExternalIdentity).not.toHaveBeenCalled();

      expect(authSessionsService.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token', async () => {
      const user = makeUser();

      const oldRefreshToken = 'old-refresh-token';

      const newRefreshToken = 'new-refresh-token';

      const session = makeSession(oldRefreshToken);

      const payload: RefreshTokenPayload = {
        sub: user.id,
        sid: session.id,
        jti: 'old-jti',
        type: 'refresh',
      };

      jwtService.verifyAsync.mockResolvedValue(payload);

      authSessionsService.findById.mockResolvedValue(session);

      usersService.findById.mockResolvedValue(user);

      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce(newRefreshToken);

      authSessionsService.rotate.mockResolvedValue(makeSession(newRefreshToken));

      const result = await authService.refresh(oldRefreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: newRefreshToken,
      });

      const rotateCall = authSessionsService.rotate.mock.calls[0];

      expect(rotateCall).toBeDefined();

      if (!rotateCall) {
        throw new Error('Expected AuthSessionsService.rotate to be called');
      }

      expect(rotateCall[0]).toBe(session.id);

      expect(rotateCall[1]).toBe(hashToken(newRefreshToken));

      expect(rotateCall[2]).toBeInstanceOf(Date);
    });

    it('revokes the session when an old refresh token is replayed', async () => {
      const user = makeUser();

      const oldRefreshToken = 'old-refresh-token';

      const currentRefreshToken = 'current-refresh-token';

      const session = makeSession(currentRefreshToken);

      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        sid: session.id,
        jti: 'old-jti',
        type: 'refresh',
      });

      authSessionsService.findById.mockResolvedValue(session);

      authSessionsService.revoke.mockResolvedValue({
        ...session,
        revokedAt: new Date(),
      });

      await expect(authService.refresh(oldRefreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(authSessionsService.revoke).toHaveBeenCalledWith(session.id);

      expect(authSessionsService.rotate).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes a valid session', async () => {
      const refreshToken = 'logout-refresh-token';

      const session = makeSession(refreshToken);

      jwtService.verifyAsync.mockResolvedValue({
        sub: session.userId,
        sid: session.id,
        jti: 'logout-jti',
        type: 'refresh',
      });

      authSessionsService.findById.mockResolvedValue(session);

      authSessionsService.revoke.mockResolvedValue({
        ...session,
        revokedAt: new Date(),
      });

      await authService.logout(refreshToken);

      expect(authSessionsService.revoke).toHaveBeenCalledWith(session.id);
    });

    it('rejects an already revoked session', async () => {
      const refreshToken = 'revoked-refresh-token';

      const session = makeSession(refreshToken, {
        revokedAt: new Date(),
      });

      jwtService.verifyAsync.mockResolvedValue({
        sub: session.userId,
        sid: session.id,
        jti: 'revoked-jti',
        type: 'refresh',
      });

      authSessionsService.findById.mockResolvedValue(session);

      await expect(authService.logout(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authSessionsService.revoke).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns the public authenticated user', async () => {
      const user = makeUser();

      usersService.findById.mockResolvedValue(user);

      const result = await authService.getCurrentUser(user.id);

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('rejects when the authenticated user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getCurrentUser('deleted-user')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
