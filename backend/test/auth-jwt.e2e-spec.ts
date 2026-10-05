import { ConsoleLogger, Logger, Type } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { SanitizedLogger } from '../src/database/sanitized-logger';
import { InMemoryUserRepository } from './helpers/in-memory-user-repository';
import {
  TEST_JWT_SECRET,
  createTestApp,
  loadAppModule,
  restoreEnv,
  snapshotEnv,
} from './helpers/test-app';

const EMAIL = 'jane@example.com';
const PASSWORD = ' Sup3r-secret! ';
const signupBody = { name: 'Jane Doe', email: EMAIL, password: PASSWORD };
const signinBody = { email: EMAIL, password: PASSWORD };
const GENERIC_401 = {
  statusCode: 401,
  message: 'Invalid email or password',
  error: 'Unauthorized',
};
const PUBLIC_KEYS = ['createdAt', 'email', 'id', 'name', 'updatedAt'];
const EPOCH = /Expires=Thu, 01 Jan 1970/;

const jwt = new JwtService();
const nowSeconds = () => Math.floor(Date.now() / 1000);

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

function cookieNamed(res: request.Response, name: string): string | undefined {
  return setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
}

function pair(setCookie: string): string {
  return setCookie.split(';')[0];
}

function tokenOf(res: request.Response): string {
  return pair(cookieNamed(res, 'auth.token') as string).slice(
    'auth.token='.length,
  );
}

interface ForgeOptions {
  payload?: Record<string, unknown>;
  secret?: string;
  algorithm?: 'HS256' | 'HS512';
  expiresIn?: number;
  issuer?: string | null;
  audience?: string | null;
  subject?: string | null;
}

function forge(userId: string, options: ForgeOptions = {}): Promise<string> {
  const { payload = {}, secret = TEST_JWT_SECRET } = options;
  const signOptions: Record<string, unknown> = {
    secret,
    algorithm: options.algorithm ?? 'HS256',
  };
  if (options.expiresIn !== undefined)
    signOptions.expiresIn = options.expiresIn;
  else if (!('exp' in payload)) signOptions.expiresIn = 900;
  if (options.issuer !== null)
    signOptions.issuer = options.issuer ?? 'auth-app';
  if (options.audience !== null) {
    signOptions.audience = options.audience ?? 'auth-app-api';
  }
  if (options.subject !== null) signOptions.subject = options.subject ?? userId;
  return jwt.signAsync(payload, signOptions);
}

function unsignedToken(userId: string): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const iat = nowSeconds();
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: userId,
    iat,
    exp: iat + 900,
    iss: 'auth-app',
    aud: 'auth-app-api',
  })}.`;
}

describe('JWT authentication (e2e)', () => {
  const originalEnv = snapshotEnv();
  let AppModule: Type<unknown>;
  let app: NestExpressApplication;
  let repository: InMemoryUserRepository;
  let userId: string;

  beforeAll(async () => {
    AppModule = await loadAppModule();
  });

  afterAll(() => {
    restoreEnv(originalEnv);
  });

  async function startApp(production?: boolean) {
    repository = new InMemoryUserRepository();
    app = await createTestApp(AppModule, repository, { production });
    const res = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(signupBody)
      .expect(201);
    userId = res.body.user.id;
  }

  const server = () => app.getHttpServer();
  const signin = (body: unknown = signinBody) =>
    request(server())
      .post('/api/auth/signin')
      .send(body as object);
  const me = (cookie?: string) => {
    const req = request(server()).get('/api/auth/me');
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const meWithToken = (token: string) => me(`auth.token=${token}`);

  beforeEach(async () => {
    await startApp();
  });

  afterEach(async () => {
    try {
      jest.restoreAllMocks();
      await app.close();
    } finally {
      Logger.overrideLogger(['error', 'warn', 'log']);
    }
  });

  describe('signin', () => {
    it('returns the public user and sets only an HttpOnly auth.token cookie', async () => {
      const res = await signin().expect(200);

      expect(Object.keys(res.body)).toEqual(['user']);
      expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_KEYS);
      expect(res.body.user.email).toBe(EMAIL);
      const token = tokenOf(res);
      expect(res.text).not.toContain(token);
      expect(res.text).not.toContain('argon2');
      expect(res.headers['cache-control']).toBe('no-store');

      const cookie = cookieNamed(res, 'auth.token') as string;
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=900');
      expect(cookie).toContain('Expires=');
      expect(cookie).not.toMatch(/Domain=/i);
      expect(cookie).not.toMatch(/Secure/i);
    });

    it('issues an HS256 token with a 15-minute lifetime and no personal data', async () => {
      const token = tokenOf(await signin().expect(200));

      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString(),
      );
      const payload = jwt.decode(token);
      expect(header.alg).toBe('HS256');
      expect(Object.keys(payload).sort()).toEqual([
        'aud',
        'exp',
        'iat',
        'iss',
        'sub',
      ]);
      expect(payload.sub).toBe(userId);
      expect(payload.exp - payload.iat).toBe(900);
      expect(JSON.stringify(payload)).not.toContain(EMAIL);
    });

    it('normalizes the email but never the password', async () => {
      await signin({ email: '  JANE@Example.COM ', password: PASSWORD }).expect(
        200,
      );
      await signin({ email: EMAIL, password: PASSWORD.trim() }).expect(401);
    });

    it('returns the same 401 for a wrong password and an unknown email, with no cookie', async () => {
      const wrongPassword = await signin({
        email: EMAIL,
        password: 'wrong-Pass1!',
      }).expect(401);
      const unknownEmail = await signin({
        email: 'nobody@example.com',
        password: PASSWORD,
      }).expect(401);

      expect(wrongPassword.body).toEqual(GENERIC_401);
      expect(unknownEmail.body).toEqual(GENERIC_401);
      expect(setCookies(wrongPassword)).toHaveLength(0);
      expect(setCookies(unknownEmail)).toHaveLength(0);
    });

    const invalidBodies: Array<[string, unknown]> = [
      ['missing fields', {}],
      ['invalid email', { email: 'nope', password: PASSWORD }],
      ['empty password', { email: EMAIL, password: '' }],
      [
        'password longer than 128 characters',
        { email: EMAIL, password: 'a'.repeat(129) },
      ],
      ['numeric password', { email: EMAIL, password: 12345678 }],
      ['array password', { email: EMAIL, password: [PASSWORD] }],
      ['unexpected property', { ...signinBody, remember: true }],
    ];

    it.each(invalidBodies)('rejects %s with 400', async (_label, body) => {
      const lookup = jest.spyOn(repository, 'findCredentialsByEmail');

      const res = await signin(body).expect(400);

      expect(lookup).not.toHaveBeenCalled();
      expect(setCookies(res)).toHaveLength(0);
      expect(res.text).not.toContain(PASSWORD);
    });

    it('returns a generic 500 and no cookie when signing fails', async () => {
      jest.spyOn(ConsoleLogger.prototype, 'error').mockImplementation();
      jest
        .spyOn(JwtService.prototype, 'signAsync')
        .mockRejectedValueOnce(new Error(`signing failed ${TEST_JWT_SECRET}`));

      const res = await signin().expect(500);

      expect(res.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(res.text).not.toContain(TEST_JWT_SECRET);
      expect(setCookies(res)).toHaveLength(0);
    });

    it('does not report a repository outage as invalid credentials', async () => {
      jest.spyOn(ConsoleLogger.prototype, 'error').mockImplementation();
      repository.failFindCredentials = true;

      const res = await signin().expect(500);

      expect(res.body.message).toBe('Internal server error');
      expect(setCookies(res)).toHaveLength(0);
    });

    it('clears the legacy auth.sid cookie', async () => {
      const res = await signin().expect(200);

      const legacy = cookieNamed(res, 'auth.sid') as string;
      expect(legacy).toMatch(EPOCH);
      expect(legacy).toContain('Path=/');
      expect(legacy).toContain('HttpOnly');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the public user for a valid token', async () => {
      const agent = request.agent(server());
      await agent.post('/api/auth/signin').send(signinBody).expect(200);

      const res = await agent.get('/api/auth/me').expect(200);

      expect(Object.keys(res.body)).toEqual(['user']);
      expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_KEYS);
      expect(res.body.user.id).toBe(userId);
      expect(res.text).not.toContain('argon2');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('accepts a forged-for-test token that is correctly signed', async () => {
      await meWithToken(await forge(userId)).expect(200);
    });

    describe('rejects with 401', () => {
      const bad: Array<[string, () => Promise<string>]> = [
        [
          'an expired token',
          () =>
            forge(userId, {
              payload: { iat: nowSeconds() - 1000, exp: nowSeconds() - 100 },
            }),
        ],
        [
          'a token with a lifetime longer than 15 minutes',
          () => forge(userId, { expiresIn: 3600 }),
        ],
        [
          'a token signed with another secret',
          () =>
            forge(userId, {
              secret: 'another-secret-0123456789abcdef-xyz-abc',
            }),
        ],
        [
          'a token with the wrong algorithm (HS512)',
          () => forge(userId, { algorithm: 'HS512' }),
        ],
        [
          'an unsigned (alg none) token',
          () => Promise.resolve(unsignedToken(userId)),
        ],
        [
          'a token with the wrong issuer',
          () => forge(userId, { issuer: 'someone-else' }),
        ],
        ['a token without an issuer', () => forge(userId, { issuer: null })],
        [
          'a token with the wrong audience',
          () => forge(userId, { audience: 'another-api' }),
        ],
        [
          'a token without an audience',
          () => forge(userId, { audience: null }),
        ],
        ['a token without a subject', () => forge(userId, { subject: null })],
        [
          'a token with a numeric subject',
          () => forge(userId, { subject: null, payload: { sub: 123 } }),
        ],
        [
          'a token with an object subject',
          () =>
            forge(userId, { subject: null, payload: { sub: { id: userId } } }),
        ],
        [
          'a token with an empty subject',
          () => forge(userId, { subject: null, payload: { sub: '' } }),
        ],
        [
          'a token with an oversized subject',
          () => forge(userId, { subject: 'a'.repeat(65) }),
        ],
        [
          'a token for an unknown user id',
          () => forge(userId, { subject: 'not-an-object-id' }),
        ],
        ['garbage', () => Promise.resolve('not-a-jwt')],
        ['an empty token', () => Promise.resolve('')],
      ];

      it.each(bad)('%s', async (_label, build) => {
        const res = await meWithToken(await build()).expect(401);

        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body.statusCode).toBe(401);
      });

      it('a tampered signature', async () => {
        const token = await forge(userId);
        const [header, payload, signature] = token.split('.');
        const flipped = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;

        await meWithToken(`${header}.${payload}.${flipped}`).expect(401);
      });

      it('a tampered payload', async () => {
        const token = await forge(userId);
        const [header, , signature] = token.split('.');
        const payload = Buffer.from(
          JSON.stringify({ ...jwt.decode(token), sub: 'another-user' }),
        ).toString('base64url');

        await meWithToken(`${header}.${payload}.${signature}`).expect(401);
      });

      it('a request without a cookie or with unrelated cookies', async () => {
        await me().expect(401);
        await me('theme=dark; other=1').expect(401);
      });

      it('a wrong-case cookie name', async () => {
        await me(`AUTH.TOKEN=${await forge(userId)}`).expect(401);
      });

      it('an ambiguous cookie header with two auth.token values', async () => {
        const token = await forge(userId);

        await me(`auth.token=${token}; auth.token=${token}`).expect(401);
        await me(`auth.token=garbage; auth.token=${token}`).expect(401);
      });

      it('an empty auth.token cookie', async () => {
        await me('auth.token=').expect(401);
      });
    });

    it('still works with other cookies present', async () => {
      await me(`theme=dark; auth.token=${await forge(userId)}; other=1`).expect(
        200,
      );
    });

    it('returns 401 when the user no longer exists', async () => {
      const token = await forge(userId);
      repository.remove(userId);

      await meWithToken(token).expect(401);
    });

    it('returns a generic 500 when the repository fails', async () => {
      jest.spyOn(ConsoleLogger.prototype, 'error').mockImplementation();
      repository.failFindById = true;

      const res = await meWithToken(await forge(userId)).expect(500);

      expect(res.body.message).toBe('Internal server error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 204 with no body and clears auth.token and the legacy cookie', async () => {
      const signedIn = await signin().expect(200);

      const res = await request(server())
        .post('/api/auth/logout')
        .set('Cookie', pair(cookieNamed(signedIn, 'auth.token') as string))
        .expect(204);

      expect(res.text).toBe('');
      expect(res.headers['cache-control']).toBe('no-store');
      const cleared = cookieNamed(res, 'auth.token') as string;
      expect(cleared).toMatch(EPOCH);
      expect(cleared).toContain('Path=/');
      expect(cleared).toContain('HttpOnly');
      expect(cleared).toContain('SameSite=Lax');
      expect(cookieNamed(res, 'auth.sid')).toMatch(EPOCH);
    });

    it('works without a cookie and with malformed, ambiguous or expired cookies', async () => {
      const expired = await forge(userId, {
        payload: { iat: nowSeconds() - 1000, exp: nowSeconds() - 100 },
      });
      const cookies = [
        undefined,
        'auth.token=garbage',
        'auth.token=',
        `auth.token=${expired}`,
        'auth.token=a; auth.token=b',
      ];

      for (const cookie of cookies) {
        const req = request(server()).post('/api/auth/logout');
        const res = await (cookie ? req.set('Cookie', cookie) : req);
        expect(res.status).toBe(204);
        expect(cookieNamed(res, 'auth.token')).toMatch(EPOCH);
      }
    });

    it('accepted design: a copied valid token still works after logout until it expires', async () => {
      const signedIn = await signin().expect(200);
      const copied = tokenOf(signedIn);

      await request(server())
        .post('/api/auth/logout')
        .set('Cookie', `auth.token=${copied}`)
        .expect(204);

      await meWithToken(copied).expect(200);
    });

    it('a browser that follows the cleared cookie is logged out', async () => {
      const agent = request.agent(server());
      await agent.post('/api/auth/signin').send(signinBody).expect(200);
      await agent.get('/api/auth/me').expect(200);

      await agent.post('/api/auth/logout').expect(204);

      await agent.get('/api/auth/me').expect(401);
    });
  });

  describe('signup', () => {
    it('does not sign the user in', async () => {
      const res = await request(server())
        .post('/api/auth/signup')
        .send({
          name: 'John Roe',
          email: 'john@example.com',
          password: 'Sup3r-secret!',
        })
        .expect(201);

      expect(setCookies(res)).toHaveLength(0);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_KEYS);
    });

    it('still rejects a duplicate email with 409', async () => {
      await request(server())
        .post('/api/auth/signup')
        .send(signupBody)
        .expect(409);
    });
  });

  describe('cache headers', () => {
    it('sets no-store on every auth response, including body parser errors', async () => {
      const agent = request.agent(server());
      const responses = [
        await agent.post('/api/auth/signin').send(signinBody),
        await agent
          .post('/api/auth/signin')
          .send({ email: EMAIL, password: 'x' }),
        await agent.post('/api/auth/signin').send({}),
        await agent.get('/api/auth/me'),
        await agent.post('/api/auth/logout'),
        await agent.get('/api/auth/me'),
        await request(server()).get('/api/auth/does-not-exist'),
        await request(server())
          .post('/api/auth/signin')
          .set('Content-Type', 'application/json')
          .send('{"email": '),
      ];

      expect(responses.map((res) => res.status)).toEqual([
        200, 401, 400, 200, 204, 401, 404, 400,
      ]);
      for (const res of responses) {
        expect(res.headers['cache-control']).toBe('no-store');
      }
    });

    it('leaves GET / unchanged', async () => {
      const res = await request(server()).get('/').expect(200);

      expect(res.text).toBe('Hello World!');
      expect(res.headers['cache-control']).toBeUndefined();
    });
  });

  describe('production cookie settings', () => {
    beforeEach(async () => {
      await app.close();
      await startApp(true);
    });

    it('marks issued and cleared cookies Secure', async () => {
      const signedIn = await signin().expect(200);
      const cookie = cookieNamed(signedIn, 'auth.token') as string;

      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toMatch(/Domain=/i);
      expect(cookieNamed(signedIn, 'auth.sid')).toContain('Secure');

      const loggedOut = await request(server())
        .post('/api/auth/logout')
        .expect(204);
      expect(cookieNamed(loggedOut, 'auth.token')).toContain('Secure');
    });
  });

  describe('logging', () => {
    it('never writes tokens, cookies or secrets to the logs', async () => {
      let output = '';
      const capture = (chunk: string | Uint8Array) => {
        output += String(chunk);
        return true;
      };
      jest.spyOn(process.stdout, 'write').mockImplementation(capture);
      jest.spyOn(process.stderr, 'write').mockImplementation(capture);
      app.useLogger(new SanitizedLogger());

      const signedIn = await signin().expect(200);
      const token = tokenOf(signedIn);
      await meWithToken(token).expect(200);
      repository.failFindById = true;
      await meWithToken(token).expect(500);
      repository.failFindById = false;
      jest
        .spyOn(JwtService.prototype, 'signAsync')
        .mockRejectedValueOnce(new Error('signing failed'));
      await signin().expect(500);

      expect(output).toContain('ExceptionsHandler');
      expect(output).not.toContain(token);
      expect(output).not.toContain(TEST_JWT_SECRET);
      expect(output).not.toContain('auth.token');
      expect(output).not.toContain(PASSWORD);
    });
  });
});
