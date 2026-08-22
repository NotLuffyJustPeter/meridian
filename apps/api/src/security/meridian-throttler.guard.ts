import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

type RequestLike = {
  ip?: unknown;
  ips?: unknown;
  headers?: unknown;
  body?: unknown;
};

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function authHeader(request: RequestLike): string | undefined {
  if (!request.headers || typeof request.headers !== 'object') {
    return undefined;
  }

  const headers = request.headers as Record<string, unknown>;

  const value = headers['authorization'];

  return typeof value === 'string' ? value : undefined;
}

function bodyIdentifier(request: RequestLike): string | undefined {
  if (!request.body || typeof request.body !== 'object') {
    return undefined;
  }

  const body = request.body as Record<string, unknown>;

  const keys = ['email', 'challengeToken', 'token', 'credential', 'refreshToken'] as const;

  for (const key of keys) {
    const value = body[key];

    if (typeof value === 'string' && value.trim()) {
      const normalized = key === 'email' ? value.trim().toLowerCase() : value.trim();

      return `${key}:${hash(normalized)}`;
    }
  }

  return undefined;
}

export function buildThrottleTracker(request: RequestLike): string {
  const ips = Array.isArray(request.ips)
    ? request.ips.filter((value): value is string => typeof value === 'string')
    : [];

  const ip = ips[0] ?? (typeof request.ip === 'string' ? request.ip : 'unknown');

  const auth = authHeader(request);

  if (auth?.startsWith('Bearer ')) {
    return `${ip}:bearer:${hash(auth.slice(7))}`;
  }

  const body = bodyIdentifier(request);

  return body ? `${ip}:${body}` : ip;
}

@Injectable()
export class MeridianThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: RequestLike): Promise<string> {
    return Promise.resolve(buildThrottleTracker(request));
  }
}
