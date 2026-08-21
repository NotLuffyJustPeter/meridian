export type UserRole = 'USER' | 'ADMIN';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type ApiEnvelope<T> = {
  data: T;
  meta: unknown;
  message: string;
};

export type ApiErrorResponse = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

export type SuccessfulLoginApiData = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export type MfaRequiredApiData = {
  mfaRequired: true;
  challengeToken: string;
};

export type LoginApiData =
  | SuccessfulLoginApiData
  | MfaRequiredApiData;

export type RefreshApiData = {
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

export type MfaEnrollmentData = {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
};

export type MfaConfirmationData = {
  status: {
    enabled: boolean;
    recoveryCodesRemaining: number;
  };
  recoveryCodes: string[];
};
