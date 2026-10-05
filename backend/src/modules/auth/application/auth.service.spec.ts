import { DuplicateEmailError } from '../../users/domain/user.errors';
import { User } from '../../users/domain/user.types';
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
    hash: jest.fn(() => {
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
  return { calls, hasher, users, service: new AuthService(users, hasher) };
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

  it('returns only the public user', async () => {
    const { service } = setup();

    const result = await service.signup(input);

    expect(result).toBe(user);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('propagates DuplicateEmailError', async () => {
    const { users, service } = setup();
    users.create.mockRejectedValueOnce(new DuplicateEmailError());

    await expect(service.signup(input)).rejects.toBeInstanceOf(
      DuplicateEmailError,
    );
  });
});
