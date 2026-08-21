import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';

import type { User } from '../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { AuthSessionsService } from './auth-sessions.service';
import type {
  AccessTokenPayload,
  LoginResult,
  PublicUser,
  RefreshResult,
  RefreshTokenPayload,
  SecurityStatus,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleIdentityService } from './google-identity.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authSessionsService: AuthSessionsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly googleIdentityService: GoogleIdentityService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordIsValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordIsValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.loginUser(user);
  }

  async loginWithGoogle(credential: string): Promise<LoginResult> {
    const identity = await this.googleIdentityService.verifyCredential(credential);

    const federatedUser = await this.usersService.findByExternalIdentity(
      'GOOGLE',
      identity.providerSubject,
    );

    if (federatedUser) {
      return this.loginUser(federatedUser);
    }

    const existingUser = await this.usersService.findByEmail(identity.email);

    if (existingUser) {
      throw new ConflictException(
        'An account already exists with this email. Sign in with your password to link Google securely.',
      );
    }

    const name = identity.name ?? this.getNameFromEmail(identity.email);

    const user = await this.usersService.createWithExternalIdentity({
      email: identity.email,
      name,
      provider: 'GOOGLE',
      providerSubject: identity.providerSubject,
    });

    return this.loginUser(user);
  }

  async getSecurityStatus(userId: string): Promise<SecurityStatus> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    const googleIdentity = await this.usersService.findExternalIdentityForUser(user.id, 'GOOGLE');

    const hasPassword = Boolean(user.passwordHash);

    return {
      password: {
        enabled: hasPassword,
      },
      google: {
        connected: googleIdentity !== null,
        canDisconnect: googleIdentity !== null && hasPassword,
      },
    };
  }

  async linkGoogleIdentity(userId: string, credential: string): Promise<SecurityStatus> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    const identity = await this.googleIdentityService.verifyCredential(credential);

    if (user.email.trim().toLowerCase() !== identity.email.trim().toLowerCase()) {
      throw new BadRequestException(
        'Sign in to Google with the same email as your Meridian account.',
      );
    }

    const identityBySubject = await this.usersService.findExternalIdentity(
      'GOOGLE',
      identity.providerSubject,
    );

    if (identityBySubject && identityBySubject.userId !== user.id) {
      throw new ConflictException(
        'This Google account is already linked to another Meridian account.',
      );
    }

    const existingGoogleIdentity = await this.usersService.findExternalIdentityForUser(
      user.id,
      'GOOGLE',
    );

    if (existingGoogleIdentity) {
      if (existingGoogleIdentity.providerSubject === identity.providerSubject) {
        return this.getSecurityStatus(user.id);
      }

      throw new ConflictException(
        'A different Google account is already linked to this Meridian account.',
      );
    }

    await this.usersService.createExternalIdentity({
      userId: user.id,
      provider: 'GOOGLE',
      providerSubject: identity.providerSubject,
    });

    return this.getSecurityStatus(user.id);
  }

  async unlinkGoogleIdentity(userId: string): Promise<SecurityStatus> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    const googleIdentity = await this.usersService.findExternalIdentityForUser(user.id, 'GOOGLE');

    if (!googleIdentity) {
      return this.getSecurityStatus(user.id);
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Add a password before disconnecting Google so you do not lose access to Meridian.',
      );
    }

    await this.usersService.deleteExternalIdentity(googleIdentity.id);

    return this.getSecurityStatus(user.id);
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const session = await this.authSessionsService.findById(payload.sid);

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const incomingHash = this.hashToken(refreshToken);

    if (!this.hashesMatch(incomingHash, session.refreshTokenHash)) {
      await this.authSessionsService.revoke(session.id);

      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      await this.authSessionsService.revoke(session.id);

      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = await this.createAccessToken(user);

    const refreshTokenTtl = this.getRefreshTokenTtl();

    const rotatedRefreshToken = await this.createRefreshToken(user.id, session.id);

    await this.authSessionsService.rotate(
      session.id,
      this.hashToken(rotatedRefreshToken),
      new Date(Date.now() + refreshTokenTtl * 1000),
    );

    return {
      accessToken,
      refreshToken: rotatedRefreshToken,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const session = await this.authSessionsService.findById(payload.sid);

    if (!session || session.userId !== payload.sub || session.revokedAt !== null) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const incomingHash = this.hashToken(refreshToken);

    if (!this.hashesMatch(incomingHash, session.refreshTokenHash)) {
      await this.authSessionsService.revoke(session.id);

      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.authSessionsService.revoke(session.id);
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    return this.toPublicUser(user);
  }

  private async loginUser(user: User): Promise<LoginResult> {
    const tokens = await this.createSession(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  private async createSession(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const sessionId = randomUUID();

    const refreshTokenTtl = this.getRefreshTokenTtl();

    const accessToken = await this.createAccessToken(user);

    const refreshToken = await this.createRefreshToken(user.id, sessionId);

    await this.authSessionsService.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async createAccessToken(user: User): Promise<string> {
    const secret = this.getRequiredConfig('JWT_ACCESS_SECRET');

    const ttl = this.getPositiveNumberConfig('JWT_ACCESS_TTL_SECONDS', 900);

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: ttl,
    });
  }

  private async createRefreshToken(userId: string, sessionId: string): Promise<string> {
    const secret = this.getRequiredConfig('JWT_REFRESH_SECRET');

    const ttl = this.getRefreshTokenTtl();

    const payload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      jti: randomUUID(),
      type: 'refresh',
    };

    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: ttl,
    });
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const secret = this.getRequiredConfig('JWT_REFRESH_SECRET');

    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret,
      });

      if (payload.type !== 'refresh' || !payload.sub || !payload.sid || !payload.jti) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(firstHash: string, secondHash: string): boolean {
    const first = Buffer.from(firstHash, 'hex');

    const second = Buffer.from(secondHash, 'hex');

    return first.length === second.length && timingSafeEqual(first, second);
  }

  private getRefreshTokenTtl(): number {
    return this.getPositiveNumberConfig('JWT_REFRESH_TTL_SECONDS', 604800);
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`${key} is not configured`);
    }

    return value;
  }

  private getPositiveNumberConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key) ?? fallback);

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${key} must be a positive number`);
    }

    return value;
  }

  private getNameFromEmail(email: string): string {
    const localPart = email.split('@')[0]?.trim();

    return localPart && localPart.length > 0 ? localPart : 'Traveler';
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
