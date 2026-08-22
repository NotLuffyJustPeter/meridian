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

export type MfaRequiredResult = {
  mfaRequired: true;
  challengeToken: string;
};

export type AuthAttemptResult = LoginResult | MfaRequiredResult;

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

export type SecurityStatus = {
  password: {
    enabled: boolean;
  };
  google: {
    connected: boolean;
    canDisconnect: boolean;
  };
  mfa: {
    enabled: boolean;
    recoveryCodesRemaining: number;
  };
};
