import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { AuthSession } from '../generated/prisma/client';

export type CreateAuthSessionData = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
};

@Injectable()
export class AuthSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateAuthSessionData): Promise<AuthSession> {
    return this.prisma.authSession.create({
      data,
    });
  }

  findById(id: string): Promise<AuthSession | null> {
    return this.prisma.authSession.findUnique({
      where: {
        id,
      },
    });
  }

  rotate(id: string, refreshTokenHash: string, expiresAt: Date): Promise<AuthSession> {
    return this.prisma.authSession.update({
      where: {
        id,
      },
      data: {
        refreshTokenHash,
        expiresAt,
        revokedAt: null,
      },
    });
  }

  revoke(id: string): Promise<AuthSession> {
    return this.prisma.authSession.update({
      where: {
        id,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
