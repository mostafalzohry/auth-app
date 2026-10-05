import { ConfigService } from '@nestjs/config';
import { Error as MongooseError, Model, mongo } from 'mongoose';
import { InMemoryRateLimitModel } from '../../../../test/helpers/in-memory-rate-limit-model';
import { RateLimiterUnavailableError } from '../application/rate-limit.errors';
import { MongoRateLimiter } from './mongo-rate-limiter';
import { RateLimitBucketRecord } from './rate-limit-bucket.schema';

const WINDOW_MS = 15 * 60 * 1000;
const WINDOW_START = Math.floor(1_800_000_000_000 / WINDOW_MS) * WINDOW_MS;
const REQUEST = {
  scope: 'signin' as const,
  clientId: '203.0.113.7',
  limit: 3,
  windowMs: WINDOW_MS,
};

function setup() {
  const model = new InMemoryRateLimitModel();
  const config = {
    getOrThrow: () => 'unit-test-jwt-secret-0123456789abcdef-xyz',
  } as unknown as ConfigService;
  const limiter = new MongoRateLimiter(
    model as unknown as Model<RateLimitBucketRecord>,
    config,
  );
  return { model, limiter };
}

function setNow(ms: number) {
  jest.spyOn(Date, 'now').mockReturnValue(ms);
}

describe('MongoRateLimiter', () => {
  beforeEach(() => setNow(WINDOW_START + 1000));
  afterEach(() => jest.restoreAllMocks());

  it('uses one atomic upsert with $inc and $setOnInsert and no prior read', async () => {
    const { model, limiter } = setup();

    await limiter.consume(REQUEST);

    expect(model.calls).toHaveLength(1);
    const [call] = model.calls;
    expect(call.filter).toEqual({ _id: expect.any(String) });
    expect(call.update).toEqual({
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(WINDOW_START + WINDOW_MS) },
    });
    expect(call.options).toEqual({ upsert: true, returnDocument: 'after' });
  });

  it('allows requests up to the limit and rejects the next one', async () => {
    const { limiter } = setup();

    const decisions = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      decisions.push((await limiter.consume(REQUEST)).allowed);
    }

    expect(decisions).toEqual([true, true, true, false, false]);
  });

  it('reports the seconds left in the window as retryAfterSeconds', async () => {
    const { limiter } = setup();

    expect((await limiter.consume(REQUEST)).retryAfterSeconds).toBe(899);
    setNow(WINDOW_START + WINDOW_MS - 1);
    expect((await limiter.consume(REQUEST)).retryAfterSeconds).toBe(1);
  });

  it('starts a fresh bucket in the next window without relying on TTL deletion', async () => {
    const { model, limiter } = setup();
    for (let attempt = 0; attempt < 4; attempt++)
      await limiter.consume(REQUEST);
    expect((await limiter.consume(REQUEST)).allowed).toBe(false);

    setNow(WINDOW_START + WINDOW_MS);

    expect((await limiter.consume(REQUEST)).allowed).toBe(true);
    expect(model.snapshot()).toHaveLength(2);
  });

  it('keeps scopes and clients in separate buckets', async () => {
    const { model, limiter } = setup();

    await limiter.consume(REQUEST);
    await limiter.consume({ ...REQUEST, scope: 'signup' });
    await limiter.consume({ ...REQUEST, clientId: '203.0.113.8' });

    expect(model.snapshot().map((bucket) => bucket.count)).toEqual([1, 1, 1]);
  });

  it('stores only a hashed bucket id, a counter and an expiry', async () => {
    const { model, limiter } = setup();

    await limiter.consume(REQUEST);

    const [bucket] = model.snapshot();
    expect(Object.keys(bucket).sort()).toEqual(['_id', 'count', 'expiresAt']);
    expect(bucket._id).toMatch(/^signin:\d+:[0-9a-f]{64}$/);
    expect(JSON.stringify(bucket)).not.toContain('203.0.113.7');
    expect(bucket.expiresAt).toEqual(new Date(WINDOW_START + WINDOW_MS));
  });

  it('retries a duplicate-key race on the first upsert and counts once', async () => {
    const { model, limiter } = setup();
    model.duplicateKeyFailures = 1;

    const decision = await limiter.consume(REQUEST);

    expect(decision.allowed).toBe(true);
    expect(model.calls).toHaveLength(2);
    expect(model.snapshot()[0].count).toBe(1);
  });

  it('gives up with a sanitized error after repeated duplicate-key failures', async () => {
    const { model, limiter } = setup();
    model.duplicateKeyFailures = 5;

    const failure = await limiter.consume(REQUEST).catch((error) => error);

    expect(failure).toBeInstanceOf(RateLimiterUnavailableError);
    expect(model.calls).toHaveLength(3);
    expect(`${failure.message}${failure.stack}`).not.toContain('dbSecret');
  });

  describe('error classification', () => {
    const SECRET_MESSAGE = 'failed mongodb://user:dbSecret@host/db';

    function fake(type: new (...args: never[]) => Error, name: string) {
      const error = Object.create(type.prototype) as Error;
      Object.defineProperties(error, {
        message: { value: SECRET_MESSAGE },
        stack: { value: `${name}: ${SECRET_MESSAGE}\n    at somewhere` },
      });
      return error;
    }

    const availability: Array<[string, () => Error]> = [
      [
        'MongoNetworkError',
        () => fake(mongo.MongoNetworkError, 'MongoNetworkError'),
      ],
      [
        'MongoNetworkTimeoutError',
        () => fake(mongo.MongoNetworkTimeoutError, 'MongoNetworkTimeoutError'),
      ],
      [
        'MongoServerSelectionError',
        () =>
          fake(mongo.MongoServerSelectionError, 'MongoServerSelectionError'),
      ],
      [
        'MongoTopologyClosedError',
        () => fake(mongo.MongoTopologyClosedError, 'MongoTopologyClosedError'),
      ],
      [
        'MongoServerClosedError',
        () => fake(mongo.MongoServerClosedError, 'MongoServerClosedError'),
      ],
      [
        'MongoNotConnectedError',
        () => fake(mongo.MongoNotConnectedError, 'MongoNotConnectedError'),
      ],
      [
        'MongoOperationTimeoutError',
        () =>
          fake(mongo.MongoOperationTimeoutError, 'MongoOperationTimeoutError'),
      ],
      [
        'MongoServerError',
        () => new mongo.MongoServerError({ message: SECRET_MESSAGE, code: 13 }),
      ],
      [
        'MongooseServerSelectionError',
        () => new MongooseError.MongooseServerSelectionError(),
      ],
      [
        'a Mongoose buffering timeout',
        () =>
          new MongooseError(
            'Operation `rate_limits.findOneAndUpdate()` buffering timed out after 10000ms',
          ),
      ],
    ];

    it.each(availability)(
      'turns %s into a sanitized RateLimiterUnavailableError',
      async (_label, build) => {
        const { model, limiter } = setup();
        model.failWith = build();

        const error = await limiter.consume(REQUEST).catch((e) => e);

        expect(error).toBeInstanceOf(RateLimiterUnavailableError);
        expect(`${error.message}${error.stack}`).not.toContain('dbSecret');
        expect(`${error.message}${error.stack}`).not.toContain('mongodb://');
      },
    );

    const propagated: Array<[string, () => Error]> = [
      [
        'CastError',
        () => new MongooseError.CastError('ObjectId', 'bad-value', '_id'),
      ],
      ['ValidationError', () => new MongooseError.ValidationError()],
      ['StrictModeError', () => new MongooseError.StrictModeError('count')],
      [
        'a plain MongooseError',
        () => new MongooseError('Query was already executed'),
      ],
      [
        'MongoInvalidArgumentError',
        () => new mongo.MongoInvalidArgumentError('bad argument'),
      ],
      ['a TypeError', () => new TypeError('bug')],
    ];

    it.each(propagated)(
      'lets %s propagate unchanged',
      async (_label, build) => {
        const { model, limiter } = setup();
        const failure = build();
        model.failWith = failure;

        await expect(limiter.consume(REQUEST)).rejects.toBe(failure);
      },
    );

    it('treats an exhausted duplicate-key retry as unavailable', async () => {
      const { model, limiter } = setup();
      model.duplicateKeyFailures = 3;

      await expect(limiter.consume(REQUEST)).rejects.toBeInstanceOf(
        RateLimiterUnavailableError,
      );
      expect(model.calls).toHaveLength(3);
    });
  });

  it('fails closed when the database returns no counter', async () => {
    const { model, limiter } = setup();
    jest
      .spyOn(model, 'findOneAndUpdate')
      .mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(limiter.consume(REQUEST)).rejects.toBeInstanceOf(
      RateLimiterUnavailableError,
    );
  });
});
