export class RateLimiterUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`Rate limiter unavailable (${reason})`);
    this.name = 'RateLimiterUnavailableError';
  }
}
