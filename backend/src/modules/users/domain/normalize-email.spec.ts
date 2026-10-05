import { normalizeEmail } from './normalize-email';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Jane.Doe@Example.COM \n')).toBe(
      'jane.doe@example.com',
    );
  });

  it('keeps dots and plus tags (no provider-specific rules)', () => {
    expect(normalizeEmail('J.a.n.e+tag@Gmail.com')).toBe(
      'j.a.n.e+tag@gmail.com',
    );
  });
});
