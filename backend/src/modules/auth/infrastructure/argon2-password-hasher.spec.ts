import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher (real argon2)', () => {
  const hasher = new Argon2PasswordHasher();
  const password = 'correct-horse-9!';

  it('verifies the correct password and rejects an incorrect one', async () => {
    const hash = await hasher.hash(password);

    await expect(hasher.verify(hash, password)).resolves.toBe(true);
    await expect(hasher.verify(hash, 'wrong-horse-9!')).resolves.toBe(false);
    await expect(hasher.verify(hash, ` ${password}`)).resolves.toBe(false);
  });

  it('produces different salted hashes for the same password', async () => {
    const [a, b] = await Promise.all([
      hasher.hash(password),
      hasher.hash(password),
    ]);

    expect(a).not.toBe(b);
  });

  it('uses Argon2id with the configured parameters', async () => {
    const hash = await hasher.hash(password);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(hash).not.toContain(password);
  });
});
