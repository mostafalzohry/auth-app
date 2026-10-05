import { UserSchema } from './user.schema';

describe('UserSchema', () => {
  it('uses the users collection with timestamps', () => {
    expect(UserSchema.get('collection')).toBe('users');
    expect(UserSchema.get('timestamps')).toBe(true);
  });

  it('requires name, email and passwordHash', () => {
    for (const field of ['name', 'email', 'passwordHash']) {
      expect(UserSchema.path(field).isRequired).toBe(true);
    }
  });

  it('excludes passwordHash from queries by default', () => {
    expect(UserSchema.path('passwordHash').options.select).toBe(false);
  });

  it('defines exactly one unique email index', () => {
    expect(UserSchema.indexes()).toEqual([
      [{ email: 1 }, expect.objectContaining({ unique: true })],
    ]);
  });
});
