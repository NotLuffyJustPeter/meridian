import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export type VerifiedGoogleIdentity = {
  providerSubject: string;
  email: string;
  name: string | null;
};

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async verifyCredential(credential: string): Promise<VerifiedGoogleIdentity> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();

    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });

      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new UnauthorizedException('Invalid Google credential');
      }

      const normalizedName = typeof payload.name === 'string' ? payload.name.trim() : '';

      return {
        providerSubject: payload.sub,
        email: payload.email,
        name: normalizedName.length > 0 ? normalizedName : null,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid Google credential');
    }
  }
}
