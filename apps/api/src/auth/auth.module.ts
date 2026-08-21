import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { GoogleIdentityService } from './google-identity.service';
import { MfaService } from './mfa.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionsService,
    GoogleIdentityService,
    MfaService,
    EmailService,
    PasswordResetService,
    AccessTokenGuard,
  ],
  exports: [AccessTokenGuard, JwtModule],
})
export class AuthModule {}
