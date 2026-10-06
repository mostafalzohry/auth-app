import { toPublicUser } from './public-user';
import { User } from './user.types';

describe('toPublicUser', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('returns a new object with exactly the public fields', () => {
    const source = {
      id: '1',
      name: 'Jane',
      email: 'jane@example.com',
      createdAt: now,
      updatedAt: now,
      passwordHash: 'secret-hash',
      _id: 'internal',
      __v: 0,
    } as User;

    const result = toPublicUser(source);

    expect(result).not.toBe(source);
    expect(Object.keys(result).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'updatedAt',
    ]);
    expect(result).toEqual({
      id: '1',
      name: 'Jane',
      email: 'jane@example.com',
      createdAt: now,
      updatedAt: now,
    });
    expect(JSON.stringify(result)).not.toContain('secret-hash');
  });

  it('includes avatarUrl only when present', () => {
    const base = {
      id: '1',
      name: 'J',
      email: 'j@example.com',
      createdAt: now,
      updatedAt: now,
    };

    expect(
      toPublicUser({ ...base, avatarUrl: '/api/auth/avatar?v=1' }),
    ).toEqual({
      ...base,
      avatarUrl: '/api/auth/avatar?v=1',
    });
    expect('avatarUrl' in toPublicUser(base)).toBe(false);
  });
});
