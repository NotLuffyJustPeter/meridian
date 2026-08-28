import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

import { PrismaService } from '../database/prisma.service';
import { PasswordResetQueueService } from '../jobs/password-reset-queue.service';
import { EmailService } from './email.service';

const DEFAULT_RESET_TTL_MINUTES = 20;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,

    private readonly configService: ConfigService,

    private readonly emailService: EmailService,

    @Optional()
    private readonly passwordResetQueue?: PasswordResetQueueService,
  ) {}

  async requestReset(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return;
    }

    const now = new Date();

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,

        usedAt: null,
      },

      data: {
        usedAt: now,
      },
    });

    const rawToken = randomBytes(32).toString('base64url');

    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date(Date.now() + this.getTtlMinutes() * 60 * 1_000);

    const record = await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,

        tokenHash,

        expiresAt,
      },
    });

    const appOrigin = (
      this.configService.get<string>('APP_ORIGIN') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    const resetUrl = `${appOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      if (this.passwordResetQueue?.isEnabled()) {
        await this.passwordResetQueue.enqueuePasswordReset({
          resetTokenId: record.id,

          to: user.email,

          name: user.name,

          resetUrl,
        });
      } else {
        await this.emailService.sendPasswordResetEmail({
          to: user.email,

          name: user.name,

          resetUrl,
        });
      }
    } catch (error) {
      await this.invalidateToken(record.id);

      this.logger.error(
        this.passwordResetQueue?.isEnabled()
          ? 'Password reset email could not be queued'
          : 'Password reset email could not be delivered',

        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken.trim());

    const now = new Date();

    const passwordHash = await argon2.hash(password);

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.passwordResetToken.findUnique({
        where: {
          tokenHash,
        },
      });

      if (!record || record.usedAt !== null || record.expiresAt <= now) {
        throw new BadRequestException('Reset link is invalid or has expired');
      }

      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,

          usedAt: null,

          expiresAt: {
            gt: now,
          },
        },

        data: {
          usedAt: now,
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException('Reset link is invalid or has expired');
      }

      await tx.user.update({
        where: {
          id: record.userId,
        },

        data: {
          passwordHash,
        },
      });

      await tx.authSession.updateMany({
        where: {
          userId: record.userId,

          revokedAt: null,
        },

        data: {
          revokedAt: now,
        },
      });

      await tx.mfaChallenge.updateMany({
        where: {
          userId: record.userId,

          consumedAt: null,
        },

        data: {
          consumedAt: now,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: record.userId,

          usedAt: null,
        },

        data: {
          usedAt: now,
        },
      });
    });
  }

  private async invalidateToken(id: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: {
        id,

        usedAt: null,
      },

      data: {
        usedAt: new Date(),
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getTtlMinutes(): number {
    const configured = Number(
      this.configService.get<string>('PASSWORD_RESET_TTL_MINUTES') ?? DEFAULT_RESET_TTL_MINUTES,
    );

    if (!Number.isInteger(configured) || configured <= 0 || configured > 120) {
      return DEFAULT_RESET_TTL_MINUTES;
    }

    return configured;
  }
}
