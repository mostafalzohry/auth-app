import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { toPublicUser } from '../../users/domain/public-user';
import { DuplicateEmailError } from '../../users/domain/user.errors';
import { InvalidCredentialsError } from '../application/auth.errors';
import { AuthService } from '../application/auth.service';
import { AuthCookieAdapter } from '../infrastructure/auth-cookie.adapter';
import { AccessTokenGuard } from './access-token.guard';
import type { AuthenticatedRequest } from './authenticated-request';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { RateLimit, RateLimitGuard } from './rate-limit.guard';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieAdapter,
  ) {}

  @Post('signup')
  @HttpCode(201)
  @RateLimit('signup')
  @UseGuards(RateLimitGuard)
  async signup(@Body() dto: SignupDto) {
    try {
      const user = await this.authService.signup(dto);
      return { user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  @Post('signin')
  @HttpCode(200)
  @RateLimit('signin')
  @UseGuards(RateLimitGuard)
  async signin(
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { user, accessToken } = await this.authService.signin(dto);
      this.cookies.issue(res, accessToken);
      return { user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException('Invalid email or password');
      }
      throw error;
    }
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() req: AuthenticatedRequest) {
    return { user: toPublicUser(req.authUser) };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    this.cookies.clear(res);
  }
}
