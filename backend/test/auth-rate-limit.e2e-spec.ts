import { Logger, Type } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SanitizedLogger } from '../src/database/sanitized-logger';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher';
import { InMemoryRateLimitModel } from './helpers/in-memory-rate-limit-model';
import { InMemoryUserRepository } from './helpers/in-memory-user-repository';
import {
  api,
  createTestApp,
  loadAppModule,
  restoreEnv,
  snapshotEnv,
} from './helpers/test-app';
import { Error as MongooseError, mongo } from 'mongoose';

const WINDOW_MS = 15 * 60 * 1000;
const EMAIL = 'jane@example.com';
const PASSWORD = 'Sup3r-secret!';
const WRONG = { email: EMAIL, password: 'wrong-Pass1!' };
const TOO_MANY = { statusCode: 429, message: 'Too many requests' };

let counter = 0;
const newSignup = () => ({
  name: 'Test User',
  email: `user${++counter}@example.com`,
  password: PASSWORD,
});

describe('Shared rate limiting (e2e)', () => {
  const originalEnv = snapshotEnv();
  let AppModule: Type<unknown>;
  let apps: NestExpressApplication[];
  let repository: InMemoryUserRepository;
  let model: InMemoryRateLimitModel;

  beforeAll(async () => {
    AppModule = await loadAppModule();
  });

  afterAll(() => {
    restoreEnv(originalEnv);
  });

  async function startApp(
    options: { trustProxyHops?: number } = {},
  ): Promise<NestExpressApplication> {
    const app = await createTestApp(AppModule, repository, {
      rateLimitModel: model,
      ...options,
    });
    apps.push(app);
    return app;
  }

  async function seedUser(app: NestExpressApplication) {
    await api(app.getHttpServer())
      .post('/api/auth/signup')
      .set('X-Forwarded-For', '192.0.2.250')
      .send({ name: 'Jane Doe', email: EMAIL, password: PASSWORD })
      .expect(201);
    model.calls.length = 0;
  }

  const signin = (app: NestExpressApplication, body: unknown = WRONG) =>
    api(app.getHttpServer())
      .post('/api/auth/signin')
      .send(body as object);
  const signup = (app: NestExpressApplication) =>
    api(app.getHttpServer()).post('/api/auth/signup').send(newSignup());

  beforeEach(() => {
    apps = [];
    repository = new InMemoryUserRepository();
    model = new InMemoryRateLimitModel();
  });

  afterEach(async () => {
    try {
      jest.restoreAllMocks();
      await Promise.all(apps.map((app) => app.close()));
    } finally {
      Logger.overrideLogger(['error', 'warn', 'log']);
    }
  });

  describe('limits', () => {
    it('allows 10 signin attempts per window and rejects the 11th with a generic 429', async () => {
      const app = await startApp();
      await seedUser(app);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app).expect(401);
      }
      const verify = jest.spyOn(Argon2PasswordHasher.prototype, 'verify');
      const lookup = jest.spyOn(repository, 'findCredentialsByEmail');

      const res = await signin(app).expect(429);

      expect(res.body).toEqual(TOO_MANY);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(900);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(verify).not.toHaveBeenCalled();
      expect(lookup).not.toHaveBeenCalled();
    });

    it('counts successful attempts too', async () => {
      const app = await startApp();
      await seedUser(app);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app, { email: EMAIL, password: PASSWORD }).expect(200);
      }

      await signin(app, { email: EMAIL, password: PASSWORD }).expect(429);
    });

    it('counts invalid requests too', async () => {
      const app = await startApp();
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app, {}).expect(400);
      }

      await signin(app, {}).expect(429);
    });

    it('allows 5 signup attempts per window and rejects the 6th before hashing', async () => {
      const app = await startApp();
      for (let attempt = 1; attempt <= 5; attempt++) {
        await signup(app).expect(201);
      }
      const hash = jest.spyOn(Argon2PasswordHasher.prototype, 'hash');
      const create = jest.spyOn(repository, 'create');

      const res = await signup(app).expect(429);

      expect(res.body).toEqual(TOO_MANY);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(hash).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('counts duplicate-email signup attempts', async () => {
      const app = await startApp();
      await seedUser(app);
      for (let attempt = 1; attempt <= 4; attempt++) {
        await api(app.getHttpServer())
          .post('/api/auth/signup')
          .send({ name: 'Jane Doe', email: EMAIL, password: PASSWORD })
          .expect(409);
      }

      await signup(app).expect(429);
    });

    it('keeps the signup and signin buckets separate', async () => {
      const app = await startApp();
      await seedUser(app);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app).expect(401);
      }
      await signin(app).expect(429);

      for (let attempt = 1; attempt <= 4; attempt++) {
        await signup(app).expect(201);
      }
      await signup(app).expect(429);
      await signin(app).expect(429);
    });

    it('does not limit /me or logout', async () => {
      const app = await startApp();
      for (let attempt = 1; attempt <= 30; attempt++) {
        await api(app.getHttpServer()).post('/api/auth/logout').expect(204);
        await api(app.getHttpServer()).get('/api/auth/me').expect(401);
      }

      expect(model.calls).toHaveLength(0);
    });
  });

  describe('controlled time', () => {
    const windowStart = () => Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;

    it('reports an accurate Retry-After and resets in the next window', async () => {
      const app = await startApp();
      await seedUser(app);
      const start = windowStart();
      const now = jest.spyOn(Date, 'now').mockReturnValue(start + 1000);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app).expect(401);
      }

      const first = await signin(app).expect(429);
      expect(first.headers['retry-after']).toBe('899');

      now.mockReturnValue(start + WINDOW_MS - 1);
      const last = await signin(app).expect(429);
      expect(last.headers['retry-after']).toBe('1');

      now.mockReturnValue(start + WINDOW_MS);
      await signin(app).expect(401);
    });

    it('expires the bucket at the end of its window', async () => {
      const app = await startApp();
      const start = windowStart();
      jest.spyOn(Date, 'now').mockReturnValue(start + 5000);

      await signin(app).expect(401);

      const [bucket] = model.snapshot();
      expect(bucket.expiresAt).toEqual(new Date(start + WINDOW_MS));
    });
  });

  describe('client IP handling', () => {
    it('ignores forwarded headers locally so they cannot evade the limit', async () => {
      const app = await startApp();
      await seedUser(app);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app)
          .set('X-Forwarded-For', `198.51.100.${attempt}`)
          .set('X-Real-IP', `198.51.100.${attempt}`)
          .set('Forwarded', `for=198.51.100.${attempt}`)
          .expect(401);
      }

      await signin(app).set('X-Forwarded-For', '203.0.113.99').expect(429);
      const signinBuckets = model
        .snapshot()
        .filter((bucket) => bucket._id.startsWith('signin:'));
      expect(signinBuckets).toHaveLength(1);
    });

    it('uses separate buckets for different client IPs behind a trusted proxy', async () => {
      const app = await startApp({ trustProxyHops: 1 });
      await seedUser(app);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app).set('X-Forwarded-For', '203.0.113.5').expect(401);
      }

      await signin(app).set('X-Forwarded-For', '203.0.113.5').expect(429);
      await signin(app).set('X-Forwarded-For', '203.0.113.6').expect(401);
    });

    it('takes the address added by the trusted proxy, not the client-supplied prefix', async () => {
      const app = await startApp({ trustProxyHops: 1 });
      await seedUser(app);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(app)
          .set('X-Forwarded-For', `198.51.100.${attempt}, 203.0.113.5`)
          .expect(401);
      }

      await signin(app)
        .set('X-Forwarded-For', '198.51.100.200, 203.0.113.5')
        .expect(429);
    });

    it('does not store raw client IPs', async () => {
      const app = await startApp({ trustProxyHops: 1 });
      await signin(app).set('X-Forwarded-For', '203.0.113.5').expect(401);

      expect(JSON.stringify(model.snapshot())).not.toContain('203.0.113.5');
      expect(JSON.stringify(model.calls)).not.toContain('203.0.113.5');
      for (const bucket of model.snapshot()) {
        expect(Object.keys(bucket).sort()).toEqual([
          '_id',
          'count',
          'expiresAt',
        ]);
      }
    });
  });

  describe('shared store', () => {
    it('applies one limit across two app instances using the same store', async () => {
      const first = await startApp();
      const second = await startApp();
      await seedUser(first);
      for (let attempt = 1; attempt <= 10; attempt++) {
        await signin(attempt % 2 === 0 ? first : second).expect(401);
      }

      await signin(first).expect(429);
      await signin(second).expect(429);
    });
  });

  describe('limiter failures', () => {
    function captureLogs(app: NestExpressApplication) {
      let output = '';
      const capture = (chunk: string | Uint8Array) => {
        output += String(chunk);
        return true;
      };
      jest.spyOn(process.stdout, 'write').mockImplementation(capture);
      jest.spyOn(process.stderr, 'write').mockImplementation(capture);
      app.useLogger(new SanitizedLogger());
      return () => output;
    }

    it.each(['signin', 'signup'] as const)(
      'fails closed with a generic 503 and no hashing for %s',
      async (endpoint) => {
        const app = await startApp();
        const logs = captureLogs(app);
        model.failWith = new mongo.MongoServerError({
          message: 'failed mongodb://user:dbSecret@host/db',
          code: 13,
        });
        const hash = jest.spyOn(Argon2PasswordHasher.prototype, 'hash');
        const verify = jest.spyOn(Argon2PasswordHasher.prototype, 'verify');
        const lookup = jest.spyOn(repository, 'findCredentialsByEmail');
        const create = jest.spyOn(repository, 'create');

        const res =
          endpoint === 'signin'
            ? await signin(app).expect(503)
            : await signup(app).expect(503);

        expect(res.body).toMatchObject({
          statusCode: 503,
          message: 'Service unavailable',
        });
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.text).not.toContain('dbSecret');
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(hash).not.toHaveBeenCalled();
        expect(verify).not.toHaveBeenCalled();
        expect(lookup).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
        expect(logs()).toContain('Rate limiter unavailable (MongoServerError)');
        expect(logs()).not.toContain('dbSecret');
        expect(logs()).not.toContain('mongodb://');
      },
    );

    it('does not turn a programming error into a 429 or 503', async () => {
      const app = await startApp();
      captureLogs(app);
      model.failWith = new TypeError('bug');

      const res = await signin(app).expect(500);

      expect(res.body.message).toBe('Internal server error');
    });

    it('retries a duplicate-key race on the first request of a bucket', async () => {
      const app = await startApp();
      model.duplicateKeyFailures = 1;

      await signin(app).expect(401);

      expect(model.calls).toHaveLength(2);
      expect(model.snapshot()[0].count).toBe(1);
    });

    it('fails closed with exactly three attempts when duplicate-key errors keep happening', async () => {
      const app = await startApp();
      captureLogs(app);
      model.duplicateKeyFailures = 10;
      const hash = jest.spyOn(Argon2PasswordHasher.prototype, 'hash');
      const verify = jest.spyOn(Argon2PasswordHasher.prototype, 'verify');
      const lookup = jest.spyOn(repository, 'findCredentialsByEmail');
      const create = jest.spyOn(repository, 'create');

      const res = await signin(app).expect(503);

      expect(model.calls).toHaveLength(3);
      expect(res.body).toMatchObject({
        statusCode: 503,
        message: 'Service unavailable',
      });
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(hash).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
      expect(lookup).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a CastError',
        () => new MongooseError.CastError('ObjectId', 'sensitive-value', '_id'),
      ],
      ['a ValidationError', () => new MongooseError.ValidationError()],
    ])(
      'returns a generic 500 for %s without exposing values',
      async (_l, build) => {
        const app = await startApp();
        const logs = captureLogs(app);
        model.failWith = build();
        const hash = jest.spyOn(Argon2PasswordHasher.prototype, 'hash');
        const lookup = jest.spyOn(repository, 'findCredentialsByEmail');

        const res = await signin(app).expect(500);

        expect(res.body).toEqual({
          statusCode: 500,
          message: 'Internal server error',
        });
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.text).not.toContain('sensitive-value');
        expect(res.text).not.toContain('Rate limiter');
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(hash).not.toHaveBeenCalled();
        expect(lookup).not.toHaveBeenCalled();
        expect(logs()).not.toContain('Rate limiter unavailable');
        expect(logs()).not.toContain(PASSWORD);
      },
    );
  });
});
