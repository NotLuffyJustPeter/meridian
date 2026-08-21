import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export type PasswordResetEmail = {
  to: string;
  name: string;
  resetUrl: string;
};

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST')?.trim() || '127.0.0.1';

    const configuredPort = Number(this.configService.get<string>('SMTP_PORT') ?? '1025');

    const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 1025;

    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

    const user = this.configService.get<string>('SMTP_USER')?.trim();

    const password = this.configService.get<string>('SMTP_PASSWORD');

    this.transporter = createTransport({
      host,
      port,
      secure,
      ...(user && password
        ? {
            auth: {
              user,
              pass: password,
            },
          }
        : {}),
    });
  }

  async sendPasswordResetEmail(message: PasswordResetEmail): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM')?.trim() || 'Meridian <no-reply@meridian.local>';

    const safeName = this.escapeHtml(message.name);

    const safeResetUrl = this.escapeHtml(message.resetUrl);

    await this.transporter.sendMail({
      from,
      to: message.to,
      subject: 'Reset your Meridian password',
      text: [
        `Hi ${message.name},`,
        '',
        'We received a request to reset your Meridian password.',
        '',
        `Reset password: ${message.resetUrl}`,
        '',
        'This link expires soon. If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `
        <div style="margin:0;background:#07101b;padding:40px 20px;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0">
          <div style="max-width:560px;margin:0 auto;border:1px solid rgba(255,255,255,.10);border-radius:24px;background:#08131d;padding:32px">
            <div style="font-size:12px;letter-spacing:.22em;color:#7dd3fc;font-weight:700">MERIDIAN</div>
            <h1 style="margin:20px 0 12px;font-size:28px;line-height:1.15;color:#fff">Reset your password</h1>
            <p style="margin:0 0 22px;color:#94a3b8;line-height:1.7">Hi ${safeName}, we received a request to reset the password for your Meridian account.</p>
            <a href="${safeResetUrl}" style="display:inline-block;background:#fff;color:#0f172a;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 18px">Reset password</a>
            <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.7">This link expires soon. If you did not request this change, you can safely ignore this message.</p>
          </div>
        </div>
      `,
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };

      return entities[character] ?? character;
    });
  }
}
