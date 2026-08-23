import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';

import { EmailService } from './email.service';

function config(values: Record<string, string>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('EmailService Mailjet provider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends password reset email through the Mailjet HTTPS API', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          Messages: [
            {
              Status: 'success',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const service = new EmailService(
      config({
        MAIL_PROVIDER: 'mailjet',
        MAILJET_API_KEY: 'public-key',
        MAILJET_SECRET_KEY: 'private-key',
        MAIL_FROM_EMAIL: 'meridian@example.com',
        MAIL_FROM_NAME: 'Meridian',
      }),
    );

    await service.sendPasswordResetEmail({
      to: 'traveler@example.com',
      name: 'Traveler',
      resetUrl: 'https://meridian.example.com/reset-password?token=abc',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe('https://api.mailjet.com/v3.1/send');
    expect(init?.method).toBe('POST');

    expect(typeof init?.body).toBe('string');

    if (typeof init?.body !== 'string') {
      throw new Error('Expected Mailjet request body to be a string');
    }

    const body = JSON.parse(init.body) as {
      Messages: Array<{
        From: {
          Email: string;
          Name: string;
        };
        To: Array<{
          Email: string;
          Name: string;
        }>;
        Subject: string;
        TextPart: string;
        HTMLPart: string;
      }>;
    };

    expect(body.Messages[0]).toMatchObject({
      From: {
        Email: 'meridian@example.com',
        Name: 'Meridian',
      },
      To: [
        {
          Email: 'traveler@example.com',
          Name: 'Traveler',
        },
      ],
      Subject: 'Reset your Meridian password',
    });

    expect(body.Messages[0]?.TextPart).toContain(
      'https://meridian.example.com/reset-password?token=abc',
    );
  });

  it('fails safely when Mailjet returns a non-success response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('sender not authorized', {
        status: 403,
      }),
    );

    const service = new EmailService(
      config({
        MAIL_PROVIDER: 'mailjet',
        MAILJET_API_KEY: 'public-key',
        MAILJET_SECRET_KEY: 'private-key',
        MAIL_FROM_EMAIL: 'meridian@example.com',
      }),
    );

    await expect(
      service.sendPasswordResetEmail({
        to: 'traveler@example.com',
        name: 'Traveler',
        resetUrl: 'https://meridian.example.com/reset-password?token=abc',
      }),
    ).rejects.toThrow('Mailjet delivery failed with status 403');
  });
});
