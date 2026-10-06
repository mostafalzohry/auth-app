import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  PayloadTooLargeException,
  Post,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UnsupportedMediaTypeException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AccessTokenGuard } from '../../auth/presentation/access-token.guard';
import type { AuthenticatedRequest } from '../../auth/presentation/authenticated-request';
import {
  ApiAuthRequestHeader,
  ApiRateLimited,
} from '../../auth/presentation/docs/auth-docs.decorators';
import { ErrorResponse } from '../../auth/presentation/dto/error.response';
import { UserEnvelopeResponse } from '../../auth/presentation/dto/public-user.response';
import {
  RateLimit,
  RateLimitGuard,
} from '../../auth/presentation/rate-limit.guard';
import { AvatarService } from '../application/avatar.service';
import { InvalidAvatarError } from '../domain/avatar-processor.port';
import {
  AVATAR_ACCEPTED_LABEL,
  AVATAR_FIELD_NAME,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_INPUT_MEGAPIXELS,
  AVATAR_MAX_UPLOAD_MIB,
  AVATAR_OUTPUT_CONTENT_TYPE,
} from '../domain/avatar-policy';
import { toPublicUser } from '../domain/public-user';
import { UserNotFoundError } from '../domain/user.errors';
import { ApiMultipartAvatarBody } from './avatar-docs.decorators';
import { AvatarUploadInterceptor } from './avatar-upload.interceptor';

@ApiTags('auth')
@Controller('api/auth/avatar')
export class AvatarController {
  constructor(private readonly avatars: AvatarService) {}

  @ApiOperation({
    summary: 'Upload or replace the profile image',
    description: `Protected. The owner is the user in the verified \`auth.token\` cookie. Accepts one ${AVATAR_ACCEPTED_LABEL} file (max ${AVATAR_MAX_UPLOAD_MIB} MiB, max ${AVATAR_MAX_INPUT_MEGAPIXELS} megapixels) in the multipart field \`${AVATAR_FIELD_NAME}\`. The image is decoded, auto-oriented, resized to fit ${AVATAR_MAX_DIMENSION}x${AVATAR_MAX_DIMENSION}, stripped of metadata, re-encoded as WebP and stored in the user document, replacing any previous avatar. Authentication and the rate limit (10 uploads per user per 15 minutes) are checked before the body is read.`,
  })
  @ApiCookieAuth('auth-cookie')
  @ApiAuthRequestHeader()
  @ApiMultipartAvatarBody()
  @ApiRateLimited(10, 'user')
  @ApiOkResponse({ type: UserEnvelopeResponse })
  @ApiBadRequestResponse({
    description:
      'Not exactly one file in the `file` field, or the image is corrupt.',
    type: ErrorResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, malformed, tampered or expired token.',
    type: ErrorResponse,
  })
  @Post()
  @HttpCode(200)
  @UseGuards(AccessTokenGuard, RateLimitGuard)
  @RateLimit('avatar', 'user')
  @UseInterceptors(AvatarUploadInterceptor)
  async upload(@Req() req: AuthenticatedRequest) {
    const file = req.file;
    if (!file) {
      throw new BadRequestException(
        `Send exactly one image in a form field named "${AVATAR_FIELD_NAME}"`,
      );
    }
    try {
      const user = await this.avatars.replace(req.authUser.id, file.buffer);
      return { user: toPublicUser(user) };
    } catch (error) {
      if (error instanceof UserNotFoundError) throw new UnauthorizedException();
      if (error instanceof InvalidAvatarError) {
        if (error.reason === 'unsupported') {
          throw new UnsupportedMediaTypeException(
            `Image must be a ${AVATAR_ACCEPTED_LABEL} file`,
          );
        }
        if (error.reason === 'too-large') {
          throw new PayloadTooLargeException('Image is too large');
        }
        throw new BadRequestException('Image could not be read');
      }
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Get the current profile image',
    description: `Protected. Returns the authenticated user’s avatar as \`${AVATAR_OUTPUT_CONTENT_TYPE}\` with \`X-Content-Type-Options: nosniff\` and \`Cache-Control: private, no-store\`. 404 when the user has no avatar.`,
  })
  @ApiCookieAuth('auth-cookie')
  @ApiProduces('image/webp')
  @ApiOkResponse({
    description: 'The WebP image bytes.',
    content: {
      'image/webp': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, malformed, tampered or expired token.',
    type: ErrorResponse,
  })
  @ApiNotFoundResponse({
    description: 'The user has no avatar.',
    type: ErrorResponse,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected failure. Generic message, no details.',
    type: ErrorResponse,
  })
  @Get()
  @UseGuards(AccessTokenGuard)
  async read(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const avatar = await this.avatars.find(req.authUser.id);
    if (!avatar) throw new NotFoundException('No avatar');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(avatar.data, { type: avatar.contentType });
  }
}
