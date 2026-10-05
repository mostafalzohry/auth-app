import { INestApplication, Logger, Type } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SanitizedLogger } from '../src/database/sanitized-logger';
import { DuplicateEmailError } from '../src/modules/users/domain/user.errors';
import type { CreateUserInput } from '../src/modules/users/domain/user.types';
import {
  createTestApp,
  createUserRepositoryDouble,
  loadAppModule,
  restoreEnv,
  snapshotEnv,
} from './helpers/test-app';

const PASSWORD = 'Sup3r-secret!';
const validBody = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: PASSWORD,
};

describe('POST /api/auth/signup (e2e)', () => {
  const originalEnv = snapshotEnv();
  let AppModule: Type<unknown>;
  let app: INestApplication<App>;
  let repository: ReturnType<typeof createUserRepositoryDouble>;

  const signup = (body: unknown) =>
    request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(body as object);

  beforeAll(async () => {
    AppModule = await loadAppModule();
  });

  afterAll(() => {
    restoreEnv(originalEnv);
  });

  beforeEach(async () => {
    repository = createUserRepositoryDouble();
    repository.create.mockImplementation((input: CreateUserInput) =>
      Promise.resolve({
        id: '507f1f77bcf86cd799439011',
        name: input.name,
        email: input.email,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );
    app = await createTestApp(AppModule, repository);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    Logger.overrideLogger(['error', 'warn', 'log']);
    await app.close();
  });

  it('creates a user: 201, safe body, hash persisted, no session', async () => {
    const res = await signup({
      name: '  Jane Doe ',
      email: '  Jane@Example.COM ',
      password: PASSWORD,
    }).expect(201);

    expect(res.body).toEqual({
      user: {
        id: '507f1f77bcf86cd799439011',
        name: 'Jane Doe',
        email: 'jane@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['set-cookie']).toBeUndefined();

    const saved = repository.create.mock.calls[0][0];
    expect(saved.passwordHash).toMatch(/^\$argon2id\$/);
    expect(saved.passwordHash).not.toContain(PASSWORD);
    expect(res.text).not.toContain(saved.passwordHash);
    expect(res.text).not.toContain(PASSWORD);
    expect(JSON.stringify(saved)).not.toContain(PASSWORD);
  });

  describe('validation (400)', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['invalid email', { ...validBody, email: 'not-an-email' }],
      ['name shorter than 3 characters', { ...validBody, name: ' ab ' }],
      [
        'name longer than 100 characters',
        { ...validBody, name: 'a'.repeat(101) },
      ],
      [
        'email longer than 254 characters',
        { ...validBody, email: `${'a'.repeat(250)}@b.co` },
      ],
      ['password shorter than 8 characters', { ...validBody, password: 'a1!' }],
      [
        'password longer than 128 characters',
        { ...validBody, password: `a1!${'x'.repeat(126)}` },
      ],
      ['password without a letter', { ...validBody, password: '1234567!' }],
      ['password without a number', { ...validBody, password: 'abcdefg!' }],
      [
        'password without a special character',
        { ...validBody, password: 'abcdefg1' },
      ],
      [
        'password whose only special character is whitespace',
        { ...validBody, password: 'abcdef 1' },
      ],
      ['unexpected property', { ...validBody, role: 'admin' }],
      ['missing fields', {}],
      ['non-string name', { ...validBody, name: ['Jane Doe'] }],
      ['object email', { ...validBody, email: { toString: 'x@y.co' } }],
      ['numeric password', { ...validBody, password: 12345678 }],
      ['array password', { ...validBody, password: [PASSWORD] }],
    ];

    it.each(cases)('rejects %s', async (_label, body) => {
      const res = await signup(body).expect(400);

      expect(repository.create).not.toHaveBeenCalled();
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).not.toContain(PASSWORD);
      expect(res.text).not.toContain('abcdef');
    });

    it('rejects a non-object body', async () => {
      await signup([validBody]).expect(400);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('accepts a password that is not trimmed or transformed', async () => {
      await signup({ ...validBody, password: ' Aaaaaaa1! ' }).expect(201);
      expect(repository.create).toHaveBeenCalledTimes(1);
    });
  });

  it('returns 409 with a safe message for a duplicate email', async () => {
    repository.create.mockRejectedValue(new DuplicateEmailError());

    const res = await signup(validBody).expect(409);

    expect(res.body).toEqual({
      statusCode: 409,
      message: 'Email is already registered',
      error: 'Conflict',
    });
    expect(res.text).not.toContain(PASSWORD);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns a generic 500 and logs only redacted details', async () => {
    let output = '';
    const capture = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    jest.spyOn(process.stderr, 'write').mockImplementation(capture);
    app.useLogger(new SanitizedLogger());
    repository.create.mockRejectedValue(
      new Error('connect failed mongodb://user:dbSecret@host/db'),
    );

    const res = await signup(validBody).expect(500);

    expect(res.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(res.text).not.toContain('dbSecret');
    expect(res.text).not.toContain('mongodb');
    expect(res.text).not.toContain(PASSWORD);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(output).toContain('connect failed mongodb://<redacted>');
    expect(output).not.toContain('dbSecret');
    expect(output).not.toContain('user:');
    expect(output).not.toContain(PASSWORD);
  });
});
