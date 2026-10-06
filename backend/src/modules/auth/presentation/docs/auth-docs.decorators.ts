import { applyDecorators } from '@nestjs/common';
import {
  ApiConsumes,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { ErrorResponse } from '../dto/error.response';

export function ApiAuthRequestHeader() {
  return applyDecorators(
    ApiHeader({
      name: 'X-Auth-Request',
      required: true,
      description:
        'CSRF protection. Must be exactly `1` on every authentication POST. The request must also come from an allowed browser Origin (AUTH_ALLOWED_ORIGINS); Origin is set by the browser or HTTP client, not by this header.',
      schema: { type: 'string', enum: ['1'], default: '1' },
    }),
    ApiResponse({
      status: 403,
      description:
        'CSRF check failed: missing, malformed or untrusted Origin, missing or wrong `X-Auth-Request` header, or a cross-site `Sec-Fetch-Site`. Body: `{ "statusCode": 403, "message": "Forbidden" }`.',
      type: ErrorResponse,
    }),
  );
}

export function ApiJsonBody() {
  return applyDecorators(
    ApiConsumes('application/json'),
    ApiResponse({
      status: 415,
      description:
        'The request is not `application/json`. Body: `{ "statusCode": 415, "message": "Unsupported Media Type" }`.',
      type: ErrorResponse,
    }),
  );
}

export function ApiRateLimited(attempts: number, per = 'client IP') {
  return applyDecorators(
    ApiResponse({
      status: 429,
      description: `More than ${attempts} attempts from one ${per} in a 15-minute fixed window. Successful and failed attempts both count.`,
      type: ErrorResponse,
      headers: {
        'Retry-After': {
          description: 'Seconds until the current window ends.',
          schema: { type: 'integer', minimum: 1, example: 540 },
        },
      },
    }),
    ApiResponse({
      status: 503,
      description:
        'The rate-limit store is unavailable. The request is rejected before any password hashing.',
      type: ErrorResponse,
    }),
    ApiInternalServerErrorResponse({
      description: 'Unexpected failure. Generic message, no details.',
      type: ErrorResponse,
    }),
  );
}
