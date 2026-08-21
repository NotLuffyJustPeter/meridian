import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { AuthIdentity, AuthProvider, User } from '../generated/prisma/client';

export type CreateUserData = {
  email: string;
  name: string;
  passwordHash: string;
};

export type CreateExternalUserData = {
  email: string;
  name: string;
  provider: AuthProvider;
  providerSubject: string;
};

export type CreateExternalIdentityData = {
  userId: string;
  provider: AuthProvider;
  providerSubject: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email: this.normalizeEmail(email),
      },
    });
  }

  async findByExternalIdentity(
    provider: AuthProvider,
    providerSubject: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        identities: {
          some: {
            provider,
            providerSubject,
          },
        },
      },
    });
  }

  async findExternalIdentity(
    provider: AuthProvider,
    providerSubject: string,
  ): Promise<AuthIdentity | null> {
    return this.prisma.authIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider,
          providerSubject,
        },
      },
    });
  }

  async findExternalIdentityForUser(
    userId: string,
    provider: AuthProvider,
  ): Promise<AuthIdentity | null> {
    return this.prisma.authIdentity.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(data.email),
        name: data.name.trim(),
        passwordHash: data.passwordHash,
      },
    });
  }

  async createWithExternalIdentity(data: CreateExternalUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: this.normalizeEmail(data.email),
        name: data.name.trim(),
        passwordHash: null,
        identities: {
          create: {
            provider: data.provider,
            providerSubject: data.providerSubject,
          },
        },
      },
    });
  }

  async createExternalIdentity(data: CreateExternalIdentityData): Promise<AuthIdentity> {
    return this.prisma.authIdentity.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        providerSubject: data.providerSubject,
      },
    });
  }

  async deleteExternalIdentity(identityId: string): Promise<AuthIdentity> {
    return this.prisma.authIdentity.delete({
      where: {
        id: identityId,
      },
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
