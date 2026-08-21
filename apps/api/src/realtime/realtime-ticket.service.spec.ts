import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AccessTokenPayload } from '../auth/auth.types';
import type { RealtimeTicketPayload } from './realtime.types';
import { RealtimeTicketService } from './realtime-ticket.service';

type SignAsyncMock = (payload: unknown, options: unknown) => Promise<string>;

type VerifyAsyncMock = (
  token: string,
  options: unknown,
) => Promise<RealtimeTicketPayload | AccessTokenPayload>;

type ConfigGetMock = (key: string) => string | undefined;

describe('RealtimeTicketService', () => {
  let service: RealtimeTicketService;

  let signAsync: jest.Mock<SignAsyncMock>;
  let verifyAsync: jest.Mock<VerifyAsyncMock>;
  let getConfig: jest.Mock<ConfigGetMock>;

  const user: AccessTokenPayload = {
    sub: 'user-1',
    email: 'user@meridian.local',
    role: 'USER',
    type: 'access',
  };

  beforeEach(() => {
    signAsync = jest.fn<SignAsyncMock>();

    verifyAsync = jest.fn<VerifyAsyncMock>();

    getConfig = jest.fn<ConfigGetMock>();

    getConfig.mockReturnValue('test-access-secret');

    service = new RealtimeTicketService(
      {
        signAsync,
        verifyAsync,
      } as unknown as JwtService,
      {
        get: getConfig,
      } as unknown as ConfigService,
    );
  });

  it('creates a short-lived realtime ticket', async () => {
    signAsync.mockResolvedValue('realtime-ticket');

    const result = await service.createTicket(user);

    expect(result).toEqual({
      ticket: 'realtime-ticket',
      expiresInSeconds: 60,
    });

    expect(signAsync).toHaveBeenCalledWith(
      {
        sub: user.sub,
        email: user.email,
        role: user.role,
        type: 'realtime',
      },
      {
        secret: 'test-access-secret',
        expiresIn: 60,
      },
    );
  });

  it('verifies a valid realtime ticket', async () => {
    verifyAsync.mockResolvedValue({
      sub: user.sub,
      email: user.email,
      role: user.role,
      type: 'realtime',
    });

    const result = await service.verifyTicket('ticket');

    expect(result.type).toBe('realtime');

    expect(result.sub).toBe(user.sub);
  });

  it('rejects an access token used as a realtime ticket', async () => {
    verifyAsync.mockResolvedValue(user);

    await expect(service.verifyTicket('access-token')).rejects.toThrow(
      'Invalid or expired realtime ticket',
    );
  });
});
