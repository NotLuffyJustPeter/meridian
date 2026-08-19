import type { User } from '../generated/prisma/client';

export type PublicUser = Omit<User, 'passwordHash'>;

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: User['role'];
  type: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  jti: string;
  type: 'refresh';
};

export type LoginResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};
