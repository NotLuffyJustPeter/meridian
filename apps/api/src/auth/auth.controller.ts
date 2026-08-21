import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import type { AccessTokenPayload } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guards/access-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
