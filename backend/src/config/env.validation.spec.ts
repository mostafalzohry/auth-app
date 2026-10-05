import { envValidationSchema } from './env.validation';

const base = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/auth_app_test',
  AUTH_ALLOWED_ORIGINS: 'http://localhost:5173',
};
const SECRET = 'x'.repeat(32);

function validate(env: Record<string, unknown>) {
  return envValidationSchema.validate(env, { abortEarly: false });
}

describe('JWT_SECRET validation', () => {
  it('accepts a secret of at least 32 bytes', () => {
    expect(validate({ ...base, JWT_SECRET: SECRET }).error).toBeUndefined();
  });

  it('counts bytes, not characters', () => {
    const multiByte = 'é'.repeat(16);

    expect(validate({ ...base, JWT_SECRET: multiByte }).error).toBeUndefined();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too short', 'short-but-secret-value'],
    ['not a string', 1234567890],
  ])('rejects a %s secret without echoing it', (_label, secret) => {
    const { error } = validate({ ...base, JWT_SECRET: secret });

    expect(error).toBeDefined();
    const message = error?.message ?? '';
    expect(message).toContain('JWT_SECRET');
    if (typeof secret === 'string' && secret) {
      expect(message).not.toContain(secret);
    }
  });
});

describe('AUTH_ALLOWED_ORIGINS validation', () => {
  const withSecret = { ...base, JWT_SECRET: SECRET };

  it('normalizes the configured origins', () => {
    const { value, error } = validate({
      ...withSecret,
      AUTH_ALLOWED_ORIGINS: ' http://localhost:5173/ , http://127.0.0.1:5173 ',
    });

    expect(error).toBeUndefined();
    expect(value.AUTH_ALLOWED_ORIGINS).toBe(
      'http://localhost:5173,http://127.0.0.1:5173',
    );
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['a wildcard', '*'],
    ['a path', 'https://app.example.com/app'],
  ])('rejects %s', (_label, value) => {
    const { error } = validate({ ...withSecret, AUTH_ALLOWED_ORIGINS: value });

    expect(error?.message).toContain('AUTH_ALLOWED_ORIGINS');
  });

  it('requires https origins in production', () => {
    const production = {
      ...withSecret,
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: 1,
    };

    expect(
      validate({
        ...production,
        AUTH_ALLOWED_ORIGINS: 'https://app.example.com',
      }).error,
    ).toBeUndefined();
    expect(
      validate({
        ...production,
        AUTH_ALLOWED_ORIGINS: 'http://app.example.com',
      }).error?.message,
    ).toContain('https');
    expect(
      validate({
        ...production,
        AUTH_ALLOWED_ORIGINS: 'https://app.example.com,http://localhost:5173',
      }).error?.message,
    ).toContain('https');
  });
});

describe('TRUST_PROXY_HOPS validation', () => {
  const production = {
    ...base,
    JWT_SECRET: SECRET,
    NODE_ENV: 'production',
    AUTH_ALLOWED_ORIGINS: 'https://app.example.com',
  };

  it('is required in production', () => {
    expect(validate(production).error?.message).toContain('TRUST_PROXY_HOPS');
    const valid = validate({ ...production, TRUST_PROXY_HOPS: '1' });
    expect(valid.error).toBeUndefined();
    expect(valid.value.TRUST_PROXY_HOPS).toBe(1);
  });

  it('is optional outside production', () => {
    expect(validate({ ...base, JWT_SECRET: SECRET }).error).toBeUndefined();
  });

  it.each(['-1', '6', '1.5', 'abc'])('rejects %s', (value) => {
    expect(
      validate({ ...production, TRUST_PROXY_HOPS: value }).error?.message,
    ).toContain('TRUST_PROXY_HOPS');
  });
});
