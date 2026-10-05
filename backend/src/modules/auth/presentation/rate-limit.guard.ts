import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_POLICIES } from '../application/rate-limit.policy';
import { RateLimiterUnavailableError } from '../application/rate-limit.errors';
import { RATE_LIMITER } from '../application/rate-limiter.port';
import type {
  RateLimiter,
  RateLimitScope,
} from '../application/rate-limiter.port';

const RATE_LIMIT_SCOPE = 'auth:rate-limit-scope';
const MAPPED_IPV4_PREFIX = '::ffff:';

export const RateLimit = (scope: RateLimitScope) =>
  SetMetadata(RATE_LIMIT_SCOPE, scope);

function clientIdOf(req: Request): string {
  const ip = req.ip ?? 'unknown';
  return ip.startsWith(MAPPED_IPV4_PREFIX)
    ? ip.slice(MAPPED_IPV4_PREFIX.length)
    : ip;
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

    const http = context.switchToHttp();
    try {
      const decision = await this.limiter.consume({
        scope,
        clientId: clientIdOf(http.getRequest<Request>()),
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
