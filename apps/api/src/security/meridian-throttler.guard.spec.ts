import { describe, expect, it } from '@jest/globals';

import { buildThrottleTracker } from './meridian-throttler.guard';

describe('buildThrottleTracker', () => {
  it('uses the direct IP when no sensitive identifier is present', () => {
    expect(
      buildThrottleTracker({
        ip: '127.0.0.1',
      }),
    ).toBe('127.0.0.1');
  });

  it('prefers the first trusted proxy-resolved IP', () => {
    expect(
      buildThrottleTracker({
        ip: '127.0.0.1',
        ips: ['203.0.113.8', '127.0.0.1'],
      }),
    ).toBe('203.0.113.8');
  });

  it('normalizes and hashes account email without storing the raw address', () => {
    const tracker = buildThrottleTracker({
      ip: '127.0.0.1',
      body: {
        email: '  User@Example.COM ',
      },
    });

    expect(tracker).toMatch(/^127\.0\.0\.1:email:[a-f0-9]{20}$/);

    expect(tracker).not.toContain('User@Example.COM');
  });

  it('hashes bearer tokens rather than using the raw credential', () => {
    const tracker = buildThrottleTracker({
      ip: '127.0.0.1',
      headers: {
        authorization: 'Bearer super-secret-access-token',
      },
    });

    expect(tracker).toMatch(/^127\.0\.0\.1:bearer:[a-f0-9]{20}$/);

    expect(tracker).not.toContain('super-secret-access-token');
  });

  it('hashes MFA and reset-token identifiers', () => {
    const challenge = buildThrottleTracker({
      ip: '127.0.0.1',
      body: {
        challengeToken: 'challenge-secret',
      },
    });

    const reset = buildThrottleTracker({
      ip: '127.0.0.1',
      body: {
        token: 'reset-secret',
      },
    });

    expect(challenge).not.toContain('challenge-secret');

    expect(reset).not.toContain('reset-secret');
  });
});
