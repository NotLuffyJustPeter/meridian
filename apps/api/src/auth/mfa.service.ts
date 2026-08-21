import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import * as QRCode from 'qrcode';

import { PrismaService } from '../database/prisma.service';

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const MAX_CHALLENGE_ATTEMPTS = 5;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RECOVERY_CODE_COUNT = 10;

export type MfaStatus = {
  enabled: boolean;
  recoveryCodesRemaining: number;
};

export type MfaEnrollment = {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
};

export type MfaConfirmation = {
  status: MfaStatus;
  recoveryCodes: string[];
};

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

type TotpMatch = {
  counter: number;
};

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getStatus(userId: string): Promise<MfaStatus> {
    const credential = await this.prisma.totpCredential.findUnique({
      where: {
        userId,
      },
    });

    if (!credential?.enabledAt) {
      return {
        enabled: false,
        recoveryCodesRemaining: 0,
      };
    }

    const recoveryCodesRemaining = await this.prisma.mfaRecoveryCode.count({
      where: {
        credentialId: credential.id,
        usedAt: null,
      },
    });

    return {
      enabled: true,
      recoveryCodesRemaining,
    };
  }

  async isEnabled(userId: string): Promise<boolean> {
    const credential = await this.prisma.totpCredential.findUnique({
      where: {
        userId,
      },
      select: {
        enabledAt: true,
      },
    });

    return Boolean(credential?.enabledAt);
  }

  async startEnrollment(userId: string, email: string): Promise<MfaEnrollment> {
    const existing = await this.prisma.totpCredential.findUnique({
      where: {
        userId,
      },
    });

    if (existing?.enabledAt) {
      throw new ConflictException('Two-step verification is already enabled.');
    }

    const secret = this.base32Encode(randomBytes(20));

    const encrypted = this.encryptSecret(secret);

    const credential = await this.prisma.totpCredential.upsert({
      where: {
        userId,
      },
      create: {
        userId,
        secretCiphertext: encrypted.ciphertext,
        secretIv: encrypted.iv,
        secretAuthTag: encrypted.authTag,
      },
      update: {
        secretCiphertext: encrypted.ciphertext,
        secretIv: encrypted.iv,
        secretAuthTag: encrypted.authTag,
        enabledAt: null,
        lastUsedTotpCounter: null,
      },
    });

    await this.prisma.mfaRecoveryCode.deleteMany({
      where: {
        credentialId: credential.id,
      },
    });

    const label = `Meridian:${email}`;

    const otpauthUri =
      `otpauth://totp/${encodeURIComponent(label)}` +
      `?secret=${encodeURIComponent(secret)}` +
      `&issuer=${encodeURIComponent('Meridian')}` +
      '&algorithm=SHA1&digits=6&period=30';

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
    });

    return {
      secret,
      otpauthUri,
      qrCodeDataUrl,
    };
  }

  async confirmEnrollment(userId: string, code: string): Promise<MfaConfirmation> {
    const credential = await this.prisma.totpCredential.findUnique({
      where: {
        userId,
      },
    });

    if (!credential) {
      throw new BadRequestException('Start two-step verification setup first.');
    }

    if (credential.enabledAt) {
      throw new ConflictException('Two-step verification is already enabled.');
    }

    const secret = this.decryptSecret({
      ciphertext: credential.secretCiphertext,
      iv: credential.secretIv,
      authTag: credential.secretAuthTag,
    });

    if (!this.verifyTotp(secret, code)) {
      throw new BadRequestException('Invalid authenticator code.');
    }

    const recoveryCodes = this.generateRecoveryCodes();

    await this.prisma.$transaction([
      this.prisma.totpCredential.update({
        where: {
          id: credential.id,
        },
        data: {
          enabledAt: new Date(),
          lastUsedTotpCounter: null,
        },
      }),

      this.prisma.mfaRecoveryCode.deleteMany({
        where: {
          credentialId: credential.id,
        },
      }),

      this.prisma.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          credentialId: credential.id,
          codeHash: this.hashValue(this.normalizeRecoveryCode(recoveryCode)),
        })),
      }),
    ]);

    return {
      status: {
        enabled: true,
        recoveryCodesRemaining: recoveryCodes.length,
      },
      recoveryCodes,
    };
  }

  async createLoginChallenge(userId: string): Promise<string> {
    const now = new Date();

    await this.prisma.mfaChallenge.deleteMany({
      where: {
        userId,
        OR: [
          {
            expiresAt: {
              lte: now,
            },
          },
          {
            consumedAt: {
              not: null,
            },
          },
        ],
      },
    });

    const token = randomBytes(32).toString('base64url');

    await this.prisma.mfaChallenge.create({
      data: {
        userId,
        tokenHash: this.hashValue(token),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return token;
  }

  async verifyLoginChallenge(challengeToken: string, code: string): Promise<string> {
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: {
        tokenHash: this.hashValue(challengeToken),
      },
    });

    const now = new Date();

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      challenge.attempts >= MAX_CHALLENGE_ATTEMPTS
    ) {
      throw new UnauthorizedException('Two-step verification challenge is invalid or expired.');
    }

    const credential = await this.prisma.totpCredential.findUnique({
      where: {
        userId: challenge.userId,
      },
    });

    if (!credential?.enabledAt) {
      throw new UnauthorizedException('Two-step verification is not enabled.');
    }

    const secret = this.decryptSecret({
      ciphertext: credential.secretCiphertext,
      iv: credential.secretIv,
      authTag: credential.secretAuthTag,
    });

    const totpMatch = this.verifyTotp(secret, code);

    let recoveryCodeId: string | null = null;

    if (totpMatch) {
      if (
        credential.lastUsedTotpCounter !== null &&
        totpMatch.counter <= credential.lastUsedTotpCounter
      ) {
        await this.registerFailedAttempt(challenge.id, challenge.attempts);

        throw new UnauthorizedException('Authenticator code has already been used.');
      }
    } else {
      const recoveryCode = await this.findUnusedRecoveryCode(credential.id, code);

      if (!recoveryCode) {
        await this.registerFailedAttempt(challenge.id, challenge.attempts);

        throw new UnauthorizedException('Invalid authenticator or recovery code.');
      }

      recoveryCodeId = recoveryCode.id;
    }

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.mfaChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          consumedAt: new Date(),
        },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Two-step verification challenge is invalid or expired.');
      }

      if (totpMatch) {
        await tx.totpCredential.update({
          where: {
            id: credential.id,
          },
          data: {
            lastUsedTotpCounter: totpMatch.counter,
          },
        });
      }

      if (recoveryCodeId) {
        const used = await tx.mfaRecoveryCode.updateMany({
          where: {
            id: recoveryCodeId,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        if (used.count !== 1) {
          throw new UnauthorizedException('Recovery code has already been used.');
        }
      }
    });

    return challenge.userId;
  }

  async regenerateRecoveryCodes(userId: string, code: string): Promise<string[]> {
    const credential = await this.requireEnabledCredential(userId);

    await this.verifyCurrentFactor(credential.id, code);

    const recoveryCodes = this.generateRecoveryCodes();

    await this.prisma.$transaction([
      this.prisma.mfaRecoveryCode.deleteMany({
        where: {
          credentialId: credential.id,
        },
      }),

      this.prisma.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({
          credentialId: credential.id,
          codeHash: this.hashValue(this.normalizeRecoveryCode(recoveryCode)),
        })),
      }),
    ]);

    return recoveryCodes;
  }

  async disable(userId: string, code: string): Promise<void> {
    const credential = await this.requireEnabledCredential(userId);

    await this.verifyCurrentFactor(credential.id, code);

    await this.prisma.$transaction([
      this.prisma.mfaChallenge.deleteMany({
        where: {
          userId,
        },
      }),

      this.prisma.totpCredential.delete({
        where: {
          id: credential.id,
        },
      }),
    ]);
  }

  private async requireEnabledCredential(userId: string) {
    const credential = await this.prisma.totpCredential.findUnique({
      where: {
        userId,
      },
    });

    if (!credential?.enabledAt) {
      throw new BadRequestException('Two-step verification is not enabled.');
    }

    return credential;
  }

  private async verifyCurrentFactor(credentialId: string, code: string): Promise<void> {
    const credential = await this.prisma.totpCredential.findUnique({
      where: {
        id: credentialId,
      },
    });

    if (!credential?.enabledAt) {
      throw new BadRequestException('Two-step verification is not enabled.');
    }

    const secret = this.decryptSecret({
      ciphertext: credential.secretCiphertext,
      iv: credential.secretIv,
      authTag: credential.secretAuthTag,
    });

    if (this.verifyTotp(secret, code)) {
      return;
    }

    const recoveryCode = await this.findUnusedRecoveryCode(credential.id, code);

    if (!recoveryCode) {
      throw new UnauthorizedException('Invalid authenticator or recovery code.');
    }

    const result = await this.prisma.mfaRecoveryCode.updateMany({
      where: {
        id: recoveryCode.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Recovery code has already been used.');
    }
  }

  private async findUnusedRecoveryCode(credentialId: string, code: string) {
    const normalized = this.normalizeRecoveryCode(code);

    if (normalized.length < 10) {
      return null;
    }

    return this.prisma.mfaRecoveryCode
      .findUnique({
        where: {
          credentialId_codeHash: {
            credentialId,
            codeHash: this.hashValue(normalized),
          },
        },
      })
      .then((result) => (result?.usedAt ? null : result));
  }

  private async registerFailedAttempt(challengeId: string, currentAttempts: number): Promise<void> {
    const attempts = currentAttempts + 1;

    await this.prisma.mfaChallenge.update({
      where: {
        id: challengeId,
      },
      data: {
        attempts,
        consumedAt: attempts >= MAX_CHALLENGE_ATTEMPTS ? new Date() : undefined,
      },
    });
  }

  private generateRecoveryCodes(): string[] {
    return Array.from(
      {
        length: RECOVERY_CODE_COUNT,
      },
      () => {
        const raw = randomBytes(10).toString('hex').toUpperCase();

        return raw.match(/.{1,4}/g)?.join('-') ?? raw;
      },
    );
  }

  private verifyTotp(secret: string, code: string): TotpMatch | null {
    const normalized = code.replace(/\s+/g, '');

    if (!/^\d{6}$/.test(normalized)) {
      return null;
    }

    const currentCounter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);

    for (let offset = -1; offset <= 1; offset += 1) {
      const counter = currentCounter + offset;

      const expected = this.generateTotp(secret, counter);

      const receivedBuffer = Buffer.from(normalized, 'utf8');

      const expectedBuffer = Buffer.from(expected, 'utf8');

      if (
        receivedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(receivedBuffer, expectedBuffer)
      ) {
        return {
          counter,
        };
      }
    }

    return null;
  }

  private generateTotp(secret: string, counter: number): string {
    const key = this.base32Decode(secret);

    const message = Buffer.alloc(8);

    message.writeBigUInt64BE(BigInt(counter));

    const digest = createHmac('sha1', key).update(message).digest();

    const offset = digest[digest.length - 1]! & 0x0f;

    const binary =
      ((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff);

    const value = binary % 10 ** TOTP_DIGITS;

    return value.toString().padStart(TOTP_DIGITS, '0');
  }

  private base32Encode(input: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    let bits = '';
    let output = '';

    for (const byte of input) {
      bits += byte.toString(2).padStart(8, '0');
    }

    for (let index = 0; index < bits.length; index += 5) {
      const chunk = bits.slice(index, index + 5);

      output += alphabet[Number.parseInt(chunk.padEnd(5, '0'), 2)];
    }

    return output;
  }

  private base32Decode(input: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    const normalized = input.replace(/=+$/g, '').toUpperCase();

    let bits = '';

    for (const character of normalized) {
      const value = alphabet.indexOf(character);

      if (value < 0) {
        throw new Error('Invalid base32 secret');
      }

      bits += value.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];

    for (let index = 0; index + 8 <= bits.length; index += 8) {
      bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    }

    return Buffer.from(bytes);
  }

  private encryptSecret(secret: string): EncryptedSecret {
    const key = this.getEncryptionKey();

    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  private decryptSecret(encrypted: EncryptedSecret): string {
    const key = this.getEncryptionKey();

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));

    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const configured = this.configService.get<string>('MFA_ENCRYPTION_KEY');

    if (!configured) {
      throw new Error('MFA_ENCRYPTION_KEY is not configured');
    }

    const key = Buffer.from(configured.trim(), 'base64');

    if (key.length !== 32) {
      throw new Error('MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }

    return key;
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private normalizeRecoveryCode(code: string): string {
    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }
}
