import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import type { AccessTokenPayload } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import { PasswordResetService } from './password-reset.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  async register(
    @Body()
    dto: RegisterDto,
  ) {
    const user = await this.authService.register(dto);

    return {
      data: user,
      meta: null,
      message: 'Account created successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body()
    dto: LoginDto,
  ) {
    const result = await this.authService.login(dto);

    return {
      data: result,
      meta: null,
      message: 'Signed in successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('google')
  async googleLogin(
    @Body()
    dto: GoogleLoginDto,
  ) {
    const result = await this.authService.loginWithGoogle(dto.credential);

    return {
      data: result,
      meta: null,
      message: 'Signed in with Google successfully',
    };
  }

  @HttpCode(HttpStatus.ACCEPTED)
  @Post('password/forgot')
  async forgotPassword(
    @Body()
    dto: ForgotPasswordDto,
  ) {
    await this.passwordResetService.requestReset(dto.email);

    return {
      data: null,
      meta: null,
      message: 'If an account exists for this email, password reset instructions have been sent.',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset')
  async resetPassword(
    @Body()
    dto: ResetPasswordDto,
  ) {
    await this.passwordResetService.resetPassword(dto.token, dto.password);

    return {
      data: null,
      meta: null,
      message: 'Password reset successfully',
    };
  }

  @Get('mfa/status')
  @UseGuards(AccessTokenGuard)
  async mfaStatus(
    @CurrentUser()
    currentUser: AccessTokenPayload,
  ) {
    const security = await this.authService.getSecurityStatus(currentUser.sub);

    return {
      data: security.mfa,
      meta: null,
      message: 'Two-step verification status retrieved successfully',
    };
  }

  @Post('mfa/enroll')
  @UseGuards(AccessTokenGuard)
  async startMfaEnrollment(
    @CurrentUser()
    currentUser: AccessTokenPayload,
  ) {
    const enrollment = await this.authService.startMfaEnrollment(currentUser.sub);

    return {
      data: enrollment,
      meta: null,
      message: 'Two-step verification enrollment started successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/confirm')
  @UseGuards(AccessTokenGuard)
  async confirmMfaEnrollment(
    @CurrentUser()
    currentUser: AccessTokenPayload,

    @Body()
    dto: MfaCodeDto,
  ) {
    const result = await this.authService.confirmMfaEnrollment(currentUser.sub, dto.code);

    return {
      data: result,
      meta: null,
      message: 'Two-step verification enabled successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/verify')
  async verifyMfa(
    @Body()
    dto: MfaVerifyDto,
  ) {
    const result = await this.authService.verifyMfaChallenge(dto.challengeToken, dto.code);

    return {
      data: result,
      meta: null,
      message: 'Two-step verification completed successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/recovery-codes')
  @UseGuards(AccessTokenGuard)
  async regenerateRecoveryCodes(
    @CurrentUser()
    currentUser: AccessTokenPayload,

    @Body()
    dto: MfaCodeDto,
  ) {
    const recoveryCodes = await this.authService.regenerateMfaRecoveryCodes(
      currentUser.sub,
      dto.code,
    );

    return {
      data: {
        recoveryCodes,
      },
      meta: null,
      message: 'Recovery codes regenerated successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('mfa/disable')
  @UseGuards(AccessTokenGuard)
  async disableMfa(
    @CurrentUser()
    currentUser: AccessTokenPayload,

    @Body()
    dto: MfaCodeDto,
  ) {
    const security = await this.authService.disableMfa(currentUser.sub, dto.code);

    return {
      data: security,
      meta: null,
      message: 'Two-step verification disabled successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body()
    dto: RefreshTokenDto,
  ) {
    const result = await this.authService.refresh(dto.refreshToken);

    return {
      data: result,
      meta: null,
      message: 'Tokens refreshed successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Body()
    dto: RefreshTokenDto,
  ) {
    await this.authService.logout(dto.refreshToken);

    return {
      data: null,
      meta: null,
      message: 'Signed out successfully',
    };
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(
    @CurrentUser()
    currentUser: AccessTokenPayload,
  ) {
    const user = await this.authService.getCurrentUser(currentUser.sub);

    return {
      data: user,
      meta: null,
      message: 'Authenticated user retrieved successfully',
    };
  }

  @Patch('profile')
  @UseGuards(AccessTokenGuard)
  async updateProfile(
    @CurrentUser()
    currentUser: AccessTokenPayload,

    @Body()
    dto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(currentUser.sub, dto.name);

    return {
      data: user,
      meta: null,
      message: 'Profile updated successfully',
    };
  }

  @Get('security')
  @UseGuards(AccessTokenGuard)
  async security(
    @CurrentUser()
    currentUser: AccessTokenPayload,
  ) {
    const status = await this.authService.getSecurityStatus(currentUser.sub);

    return {
      data: status,
      meta: null,
      message: 'Security settings retrieved successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('google/link')
  @UseGuards(AccessTokenGuard)
  async linkGoogle(
    @CurrentUser()
    currentUser: AccessTokenPayload,

    @Body()
    dto: GoogleLoginDto,
  ) {
    const status = await this.authService.linkGoogleIdentity(currentUser.sub, dto.credential);

    return {
      data: status,
      meta: null,
      message: 'Google account linked successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Delete('google/link')
  @UseGuards(AccessTokenGuard)
  async unlinkGoogle(
    @CurrentUser()
    currentUser: AccessTokenPayload,
  ) {
    const status = await this.authService.unlinkGoogleIdentity(currentUser.sub);

    return {
      data: status,
      meta: null,
      message: 'Google account disconnected successfully',
    };
  }
}
