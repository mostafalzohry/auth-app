import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, Type } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import sharp from 'sharp';
import request from 'supertest';
import { InMemoryRateLimitModel } from './helpers/in-memory-rate-limit-model';
import { InMemoryUserRepository } from './helpers/in-memory-user-repository';
import {
  CSRF_HEADERS,
  TEST_ORIGIN,
  api,
  createTestApp,
  loadAppModule,
  restoreEnv,
  snapshotEnv,
} from './helpers/test-app';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name));
const JPEG = fixture('landscape-exif6.jpg');
const PNG = fixture('square.png');
const PASSWORD = 'Sup3r-secret!';

function tokenCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return (cookies.find((c) => c.startsWith('auth.token=')) as string).split(
    ';',
  )[0];
}

describe('Avatar (e2e)', () => {
  const originalEnv = snapshotEnv();
  let AppModule: Type<unknown>;
  let app: NestExpressApplication;
  let repository: InMemoryUserRepository;
  let rateLimitModel: InMemoryRateLimitModel;
  let userId: string;
  let cookie: string;

  beforeAll(async () => {
    AppModule = await loadAppModule();
  });

  afterAll(() => restoreEnv(originalEnv));

  const server = () => app.getHttpServer();

  async function signUpAndIn(email: string) {
    const signup = await api(server())
      .post('/api/auth/signup')
      .send({ name: 'Jane Doe', email, password: PASSWORD })
      .expect(201);
    const signin = await api(server())
      .post('/api/auth/signin')
      .send({ email, password: PASSWORD })
      .expect(200);
    return { id: signup.body.user.id as string, cookie: tokenCookie(signin) };
  }

  function upload(
    file: Buffer | null,
    opts: {
      cookie?: string | null;
      filename?: string;
      contentType?: string;
      field?: string;
      headers?: Record<string, string>;
    } = {},
  ) {
    const req = request(server())
      .post('/api/auth/avatar')
      .set(opts.headers ?? CSRF_HEADERS);
    const auth = opts.cookie === undefined ? cookie : opts.cookie;
    if (auth) req.set('Cookie', auth);
    if (file) {
      req.attach(opts.field ?? 'file', file, {
        filename: opts.filename ?? 'photo.jpg',
        contentType: opts.contentType ?? 'image/jpeg',
      });
    }
    return req;
  }

  const avatarLimitCalls = () =>
    rateLimitModel.calls.filter((call) =>
      (call.filter as { _id: string })._id.startsWith('avatar:'),
    );

  const getAvatar = (c: string | null = cookie) => {
    const req = request(server()).get('/api/auth/avatar');
    return c ? req.set('Cookie', c) : req;
  };

  beforeEach(async () => {
    repository = new InMemoryUserRepository();
    rateLimitModel = new InMemoryRateLimitModel();
    app = await createTestApp(AppModule, repository, { rateLimitModel });
    ({ id: userId, cookie } = await signUpAndIn('jane@example.com'));
  });

  afterEach(async () => {
    try {
      jest.restoreAllMocks();
      await app.close();
    } finally {
      Logger.overrideLogger(['error', 'warn', 'log']);
    }
  });

  describe('existing users without an avatar', () => {
    it('has no avatarUrl in /me and GET returns a no-store 404', async () => {
      const me = await api(server())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(me.body.user).not.toHaveProperty('avatarUrl');

      const res = await getAvatar().expect(404);
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('upload', () => {
    it('stores a normalized WebP and returns the public user with avatarUrl', async () => {
      const res = await upload(JPEG).expect(200);

      expect(res.body.user.avatarUrl).toBe('/api/auth/avatar?v=1');
      expect(res.body.user.id).toBe(userId);
      expect(Object.keys(res.body)).toEqual(['user']);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).not.toMatch(/passwordHash|avatarData|base64/i);

      const stored = await repository.findAvatar(userId);
      const meta = await sharp(stored?.data).metadata();
      expect(meta.format).toBe('webp');
      expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
        256,
      );
    });

    it('keeps the avatar out of /me JSON but exposes its URL', async () => {
      await upload(JPEG).expect(200);

      const me = await api(server())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(me.body.user.avatarUrl).toBe('/api/auth/avatar?v=1');
      expect(me.text).not.toMatch(/avatarData|base64|RIFF/);
    });

    it('replaces the previous image and changes the URL version', async () => {
      const first = await upload(JPEG).expect(200);
      const firstBytes = (await getAvatar().expect(200)).body as Buffer;
      const second = await upload(PNG, {
        filename: 'p.png',
        contentType: 'image/png',
      }).expect(200);
      const secondBytes = (await getAvatar().expect(200)).body as Buffer;

      expect(first.body.user.avatarUrl).not.toBe(second.body.user.avatarUrl);
      expect(second.body.user.avatarUrl).toBe('/api/auth/avatar?v=2');
      expect(Buffer.compare(firstBytes, secondBytes)).not.toBe(0);
    });

    it('does not touch credentials: the user can still sign in', async () => {
      await upload(JPEG).expect(200);

      await api(server())
        .post('/api/auth/signin')
        .send({ email: 'jane@example.com', password: PASSWORD })
        .expect(200);
    });

    it('ignores a client-provided owner and only changes the token owner', async () => {
      const other = await signUpAndIn('other@example.com');

      await upload(JPEG).field('userId', other.id).expect(400);
      await request(server())
        .post('/api/auth/avatar')
        .query({ userId: other.id })
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(200);

      expect(repository.hasAvatar(userId)).toBe(true);
      expect(repository.hasAvatar(other.id)).toBe(false);
    });

    it('trusts the bytes, not the filename or claimed MIME type', async () => {
      await upload(PNG, {
        filename: 'x.jpg',
        contentType: 'image/jpeg',
      }).expect(200);
      await upload(fixture('vector.svg'), {
        filename: 'x.png',
        contentType: 'image/png',
      }).expect(415);
    });

    it.each([
      ['SVG', 'vector.svg', 'image/svg+xml', 415],
      ['GIF', 'pixel.gif', 'image/gif', 415],
      ['corrupt PNG', 'truncated.png', 'image/png', 400],
    ])(
      'rejects %s without replacing the saved avatar',
      async (_l, name, type, status) => {
        await upload(PNG, {
          filename: 'ok.png',
          contentType: 'image/png',
        }).expect(200);
        const before = (await getAvatar().expect(200)).body as Buffer;

        const res = await upload(fixture(name), {
          filename: name,
          contentType: type,
        }).expect(status);

        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.text).not.toMatch(/sharp|vips|libvips|stack/i);
        const after = (await getAvatar().expect(200)).body as Buffer;
        expect(Buffer.compare(before, after)).toBe(0);
      },
    );

    it('rejects files over 2 MiB with 413', async () => {
      const big = Buffer.concat([JPEG, Buffer.alloc(2 * 1024 * 1024)]);

      const res = await upload(big).expect(413);

      expect(res.body.message).toBe('Image must be at most 2 MiB');
      expect(repository.replaceAvatarCalls).toBe(0);
    });

    it('rejects a missing file, a wrong field name and multiple files', async () => {
      await request(server())
        .post('/api/auth/avatar')
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .set('Content-Type', 'multipart/form-data; boundary=x')
        .send('--x--\r\n')
        .expect(400);
      await upload(JPEG, { field: 'avatar' }).expect(400);
      await upload(JPEG).attach('file', PNG, 'second.png').expect(400);
      await upload(JPEG).field('note', 'hello').expect(400);
      expect(repository.replaceAvatarCalls).toBe(0);
    });

    it('rejects a non-multipart body with 415', async () => {
      await request(server())
        .post('/api/auth/avatar')
        .set(CSRF_HEADERS)
        .set('Cookie', cookie)
        .send({ file: 'x' })
        .expect(415);
    });
  });

  describe('authentication, CSRF and rate limiting run before processing', () => {
    let process: jest.SpyInstance;

    beforeEach(() => {
      process = jest.spyOn(repository, 'replaceAvatar');
    });

    it('rejects unauthenticated uploads with 401 and no processing', async () => {
      const res = await upload(JPEG, { cookie: null }).expect(401);

      expect(res.headers['cache-control']).toBe('no-store');
      expect(process).not.toHaveBeenCalled();
      expect(avatarLimitCalls()).toHaveLength(0);
    });

    it('rejects a tampered cookie', async () => {
      await upload(JPEG, { cookie: `${cookie}x` }).expect(401);
      expect(process).not.toHaveBeenCalled();
    });

    it.each([
      ['missing Origin', { 'X-Auth-Request': '1' }],
      [
        'untrusted Origin',
        { Origin: 'https://evil.example', 'X-Auth-Request': '1' },
      ],
      ['missing X-Auth-Request', { Origin: TEST_ORIGIN }],
      ['cross-site fetch', { ...CSRF_HEADERS, 'Sec-Fetch-Site': 'cross-site' }],
    ])('rejects %s with 403', async (_l, headers) => {
      const res = await upload(JPEG, { headers }).expect(403);

      expect(res.body).toEqual({ statusCode: 403, message: 'Forbidden' });
      expect(res.headers['cache-control']).toBe('no-store');
      expect(process).not.toHaveBeenCalled();
      expect(avatarLimitCalls()).toHaveLength(0);
    });

    it('allows 10 uploads per user per window, then answers 429 before processing', async () => {
      for (let i = 0; i < 10; i++) await upload(PNG).expect(200);

      const res = await upload(PNG).expect(429);

      expect(res.headers['retry-after']).toMatch(/^\d+$/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(process).toHaveBeenCalledTimes(10);
    });

    it('limits per authenticated user, not per IP', async () => {
      const other = await signUpAndIn('other@example.com');
      for (let i = 0; i < 10; i++) await upload(PNG).expect(200);
      await upload(PNG).expect(429);

      await upload(PNG, { cookie: other.cookie }).expect(200);
    });

    it('counts rejected files toward the upload limit', async () => {
      for (let i = 0; i < 10; i++) {
        await upload(fixture('pixel.gif'), { contentType: 'image/gif' }).expect(
          415,
        );
      }
      await upload(PNG).expect(429);
    });

    it('stores only HMAC-hashed buckets, never the user id', async () => {
      await upload(PNG).expect(200);

      expect(JSON.stringify(rateLimitModel.snapshot())).not.toContain(userId);
    });

    it('answers 503 when the rate limiter is unavailable', async () => {
      const { mongo } = await import('mongoose');
      rateLimitModel.failWith = new mongo.MongoNetworkError('down');

      await upload(PNG).expect(503);
      expect(process).not.toHaveBeenCalled();
    });

    it('does not change the signin limit', async () => {
      for (let i = 0; i < 10; i++) await upload(PNG).expect(200);

      await api(server())
        .post('/api/auth/signin')
        .send({ email: 'jane@example.com', password: PASSWORD })
        .expect(200);
    });
  });

  describe('retrieval', () => {
    it('returns the stored image with safe headers', async () => {
      await upload(JPEG).expect(200);

      const res = await getAvatar().expect(200);

      expect(res.headers['content-type']).toBe('image/webp');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect((res.body as Buffer).subarray(8, 12).toString()).toBe('WEBP');
    });

    it('requires authentication', async () => {
      await upload(JPEG).expect(200);

      const res = await getAvatar(null).expect(401);

      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-type']).not.toBe('image/webp');
    });

    it("never returns another user's image", async () => {
      const other = await signUpAndIn('other@example.com');
      await upload(JPEG).expect(200);

      await getAvatar(other.cookie).expect(404);
    });
  });

  describe('existing JSON behavior is unchanged', () => {
    it('still requires JSON for signup and signin', async () => {
      for (const path of ['/api/auth/signup', '/api/auth/signin']) {
        await request(server())
          .post(path)
          .set(CSRF_HEADERS)
          .attach('file', PNG, 'p.png')
          .expect(415);
      }
    });

    it('does not accept multipart on other paths', async () => {
      await request(server())
        .post('/api/auth/avatar/extra')
        .set(CSRF_HEADERS)
        .attach('file', PNG, 'p.png')
        .expect(415);
    });

    it('keeps logout bodyless and idempotent', async () => {
      await api(server()).post('/api/auth/logout').expect(204);
    });
  });
});
