import { Logger, Type } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher';
import { InMemoryRateLimitModel } from './helpers/in-memory-rate-limit-model';
import { InMemoryUserRepository } from './helpers/in-memory-user-repository';
import {
  CSRF_HEADERS,
  TEST_ORIGIN,
  api,
  apiAgent,
  createTestApp,
  loadAppModule,
  restoreEnv,
  snapshotEnv,
} from './helpers/test-app';

const EMAIL = 'jane@example.com';
const PASSWORD = 'Sup3r-secret!';
const signupBody = { name: 'Jane Doe', email: EMAIL, password: PASSWORD };
const signinBody = { email: EMAIL, password: PASSWORD };
const SECOND_ORIGIN = 'http://127.0.0.1:5173';
const FORBIDDEN = { statusCode: 403, message: 'Forbidden' };

type Endpoint = 'signup' | 'signin' | 'logout';
const BODIES: Record<Endpoint, object | undefined> = {
  signup: { name: 'John Roe', email: 'john@example.com', password: PASSWORD },
  signin: signinBody,
  logout: undefined,
};

describe('CSRF protection and CORS (e2e)', () => {
  const originalEnv = snapshotEnv();
  let AppModule: Type<unknown>;
  let app: NestExpressApplication;
  let repository: InMemoryUserRepository;
  let rateLimits: InMemoryRateLimitModel;
  let hash: jest.SpyInstance;
  let verify: jest.SpyInstance;
  let create: jest.SpyInstance;
  let findCredentials: jest.SpyInstance;

  beforeAll(async () => {
    AppModule = await loadAppModule();
  });

  afterAll(() => {
    restoreEnv(originalEnv);
  });

  beforeEach(async () => {
    repository = new InMemoryUserRepository();
    rateLimits = new InMemoryRateLimitModel();
    app = await createTestApp(AppModule, repository, {
      rateLimitModel: rateLimits,
    });
    await api(app.getHttpServer())
      .post('/api/auth/signup')
      .send(signupBody)
      .expect(201);
    rateLimits.calls.length = 0;
    hash = jest.spyOn(Argon2PasswordHasher.prototype, 'hash');
    verify = jest.spyOn(Argon2PasswordHasher.prototype, 'verify');
    create = jest.spyOn(repository, 'create');
    findCredentials = jest.spyOn(repository, 'findCredentialsByEmail');
  });

  afterEach(async () => {
    try {
      jest.restoreAllMocks();
      await app.close();
    } finally {
      Logger.overrideLogger(['error', 'warn', 'log']);
    }
  });

  const server = () => app.getHttpServer();

  function send(
    endpoint: Endpoint,
    headers: Record<string, string | undefined>,
  ) {
    let req = request(server()).post(`/api/auth/${endpoint}`);
    for (const [name, value] of Object.entries(headers)) {
      if (value !== undefined) req = req.set(name, value);
    }
    const body = BODIES[endpoint];
    return body ? req.send(body) : req;
  }

  function expectNothingReachedTheApplication() {
    expect(hash).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(findCredentials).not.toHaveBeenCalled();
    expect(rateLimits.calls).toHaveLength(0);
  }

  function expectRejected(res: request.Response, body: object) {
    expect(res.body).toEqual(body);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.text).not.toContain(PASSWORD);
  }

  describe('allowed requests', () => {
    it('keeps normal behavior with an allowed Origin and the custom header', async () => {
      const agent = apiAgent(server());

      await agent.post('/api/auth/signup').send(BODIES.signup).expect(201);
      await agent.post('/api/auth/signin').send(signinBody).expect(200);
      await agent.get('/api/auth/me').expect(200);
      await agent.post('/api/auth/logout').expect(204);
    });

    it('accepts the second configured origin', async () => {
      await send('signin', {
        Origin: SECOND_ORIGIN,
        'X-Auth-Request': '1',
      }).expect(200);
    });

    it('logout works with an empty body and no Content-Type', async () => {
      const res = await request(server())
        .post('/api/auth/logout')
        .set(CSRF_HEADERS)
        .expect(204);

      expect(res.text).toBe('');
      expect(res.headers['content-type']).toBeUndefined();
    });

    it('does not require Sec-Fetch-Site and accepts non-cross-site values', async () => {
      for (const site of [undefined, 'same-origin', 'same-site', 'none']) {
        await send('signin', {
          ...CSRF_HEADERS,
          'Sec-Fetch-Site': site,
        }).expect(200);
      }
    });

    it('accepts JSON with parameters and any media type casing', async () => {
      for (const type of [
        'application/json; charset=utf-8',
        'Application/JSON',
      ]) {
        await send('signin', { ...CSRF_HEADERS, 'Content-Type': type }).expect(
          200,
        );
      }
    });

    it('does not change authentication state for GET requests', async () => {
      const agent = apiAgent(server());
      await agent.post('/api/auth/signin').send(signinBody).expect(200);

      const withoutHeaders = await request(server())
        .get('/api/auth/me')
        .set('Cookie', 'auth.token=garbage')
        .expect(401);
      const withCookie = await agent.get('/api/auth/me').expect(200);

      expect(withoutHeaders.headers['set-cookie']).toBeUndefined();
      expect(withCookie.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('rejected requests (403)', () => {
    const badOrigins: Array<[string, string | undefined]> = [
      ['a missing Origin', undefined],
      ['a null Origin', 'null'],
      ['a malformed Origin', 'not a url'],
      ['an untrusted Origin', 'http://evil.example'],
      ['an Origin with a trailing slash', `${TEST_ORIGIN}/`],
      ['an Origin with a path', `${TEST_ORIGIN}/app`],
      ['an Origin with another port', 'http://localhost:5174'],
      ['an Origin with another scheme', 'https://localhost:5173'],
      ['an Origin with different casing', 'http://LOCALHOST:5173'],
      ['a sibling subdomain Origin', 'http://evil.localhost:5173'],
    ];
    const endpoints: Endpoint[] = ['signup', 'signin', 'logout'];
    const originCases = endpoints.flatMap((endpoint) =>
      badOrigins.map(([label, origin]) => [endpoint, label, origin] as const),
    );

    it.each(originCases)('%s: %s', async (endpoint, _label, origin) => {
      const res = await send(endpoint, {
        Origin: origin,
        'X-Auth-Request': '1',
      }).expect(403);

      expectRejected(res, FORBIDDEN);
      expectNothingReachedTheApplication();
    });

    const badHeaders: Array<[string, string | undefined]> = [
      ['a missing header', undefined],
      ['an empty header', ''],
      ['the value 0', '0'],
      ['the value true', 'true'],
      ['the value 11', '11'],
    ];
    const headerCases = endpoints.flatMap((endpoint) =>
      badHeaders.map(([label, value]) => [endpoint, label, value] as const),
    );

    it.each(headerCases)(
      '%s: X-Auth-Request %s',
      async (endpoint, _l, value) => {
        const res = await send(endpoint, {
          Origin: TEST_ORIGIN,
          'X-Auth-Request': value,
        }).expect(403);

        expectRejected(res, FORBIDDEN);
        expectNothingReachedTheApplication();
      },
    );

    it.each(endpoints)('%s: a cross-site Sec-Fetch-Site', async (endpoint) => {
      for (const site of ['cross-site', 'Cross-Site']) {
        const res = await send(endpoint, {
          ...CSRF_HEADERS,
          'Sec-Fetch-Site': site,
        }).expect(403);

        expectRejected(res, FORBIDDEN);
      }
      expectNothingReachedTheApplication();
    });

    it('ignores Referer, Host and forwarded headers when deciding trust', async () => {
      const res = await send('signin', {
        Referer: `${TEST_ORIGIN}/login`,
        Host: 'localhost:5173',
        'X-Forwarded-Host': 'localhost:5173',
        'X-Auth-Request': '1',
      }).expect(403);

      expectRejected(res, FORBIDDEN);
      expectNothingReachedTheApplication();
    });

    it('rejects an untrusted Origin before the body is parsed as JSON', async () => {
      const res = await request(server())
        .post('/api/auth/signin')
        .set({
          Origin: 'http://evil.example',
          'X-Auth-Request': '1',
          'Content-Type': 'application/json',
        })
        .send('{"email": ')
        .expect(403);

      expectRejected(res, FORBIDDEN);
      expectNothingReachedTheApplication();
    });

    it('still returns 400 for malformed JSON when the CSRF checks pass', async () => {
      const res = await request(server())
        .post('/api/auth/signin')
        .set({ ...CSRF_HEADERS, 'Content-Type': 'application/json' })
        .send('{"email": ')
        .expect(400);

      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['set-cookie']).toBeUndefined();
      expectNothingReachedTheApplication();
    });

    it('rejects an unknown POST path without the headers', async () => {
      await request(server()).post('/api/auth/unknown').expect(403);
      await api(server()).post('/api/auth/unknown').send({}).expect(404);
    });
  });

  describe('unsupported media types (415)', () => {
    const types = [
      'text/plain',
      'application/x-www-form-urlencoded',
      'application/xml',
      'multipart/form-data; boundary=x',
      'application/jsonx',
    ];

    it.each(['signup', 'signin'] as const)(
      '%s rejects non-JSON content types',
      async (endpoint) => {
        for (const type of types) {
          const res = await request(server())
            .post(`/api/auth/${endpoint}`)
            .set(CSRF_HEADERS)
            .set('Content-Type', type)
            .send('email=a%40b.co&password=x')
            .expect(415);

          expectRejected(res, {
            statusCode: 415,
            message: 'Unsupported Media Type',
          });
        }
        expectNothingReachedTheApplication();
      },
    );

    it('answers 403 before 415 when both checks fail', async () => {
      await request(server())
        .post('/api/auth/signin')
        .set('Content-Type', 'text/plain')
        .send('x')
        .expect(403);
    });

    it('keeps the existing JSON validation behavior', async () => {
      const res = await api(server())
        .post('/api/auth/signin')
        .send({ email: 'nope', password: '' })
        .expect(400);

      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('credentialed CORS', () => {
    const preflight = (origin: string | undefined) => {
      let req = request(server())
        .options('/api/auth/signin')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-auth-request');
      if (origin) req = req.set('Origin', origin);
      return req;
    };

    it.each([TEST_ORIGIN, SECOND_ORIGIN])(
      'answers a preflight from %s without authentication',
      async (origin) => {
        const res = await preflight(origin).expect(204);

        expect(res.headers['access-control-allow-origin']).toBe(origin);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
        expect(res.headers['access-control-allow-methods']).toBe(
          'GET,POST,OPTIONS',
        );
        expect(res.headers['access-control-allow-headers']).toBe(
          'Content-Type,X-Auth-Request',
        );
        expect(res.headers['vary']).toContain('Origin');
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.headers['set-cookie']).toBeUndefined();
        expectNothingReachedTheApplication();
      },
    );

    it.each([
      ['an untrusted origin', 'http://evil.example'],
      ['the string null', 'null'],
      ['a trailing-slash origin', `${TEST_ORIGIN}/`],
    ])('gives %s no CORS permission', async (_label, origin) => {
      const res = await preflight(origin);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      expectNothingReachedTheApplication();
    });

    it('does not send CORS headers when there is no Origin', async () => {
      const res = await preflight(undefined);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('returns CORS headers on a real request from a trusted origin', async () => {
      const res = await send('signin', CSRF_HEADERS).expect(200);

      expect(res.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['access-control-expose-headers']).toBe('Retry-After');
    });

    it('never reflects an untrusted origin or uses a wildcard', async () => {
      const rejected = await send('signin', {
        Origin: 'http://evil.example',
        'X-Auth-Request': '1',
      }).expect(403);
      const trusted = await send('signin', CSRF_HEADERS).expect(200);

      expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
      expect(trusted.headers['access-control-allow-origin']).not.toBe('*');
    });
  });
});
