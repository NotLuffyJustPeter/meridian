import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service';
import type { AccessTokenPayload } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guards/access-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);

    return {
      data: user,
      meta: null,
      message: 'Account created successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

    return {
      data: result,
      meta: null,
      message: 'Signed in successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto.refreshToken);

    return {
      data: result,
      meta: null,
      message: 'Tokens refreshed successfully',
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
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
}
