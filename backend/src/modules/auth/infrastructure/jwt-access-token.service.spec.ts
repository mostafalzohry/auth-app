import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtAccessTokenService } from './jwt-access-token.service';

const SECRET = 'unit-test-jwt-secret-0123456789abcdef-xyz';
const USER_ID = '507f1f77bcf86cd799439011';
const NOW = 1_800_000_000;
const CLAIMS = { sub: USER_ID, iss: 'auth-app', aud: 'auth-app-api' };
const VERIFY_OPTIONS = {
  secret: SECRET,
  algorithms: ['HS256'],
  issuer: 'auth-app',
  audience: 'auth-app-api',
};

function setup() {
  const jwt = new JwtService();
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;
  return { jwt, service: new JwtAccessTokenService(jwt, config) };
}

function signRaw(payload: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  const signature = createHmac('sha256', SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function signWith(
  jwt: JwtService,
  payload: Record<string, unknown>,
  expiresIn?: number,
): Promise<string> {
  return jwt.signAsync(payload, {
    secret: SECRET,
    algorithm: 'HS256',
    issuer: 'auth-app',
    audience: 'auth-app-api',
    subject: USER_ID,
    ...(expiresIn === undefined ? {} : { expiresIn }),
  });
}

function setNow(seconds: number) {
  jest.spyOn(Date, 'now').mockReturnValue(seconds * 1000);
}

describe('JwtAccessTokenService (real jsonwebtoken)', () => {
  beforeEach(() => {
    setNow(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('signs a 15-minute HS256 token with only sub, iat, exp, iss and aud', async () => {
    const { jwt, service } = setup();

    const token = await service.sign(USER_ID);

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
    expect(payload.sub).toBe(USER_ID);
    expect(payload.iat).toBe(NOW);
    expect(payload.exp - payload.iat).toBe(900);
  });

  it('verifies its own token and returns the user id', async () => {
    const { service } = setup();

    await expect(service.verify(await service.sign(USER_ID))).resolves.toEqual({
      userId: USER_ID,
    });
  });

  it('returns null for garbage, a tampered token and a token signed with another secret', async () => {
    const { jwt, service } = setup();
    const token = await service.sign(USER_ID);
    const [header, payload, signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({
        ...jwt.decode(token),
        sub: '507f1f77bcf86cd799439099',
      }),
    ).toString('base64url');
    const foreign = await jwt.signAsync(
      {},
      {
        secret: 'another-secret-0123456789abcdef-xyz-abc',
        algorithm: 'HS256',
        expiresIn: 900,
        issuer: 'auth-app',
        audience: 'auth-app-api',
        subject: USER_ID,
      },
    );

    for (const candidate of [
      'not-a-jwt',
      '',
      `${header}.${forgedPayload}.${signature}`,
      `${header}.${payload}.`,
      foreign,
    ]) {
      await expect(service.verify(candidate)).resolves.toBeNull();
    }
  });

  describe('timestamp policy', () => {
    it('rejects a token whose lifetime is longer than 15 minutes', async () => {
      const { jwt, service } = setup();

      await expect(
        service.verify(await signWith(jwt, {}, 3600)),
      ).resolves.toBeNull();
      await expect(
        service.verify(await signWith(jwt, {}, 901)),
      ).resolves.toBeNull();
      await expect(
        service.verify(await signWith(jwt, {}, 900)),
      ).resolves.toEqual({ userId: USER_ID });
    });

    it('rejects an expired token with zero clock tolerance', async () => {
      const { service } = setup();
      const token = await service.sign(USER_ID);

      setNow(NOW + 899);
      await expect(service.verify(token)).resolves.toEqual({
        userId: USER_ID,
      });
      setNow(NOW + 900);
      await expect(service.verify(token)).resolves.toBeNull();
      setNow(NOW + 901);
      await expect(service.verify(token)).resolves.toBeNull();
    });

    it('rejects an iat in the future even when the library accepts the token', async () => {
      const { jwt, service } = setup();
      const token = await signWith(jwt, { iat: NOW + 60, exp: NOW + 960 });

      await expect(
        jwt.verifyAsync(token, VERIFY_OPTIONS),
      ).resolves.toMatchObject({ iat: NOW + 60 });
      await expect(service.verify(token)).resolves.toBeNull();
    });

    it('accepts an iat equal to the current time and rejects one second later', async () => {
      const { jwt, service } = setup();

      await expect(
        service.verify(await signWith(jwt, { iat: NOW, exp: NOW + 900 })),
      ).resolves.toEqual({ userId: USER_ID });
      await expect(
        service.verify(await signWith(jwt, { iat: NOW + 1, exp: NOW + 901 })),
      ).resolves.toBeNull();
    });

    it.each([
      ['a missing iat', { exp: NOW + 600 }],
      ['a missing exp', { iat: NOW - 10 }],
      ['a string iat', { iat: 'abc', exp: NOW + 600 }],
      ['a string exp', { iat: NOW - 10, exp: 'abc' }],
      ['a null iat', { iat: null, exp: NOW + 600 }],
      ['a negative iat', { iat: -10, exp: NOW + 600 }],
      ['a negative exp', { iat: -1000, exp: -100 }],
      ['an exp equal to iat', { iat: NOW - 10, exp: NOW - 10 }],
      ['an exp before iat', { iat: NOW - 10, exp: NOW - 20 }],
    ])('rejects a correctly signed token with %s', async (_label, times) => {
      const { service } = setup();

      await expect(
        service.verify(signRaw({ ...CLAIMS, ...times })),
      ).resolves.toBeNull();
    });

    it('accepts a correctly signed hand-built token with valid timestamps', async () => {
      const { service } = setup();

      await expect(
        service.verify(signRaw({ ...CLAIMS, iat: NOW - 10, exp: NOW + 600 })),
      ).resolves.toEqual({ userId: USER_ID });
    });

    it.each([
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
      ['NaN', NaN],
    ])(
      'rejects non-finite %s timestamps that cannot be encoded in a JWT',
      async (_label, value) => {
        const { jwt, service } = setup();
        const verify = jest.spyOn(jwt, 'verifyAsync');
        verify.mockResolvedValue({ sub: USER_ID, iat: value, exp: value });

        await expect(service.verify('any.token.value')).resolves.toBeNull();
        verify.mockResolvedValue({
          sub: USER_ID,
          iat: NOW - 10,
          exp: value,
        });
        await expect(service.verify('any.token.value')).resolves.toBeNull();
        expect(verify).toHaveBeenCalledWith(
          'any.token.value',
          expect.objectContaining({ ...VERIFY_OPTIONS, clockTolerance: 0 }),
        );
      },
    );
  });
});
