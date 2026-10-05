import { DuplicateEmailError } from '../../users/domain/user.errors';
import { User } from '../../users/domain/user.types';
import { InvalidCredentialsError } from './auth.errors';
import { AuthService } from './auth.service';

const user: User = {
  id: '1',
  name: 'Jane',
  email: 'jane@example.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup() {
  const calls: string[] = [];
  const hasher = {
    hash: jest.fn((_password: string) => {
      calls.push('hash');
      return Promise.resolve('hashed-value');
    }),
    verify: jest.fn(),
  };
  const users = {
    create: jest.fn(() => {
      calls.push('create');
      return Promise.resolve(user);
    }),
    findById: jest.fn(),
    findCredentialsByEmail: jest.fn(),
  };
  const tokens = {
    sign: jest.fn(() => Promise.resolve('signed-token')),
    verify: jest.fn(),
  };
  return {
    calls,
    hasher,
    users,
    tokens,
    service: new AuthService(users, hasher, tokens),
  };
}

const input = {
  name: 'Jane',
  email: 'jane@example.com',
  password: 'secret-pw-1!',
};

describe('AuthService.signup', () => {
  it('hashes the password before persisting', async () => {
    const { calls, service } = setup();

    await service.signup(input);

    expect(calls).toEqual(['hash', 'create']);
  });

  it('passes the already-normalized email and a hash, never the plaintext password', async () => {
    const { hasher, users, service } = setup();

    await service.signup(input);

    expect(hasher.hash).toHaveBeenCalledWith('secret-pw-1!');
    expect(users.create).toHaveBeenCalledWith({
      name: 'Jane',
      email: 'jane@example.com',
      passwordHash: 'hashed-value',
    });
    expect(JSON.stringify(users.create.mock.calls)).not.toContain(
      'secret-pw-1!',
    );
  });

  it('returns only the public user and issues no token', async () => {
    const { tokens, service } = setup();

    const result = await service.signup(input);

    expect(result).toBe(user);
    expect(result).not.toHaveProperty('passwordHash');
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('propagates DuplicateEmailError', async () => {
    const { users, service } = setup();
    users.create.mockRejectedValueOnce(new DuplicateEmailError());

    await expect(service.signup(input)).rejects.toBeInstanceOf(
      DuplicateEmailError,
    );
  });
});

describe('AuthService.signin', () => {
  const credentials = { ...user, passwordHash: 'stored-hash' };

  it('returns the public user and a signed token when the password matches', async () => {
    const { hasher, users, tokens, service } = setup();
    users.findCredentialsByEmail.mockResolvedValue(credentials);
    hasher.verify.mockResolvedValue(true);

    const result = await service.signin({
      email: 'jane@example.com',
      password: ' secret-pw-1! ',
    });

    expect(users.findCredentialsByEmail).toHaveBeenCalledWith(
      'jane@example.com',
    );
    expect(hasher.verify).toHaveBeenCalledWith('stored-hash', ' secret-pw-1! ');
    expect(tokens.sign).toHaveBeenCalledWith('1');
    expect(result).toEqual({ user, accessToken: 'signed-token' });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a wrong password without issuing a token', async () => {
    const { hasher, users, tokens, service } = setup();
    users.findCredentialsByEmail.mockResolvedValue(credentials);
    hasher.verify.mockResolvedValue(false);

    await expect(
      service.signin({ email: 'jane@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('verifies against a dummy hash prepared once when the user is missing', async () => {
    const { hasher, users, tokens, service } = setup();
    hasher.hash.mockResolvedValue('dummy-hash');
    users.findCredentialsByEmail.mockResolvedValue(null);
    hasher.verify.mockResolvedValue(true);

    await service.onModuleInit();
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(
        service.signin({ email: 'none@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }

    expect(hasher.hash).toHaveBeenCalledTimes(1);
    expect(hasher.verify).toHaveBeenCalledTimes(2);
    expect(hasher.verify).toHaveBeenCalledWith('dummy-hash', 'whatever');
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('does not turn repository, hasher or signing failures into invalid credentials', async () => {
    const { hasher, users, tokens, service } = setup();
    const outage = new Error('database down');
    users.findCredentialsByEmail.mockRejectedValueOnce(outage);
    await expect(
      service.signin({ email: 'jane@example.com', password: 'x' }),
    ).rejects.toBe(outage);

    const hasherFailure = new Error('hasher failed');
    users.findCredentialsByEmail.mockResolvedValue(credentials);
    hasher.verify.mockRejectedValueOnce(hasherFailure);
    await expect(
      service.signin({ email: 'jane@example.com', password: 'x' }),
    ).rejects.toBe(hasherFailure);

    const signingFailure = new Error('signing failed');
    hasher.verify.mockResolvedValue(true);
    tokens.sign.mockRejectedValueOnce(signingFailure);
    await expect(
      service.signin({ email: 'jane@example.com', password: 'x' }),
    ).rejects.toBe(signingFailure);
  });
});

describe('AuthService.authenticate', () => {
  it('loads the user for verified claims', async () => {
    const { users, tokens, service } = setup();
    tokens.verify.mockResolvedValue({ userId: '1' });
    users.findById.mockResolvedValue(user);

    await expect(service.authenticate('token')).resolves.toBe(user);
    expect(users.findById).toHaveBeenCalledWith('1');
  });

  it('returns null for an invalid token without touching the repository', async () => {
    const { users, tokens, service } = setup();
    tokens.verify.mockResolvedValue(null);

    await expect(service.authenticate('token')).resolves.toBeNull();
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('returns null for a deleted user and propagates repository failures', async () => {
    const { users, tokens, service } = setup();
    tokens.verify.mockResolvedValue({ userId: '1' });
    users.findById.mockResolvedValueOnce(null);
    await expect(service.authenticate('token')).resolves.toBeNull();

    const outage = new Error('database down');
    users.findById.mockRejectedValueOnce(outage);
    await expect(service.authenticate('token')).rejects.toBe(outage);
  });
});
