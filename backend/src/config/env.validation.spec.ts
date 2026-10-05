import { envValidationSchema } from './env.validation';

const base = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/auth_app_test',
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
