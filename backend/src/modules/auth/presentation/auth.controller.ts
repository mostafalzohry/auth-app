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
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { toPublicUser } from '../../users/domain/public-user';
import { DuplicateEmailError } from '../../users/domain/user.errors';
import { InvalidCredentialsError } from '../application/auth.errors';
import { AuthService } from '../application/auth.service';
import { AuthCookieAdapter } from '../infrastructure/auth-cookie.adapter';
import { AccessTokenGuard } from './access-token.guard';
import type { AuthenticatedRequest } from './authenticated-request';
import {
  ApiAuthRequestHeader,
  ApiJsonBody,
  ApiRateLimited,
} from './docs/auth-docs.decorators';
import { ErrorResponse } from './dto/error.response';
import { UserEnvelopeResponse } from './dto/public-user.response';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { RateLimit, RateLimitGuard } from './rate-limit.guard';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieAdapter,
  ) {}

  @ApiOperation({
    summary: 'Create an account',
    description:
      'Creates a user. Does not sign the user in and sets no cookie. Limited to 5 attempts per client IP per 15 minutes.',
  })
  @ApiAuthRequestHeader()
  @ApiJsonBody()
  @ApiRateLimited(5)
  @ApiCreatedResponse({ type: UserEnvelopeResponse })
  @ApiBadRequestResponse({
    description:
      'Validation failed. `message` is an array of rule messages and never echoes submitted values (including the password).',
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: 'The email is already registered.',
    type: ErrorResponse,
  })
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

  @ApiOperation({
    summary: 'Sign in and receive the auth cookie',
    description:
      'Verifies the credentials and **sets the `auth.token` cookie** (HttpOnly, SameSite=Lax, Path=/, 15 minutes; Secure in production). The JWT is never returned in the JSON body. Limited to 10 attempts per client IP per 15 minutes; unknown emails and wrong passwords return the same 401.',
  })
  @ApiAuthRequestHeader()
  @ApiJsonBody()
  @ApiRateLimited(10)
  @ApiOkResponse({
    type: UserEnvelopeResponse,
    headers: {
      'Set-Cookie': {
        description:
          '`auth.token=<signed JWT>; HttpOnly; SameSite=Lax; Path=/; Max-Age=900` (plus `Secure` in production). Also clears the legacy `auth.sid` cookie.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (generic array of rule messages).',
    type: ErrorResponse,
  })
  @ApiUnauthorizedResponse({
    description:
      'Invalid email or password. Same response for an unknown email and a wrong password.',
    type: ErrorResponse,
  })
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

  @ApiOperation({
    summary: 'Get the current user',
    description:
      'Protected endpoint. Authenticated by the `auth.token` cookie that signin sets; the browser sends it automatically.',
  })
  @ApiCookieAuth('auth-cookie')
  @ApiOkResponse({ type: UserEnvelopeResponse })
  @ApiUnauthorizedResponse({
    description:
      'Missing, malformed, tampered or expired token, or the user no longer exists.',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected failure. Generic message, no details.',
    type: ErrorResponse,
  })
  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() req: AuthenticatedRequest) {
    return { user: toPublicUser(req.authUser) };
  }

  @ApiOperation({
    summary: 'Clear the auth cookie',
    description:
      'Clears the `auth.token` cookie (and the legacy `auth.sid`). Needs no body and no authentication. It does **not** revoke tokens: a copied JWT stays valid until it expires (at most 15 minutes).',
  })
  @ApiAuthRequestHeader()
  @ApiNoContentResponse({
    description: 'No body. The cookie is cleared.',
    headers: {
      'Set-Cookie': {
        description:
          'Expires `auth.token` with the same attributes it was set with.',
        schema: { type: 'string' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected failure. Generic message, no details.',
    type: ErrorResponse,
  })
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    this.cookies.clear(res);
  }
}
