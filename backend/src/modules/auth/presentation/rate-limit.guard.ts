import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from './authenticated-request';
import { RATE_LIMIT_POLICIES } from '../application/rate-limit.policy';
import { RateLimiterUnavailableError } from '../application/rate-limit.errors';
import { RATE_LIMITER } from '../application/rate-limiter.port';
import type {
  RateLimiter,
  RateLimitScope,
} from '../application/rate-limiter.port';

const RATE_LIMIT_SCOPE = 'auth:rate-limit-scope';
const RATE_LIMIT_SUBJECT = 'auth:rate-limit-subject';
const MAPPED_IPV4_PREFIX = '::ffff:';

type RateLimitSubject = 'ip' | 'user';

export const RateLimit = (scope: RateLimitScope, by: RateLimitSubject = 'ip') =>
  applyDecorators(
    SetMetadata(RATE_LIMIT_SCOPE, scope),
    SetMetadata(RATE_LIMIT_SUBJECT, by),
  );

function clientIdOf(req: Request): string {
  const ip = req.ip ?? 'unknown';
  return ip.startsWith(MAPPED_IPV4_PREFIX)
    ? ip.slice(MAPPED_IPV4_PREFIX.length)
    : ip;
}

function clientIdFor(req: Request, by: RateLimitSubject = 'ip'): string {
  if (by === 'user') {
    const userId = (req as Partial<AuthenticatedRequest>).authUser?.id;
    if (!userId) throw new UnauthorizedException();
    return `user:${userId}`;
  }
  return clientIdOf(req);
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger('RateLimit');

  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.get<RateLimitScope | undefined>(
      RATE_LIMIT_SCOPE,
      context.getHandler(),
    );
    if (!scope) return true;

    const by = this.reflector.get<RateLimitSubject | undefined>(
      RATE_LIMIT_SUBJECT,
      context.getHandler(),
    );
    const http = context.switchToHttp();
    try {
      const decision = await this.limiter.consume({
        scope,
        clientId: clientIdFor(http.getRequest<Request>(), by),
        ...RATE_LIMIT_POLICIES[scope],
      });
      if (decision.allowed) return true;

      http
        .getResponse<Response>()
        .setHeader('Retry-After', String(decision.retryAfterSeconds));
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    } catch (error) {
      if (error instanceof RateLimiterUnavailableError) {
        this.logger.warn(`Rate limiter unavailable (${error.reason})`);
        throw new ServiceUnavailableException('Service unavailable');
      }
      throw error;
    }
  }
}
