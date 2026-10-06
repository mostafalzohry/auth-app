import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AVATAR_FIELD_NAME,
  AVATAR_MAX_UPLOAD_BYTES,
  AVATAR_MAX_UPLOAD_MIB,
} from '../domain/avatar-policy';
import multer, { memoryStorage, MulterError } from 'multer';

const parseSingleFile = multer({
  storage: memoryStorage(),
  limits: {
    fileSize: AVATAR_MAX_UPLOAD_BYTES,
    files: 1,
    fields: 0,
    parts: 2,
    headerPairs: 20,
  },
}).single(AVATAR_FIELD_NAME);

function toHttpError(error: unknown): Error {
  if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return new PayloadTooLargeException(
      `Image must be at most ${AVATAR_MAX_UPLOAD_MIB} MiB`,
    );
  }
  return new BadRequestException(
    `Send exactly one image in a form field named "${AVATAR_FIELD_NAME}"`,
  );
}

@Injectable()
export class AvatarUploadInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const http = context.switchToHttp();
    await new Promise<void>((resolve, reject) => {
      parseSingleFile(
        http.getRequest<Request>(),
        http.getResponse<Response>(),
        (error) => (error ? reject(toHttpError(error)) : resolve()),
      );
    });
    return next.handle();
  }
}
