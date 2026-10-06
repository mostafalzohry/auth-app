import { runInNewContext } from 'node:vm';
import { Logger, Type } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { authRequestInterceptor } from '../src/swagger.setup';
import { InMemoryUserRepository } from './helpers/in-memory-user-repository';
import {
  CSRF_HEADERS,
  TEST_JWT_SECRET,
  createTestApp,
  loadAppModule,
  restoreEnv,
  snapshotEnv,
} from './helpers/test-app';

type Json = Record<string, any>;

describe('Swagger and OpenAPI (e2e)', () => {
  const originalEnv = snapshotEnv();
  let AppModule: Type<unknown>;
  let app: NestExpressApplication;
  let document: Json;

  beforeAll(async () => {
    AppModule = await loadAppModule();
    app = await createTestApp(AppModule, new InMemoryUserRepository(), {
      swagger: true,
    });
    document = (await request(app.getHttpServer()).get('/swagger-json')).body;
  });

  afterAll(async () => {
    try {
      await app.close();
    } finally {
      Logger.overrideLogger(['error', 'warn', 'log']);
      restoreEnv(originalEnv);
    }
  });

  const server = () => app.getHttpServer();
  const operation = (path: string, method: string): Json =>
    document.paths[path][method];
  const headerParameter = (op: Json) =>
    (op.parameters ?? []).find((p: Json) => p.name === 'X-Auth-Request');

  describe('OpenAPI document', () => {
    it('is served as JSON at /swagger-json', async () => {
      const res = await request(server()).get('/swagger-json').expect(200);

      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.openapi).toMatch(/^3\./);
      expect(res.body.info.title).toBe('Auth API');
    });

    it('documents exactly the five endpoints', () => {
      expect(
        Object.entries(document.paths)
          .flatMap(([path, methods]) =>
            Object.keys(methods as Json).map((m) => `${m} ${path}`),
          )
          .sort(),
      ).toEqual([
        'get /',
        'get /api/auth/me',
        'post /api/auth/logout',
        'post /api/auth/signin',
        'post /api/auth/signup',
      ]);
    });

    it('describes JWT auth as the auth.token cookie and not Bearer auth', () => {
      const schemes = document.components.securitySchemes;

      expect(schemes['auth-cookie']).toMatchObject({
        type: 'apiKey',
        in: 'cookie',
        name: 'auth.token',
      });
      expect(Object.values(schemes).some((s: any) => s.type === 'http')).toBe(
        false,
      );
      expect(JSON.stringify(document).toLowerCase()).not.toContain('bearer"');
      expect(operation('/api/auth/me', 'get').security).toEqual([
        { 'auth-cookie': [] },
      ]);
      for (const [path, method] of [
        ['/', 'get'],
        ['/api/auth/signup', 'post'],
        ['/api/auth/signin', 'post'],
        ['/api/auth/logout', 'post'],
      ]) {
        expect(operation(path, method).security).toBeUndefined();
      }
    });

    it('requires X-Auth-Request: 1 on the authentication POSTs only', () => {
      for (const path of [
        '/api/auth/signup',
        '/api/auth/signin',
        '/api/auth/logout',
      ]) {
        expect(headerParameter(operation(path, 'post'))).toMatchObject({
          in: 'header',
          required: true,
          schema: { type: 'string', enum: ['1'], default: '1' },
        });
      }
      expect(headerParameter(operation('/api/auth/me', 'get'))).toBeUndefined();
      expect(headerParameter(operation('/', 'get'))).toBeUndefined();
    });

    it('documents request bodies with the validation constraints', () => {
      const schemas = document.components.schemas;

      for (const [path, name] of [
        ['/api/auth/signup', 'SignupDto'],
        ['/api/auth/signin', 'SigninDto'],
      ]) {
        const body = operation(path, 'post').requestBody;
        expect(body.required).toBe(true);
        expect(body.content['application/json'].schema.$ref).toBe(
          `#/components/schemas/${name}`,
        );
      }
      expect(schemas.SignupDto.required.sort()).toEqual([
        'email',
        'name',
        'password',
      ]);
      expect(schemas.SignupDto.properties.name).toMatchObject({
        minLength: 3,
        maxLength: 100,
      });
      expect(schemas.SignupDto.properties.email).toMatchObject({
        format: 'email',
        maxLength: 254,
      });
      expect(schemas.SignupDto.properties.password).toMatchObject({
        minLength: 8,
        maxLength: 128,
      });
      expect(schemas.SigninDto.required.sort()).toEqual(['email', 'password']);
      expect(schemas.SigninDto.properties.email).toMatchObject({
        format: 'email',
        maxLength: 254,
      });
      expect(schemas.SigninDto.properties.password).toMatchObject({
        minLength: 1,
        maxLength: 128,
      });
    });

    it('documents public-user responses without any password hash', () => {
      const schemas = document.components.schemas;

      expect(schemas.UserEnvelopeResponse.properties.user.$ref).toBe(
        '#/components/schemas/PublicUserResponse',
      );
      expect(Object.keys(schemas.PublicUserResponse.properties).sort()).toEqual(
        ['createdAt', 'email', 'id', 'name', 'updatedAt'],
      );
      expect(JSON.stringify(document)).not.toMatch(/passwordHash/i);
      for (const [path, method, status] of [
        ['/api/auth/signup', 'post', '201'],
        ['/api/auth/signin', 'post', '200'],
        ['/api/auth/me', 'get', '200'],
      ]) {
        expect(
          operation(path, method).responses[status].content['application/json']
            .schema.$ref,
        ).toBe('#/components/schemas/UserEnvelopeResponse');
      }
    });

    it('documents the status codes, the cookie headers and the rate limits', () => {
      const statuses = (path: string, method: string) =>
        Object.keys(operation(path, method).responses).sort();

      expect(statuses('/api/auth/signup', 'post')).toEqual([
        '201',
        '400',
        '403',
        '409',
        '415',
        '429',
        '500',
        '503',
      ]);
      expect(statuses('/api/auth/signin', 'post')).toEqual([
        '200',
        '400',
        '401',
        '403',
        '415',
        '429',
        '500',
        '503',
      ]);
      expect(statuses('/api/auth/me', 'get')).toEqual(['200', '401', '500']);
      expect(statuses('/api/auth/logout', 'post')).toEqual([
        '204',
        '403',
        '500',
      ]);
      for (const path of ['/api/auth/signup', '/api/auth/signin']) {
        expect(
          operation(path, 'post').responses['429'].headers['Retry-After'],
        ).toBeDefined();
      }
      expect(
        operation('/api/auth/signin', 'post').responses['200'].headers[
          'Set-Cookie'
        ],
      ).toBeDefined();
      expect(operation('/api/auth/signin', 'post').description).toContain(
        'auth.token',
      );
      expect(operation('/api/auth/logout', 'post').description).toContain(
        'does **not** revoke tokens',
      );
      expect(document.info.description).toContain('AUTH_ALLOWED_ORIGINS');
    });

    it('uses the documented example credentials', () => {
      const schemas = document.components.schemas;

      expect(schemas.SignupDto.properties.name.example).toBe('Mostafa Elzohry');
      expect(schemas.SignupDto.properties.email.example).toBe(
        'mostafa@example.com',
      );
      expect(schemas.SignupDto.properties.password.example).toBe(
        'ChangeMe-123!',
      );
      expect(schemas.SigninDto.properties.email.example).toBe(
        'mostafa@example.com',
      );
      expect(schemas.SigninDto.properties.password.example).toBe(
        'ChangeMe-123!',
      );
      expect(schemas.PublicUserResponse.properties.name.example).toBe(
        'Mostafa Elzohry',
      );
      expect(JSON.stringify(document)).not.toMatch(/Jane|John/);
      expect(
        operation('/', 'get').responses['200'].content['text/html'].schema
          .example,
      ).toBe('hi i am mostafa');
    });

    it('contains no tokens or secrets', () => {
      const text = JSON.stringify(document);

      expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
      expect(text).not.toContain(TEST_JWT_SECRET);
      expect(text).not.toContain('mongodb://');
    });
  });

  describe('Swagger UI', () => {
    it('serves the page and its assets', async () => {
      const page = await request(server()).get('/swagger').expect(200);
      const init = await request(server())
        .get('/swagger/swagger-ui-init.js')
        .expect(200);
      const bundle = await request(server())
        .get('/swagger/swagger-ui-bundle.js')
        .expect(200);
      const css = await request(server())
        .get('/swagger/swagger-ui.css')
        .expect(200);

      expect(page.headers['content-type']).toContain('text/html');
      expect(page.text).toContain('swagger-ui');
      expect(init.text).toContain('"openapi"');
      expect(bundle.headers['content-type']).toContain('javascript');
      expect(bundle.body.length || bundle.text.length).toBeGreaterThan(1000);
      expect(css.headers['content-type']).toContain('text/css');
    });

    it('is reachable without the CSRF headers and sets no cookie', async () => {
      const res = await request(server()).get('/swagger').expect(200);

      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('sends credentials and the CSRF header, keeps no stored authorization and hides Authorize', async () => {
      const page = await request(server()).get('/swagger').expect(200);
      const init = await request(server()).get('/swagger/swagger-ui-init.js');

      expect(init.text).toContain('withCredentials');
      expect(init.text).toContain('requestInterceptor');
      expect(init.text).toContain('X-Auth-Request');
      expect(init.text).toMatch(/"persistAuthorization":\s*false/);
      expect(init.text).not.toMatch(/['"](Origin|Cookie)['"]\s*\]/);
      expect(init.text).not.toMatch(/localStorage|sessionStorage/);
      expect(page.text).toContain('.auth-wrapper');
    });

    it('does not weaken the CSRF checks', async () => {
      await request(server()).post('/api/auth/signin').send({}).expect(403);
      await request(server())
        .post('/api/auth/signup')
        .set({ Origin: 'http://evil.example', 'X-Auth-Request': '1' })
        .send({})
        .expect(403);
    });

    it('still serves GET /', async () => {
      const res = await request(server()).get('/').expect(200);

      expect(res.text).toBe('hi i am mostafa');
    });
  });

  describe('Swagger UI request interceptor', () => {
    const run = (
      interceptor: typeof authRequestInterceptor,
      method: string,
      url: string,
    ) => interceptor({ method, url, headers: {} as Record<string, string> });

    const serialized = runInNewContext(
      `(${authRequestInterceptor.toString()})`,
    ) as typeof authRequestInterceptor;

    it.each([
      ['the function itself', authRequestInterceptor],
      ['its serialized, self-contained form', serialized],
    ])('adds the header and credentials to auth POSTs (%s)', (_l, fn) => {
      for (const path of ['signup', 'signin', 'logout']) {
        const req = run(fn, 'POST', `https://api.example.com/api/auth/${path}`);

        expect(req.headers).toEqual({ 'X-Auth-Request': '1' });
        expect(req.credentials).toBe('include');
      }
    });

    it.each([
      ['the function itself', authRequestInterceptor],
      ['its serialized, self-contained form', serialized],
    ])(
      'only includes credentials for auth GETs and leaves other requests alone (%s)',
      (_l, fn) => {
        const me = run(fn, 'GET', 'https://api.example.com/api/auth/me');
        const other = run(fn, 'POST', 'https://other.example.com/anything');
        const spec = run(fn, 'GET', 'https://api.example.com/swagger-json');

        expect(me.headers).toEqual({});
        expect(me.credentials).toBe('include');
        expect(other).toEqual({
          method: 'POST',
          url: 'https://other.example.com/anything',
          headers: {},
        });
        expect(spec.credentials).toBeUndefined();
      },
    );
  });

  describe('empty-body logout as Swagger UI sends it', () => {
    it('returns 204 with no Content-Type', async () => {
      await request(server())
        .post('/api/auth/logout')
        .set(CSRF_HEADERS)
        .expect(204);
    });

    it('returns 204 even if a JSON Content-Type accompanies the empty body', async () => {
      const res = await request(server())
        .post('/api/auth/logout')
        .set(CSRF_HEADERS)
        .set('Content-Type', 'application/json')
        .set('Content-Length', '0')
        .expect(204);

      expect(res.text).toBe('');
    });
  });
});
