import type { RateLimitScope } from './rate-limiter.port';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export const RATE_LIMIT_POLICIES: Record<
  RateLimitScope,
  { limit: number; windowMs: number }
> = {
  signup: { limit: 5, windowMs: FIFTEEN_MINUTES_MS },
  signin: { limit: 10, windowMs: FIFTEEN_MINUTES_MS },
  avatar: { limit: 10, windowMs: FIFTEEN_MINUTES_MS },
};
