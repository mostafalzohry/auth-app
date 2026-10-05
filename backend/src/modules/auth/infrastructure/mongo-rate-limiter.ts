import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Error as MongooseError, Model, mongo } from 'mongoose';
import { safeDatabaseErrorName } from '../../../database/database-error-name';
import { RateLimiterUnavailableError } from '../application/rate-limit.errors';
import type {
  RateLimitDecision,
  RateLimiter,
  RateLimitRequest,
} from '../application/rate-limiter.port';
import {
  RATE_LIMIT_MODEL,
  RateLimitBucketRecord,
} from './rate-limit-bucket.schema';

const MAX_ATTEMPTS = 3;
const DUPLICATE_KEY_CODE = 11000;

const AVAILABILITY_DRIVER_ERRORS = [
  mongo.MongoNetworkError,
  mongo.MongoServerSelectionError,
  mongo.MongoTopologyClosedError,
  mongo.MongoServerClosedError,
  mongo.MongoNotConnectedError,
  mongo.MongoOperationTimeoutError,
  mongo.MongoServerError,
];
const BUFFER_TIMEOUT_MESSAGE = /buffering timed out/;

function isAvailabilityError(error: unknown): boolean {
  if (AVAILABILITY_DRIVER_ERRORS.some((type) => error instanceof type)) {
    return true;
  }
  if (error instanceof MongooseError.MongooseServerSelectionError) return true;
  return (
    error instanceof MongooseError &&
    Object.getPrototypeOf(error) === MongooseError.prototype &&
    BUFFER_TIMEOUT_MESSAGE.test(error.message)
  );
}

function isDuplicateKey(error: unknown): boolean {
  return (
    error instanceof mongo.MongoError &&
    (error as { code?: unknown }).code === DUPLICATE_KEY_CODE
  );
}

@Injectable()
export class MongoRateLimiter implements RateLimiter {
  private readonly hashKey: string;

  constructor(
    @InjectModel(RATE_LIMIT_MODEL)
    private readonly buckets: Model<RateLimitBucketRecord>,
    config: ConfigService,
  ) {
    this.hashKey = createHmac('sha256', config.getOrThrow<string>('JWT_SECRET'))
      .update('rate-limit-bucket-key-v1')
      .digest('hex');
  }

  async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
    const now = Date.now();
    const windowIndex = Math.floor(now / request.windowMs);
    const windowEnd = (windowIndex + 1) * request.windowMs;
    const count = await this.increment(
      this.bucketId(request, windowIndex),
      new Date(windowEnd),
    );
    return {
      allowed: count <= request.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
    };
  }

  private bucketId(request: RateLimitRequest, windowIndex: number): string {
    const digest = createHmac('sha256', this.hashKey)
      .update(`${request.scope}|${windowIndex}|${request.clientId}`)
      .digest('hex');
    return `${request.scope}:${windowIndex}:${digest}`;
  }

  private async increment(id: string, expiresAt: Date): Promise<number> {
    for (let attempt = 1; ; attempt++) {
      try {
        const bucket = await this.buckets
          .findOneAndUpdate(
            { _id: id },
            { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
            { upsert: true, returnDocument: 'after' },
          )
          .lean();
        if (typeof bucket?.count !== 'number') {
          throw new RateLimiterUnavailableError(safeDatabaseErrorName(null));
        }
        return bucket.count;
      } catch (error) {
        if (isDuplicateKey(error) && attempt < MAX_ATTEMPTS) continue;
        if (isAvailabilityError(error)) {
          throw new RateLimiterUnavailableError(
            safeDatabaseErrorName((error as Error).name),
          );
        }
        throw error;
      }
    }
  }
}
