import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, jest } from '@jest/globals';

import { GoogleIdentityService } from './google-identity.service';

type GooglePayload = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

type FakeLoginTicket = {
  getPayload: () => GooglePayload | undefined;
};

type VerifyIdTokenMock = jest.MockedFunction<(options: unknown) => Promise<FakeLoginTicket>>;

function config(clientId?: string): ConfigService {
  const get = jest.fn<(key: string) => string | undefined>((key) =>
    key === 'GOOGLE_CLIENT_ID' ? clientId : undefined,
  );

  return {
    get,
  } as unknown as ConfigService;
}

function injectGoogleClient(
  service: GoogleIdentityService,
  verifyIdToken: VerifyIdTokenMock,
): void {
  const fakeClient = {
    verifyIdToken,
  };

  Reflect.set(service, 'client', fakeClient);
}

describe('GoogleIdentityService', () => {
  it('fails safely when Google sign-in is not configured', async () => {
    const service = new GoogleIdentityService(config());

    await expect(service.verifyCredential('credential')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns verified subject, email, and normalized name', async () => {
    const verifyIdToken: VerifyIdTokenMock = jest.fn<
      (options: unknown) => Promise<FakeLoginTicket>
    >(() =>
      Promise.resolve({
        getPayload() {
          return {
            sub: 'google-sub',
            email: 'user@example.com',
            email_verified: true,
            name: '  Traveler  ',
          };
        },
      }),
    );

    const service = new GoogleIdentityService(config('client-id'));

    injectGoogleClient(service, verifyIdToken);

    await expect(service.verifyCredential('credential')).resolves.toEqual({
      providerSubject: 'google-sub',
      email: 'user@example.com',
      name: 'Traveler',
    });

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'credential',
      audience: 'client-id',
    });
  });

  it('returns null name when Google does not provide a useful display name', async () => {
    const verifyIdToken: VerifyIdTokenMock = jest.fn<
      (options: unknown) => Promise<FakeLoginTicket>
    >(() =>
      Promise.resolve({
        getPayload() {
          return {
            sub: 'google-sub',
            email: 'user@example.com',
            email_verified: true,
            name: '   ',
          };
        },
      }),
    );

    const service = new GoogleIdentityService(config('client-id'));

    injectGoogleClient(service, verifyIdToken);

    await expect(service.verifyCredential('credential')).resolves.toMatchObject({
      name: null,
    });
  });

  it('rejects unverified or incomplete Google identities', async () => {
    const verifyIdToken: VerifyIdTokenMock = jest.fn<
      (options: unknown) => Promise<FakeLoginTicket>
    >(() =>
      Promise.resolve({
        getPayload() {
          return {
            sub: 'google-sub',
            email: 'user@example.com',
            email_verified: false,
          };
        },
      }),
    );

    const service = new GoogleIdentityService(config('client-id'));

    injectGoogleClient(service, verifyIdToken);

    await expect(service.verifyCredential('credential')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('maps Google verification failures to a generic unauthorized error', async () => {
    const verifyIdToken: VerifyIdTokenMock = jest.fn<
      (options: unknown) => Promise<FakeLoginTicket>
    >(() => Promise.reject(new Error('provider internals')));

    const service = new GoogleIdentityService(config('client-id'));

    injectGoogleClient(service, verifyIdToken);

    await expect(service.verifyCredential('credential')).rejects.toMatchObject({
      message: 'Invalid Google credential',
    });
  });
});
