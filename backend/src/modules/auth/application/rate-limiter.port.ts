export type RateLimitScope = 'signup' | 'signin';

export interface RateLimitRequest {
  scope: RateLimitScope;
  clientId: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(request: RateLimitRequest): Promise<RateLimitDecision>;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');
