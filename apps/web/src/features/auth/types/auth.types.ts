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

export type LoginApiData = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export type RefreshApiData = {
  accessToken: string;
  refreshToken: string;
};