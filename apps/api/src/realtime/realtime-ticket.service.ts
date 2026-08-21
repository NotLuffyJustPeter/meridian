import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AccessTokenPayload } from '../auth/auth.types';
import type { RealtimeTicketPayload } from './realtime.types';

const REALTIME_TICKET_TTL_SECONDS = 60;

@Injectable()
export class RealtimeTicketService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createTicket(user: AccessTokenPayload): Promise<{
    ticket: string;
    expiresInSeconds: number;
  }> {
    const secret = this.getSecret();

    const payload: RealtimeTicketPayload = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      type: 'realtime',
    };

    const ticket = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: REALTIME_TICKET_TTL_SECONDS,
    });

    return {
      ticket,
      expiresInSeconds: REALTIME_TICKET_TTL_SECONDS,
    };
  }

  async verifyTicket(ticket: string): Promise<RealtimeTicketPayload> {
    const secret = this.getSecret();

    try {
      const payload = await this.jwtService.verifyAsync<RealtimeTicketPayload>(ticket, {
        secret,
      });

      if (payload.type !== 'realtime' || !payload.sub || !payload.email || !payload.role) {
        throw new UnauthorizedException('Invalid realtime ticket');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired realtime ticket');
    }
  }

  private getSecret(): string {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    return secret;
  }
}
