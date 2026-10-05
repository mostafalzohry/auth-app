import { parseAllowedOrigins } from './allowed-origins';

describe('parseAllowedOrigins', () => {
  it('normalizes exact http and https origins', () => {
    expect(
      parseAllowedOrigins(
        ' http://localhost:5173 ,https://App.Example.com/,http://127.0.0.1:5173',
      ),
    ).toEqual([
      'http://localhost:5173',
      'https://app.example.com',
      'http://127.0.0.1:5173',
    ]);
  });

  it('removes duplicates and default ports', () => {
    expect(
      parseAllowedOrigins(
        'https://app.example.com,https://app.example.com:443/',
      ),
    ).toEqual(['https://app.example.com']);
  });

  it.each([
    ['a wildcard', 'https://*.example.com'],
    ['a bare wildcard', '*'],
    ['a path', 'https://app.example.com/app'],
    ['a query', 'https://app.example.com?x=1'],
    ['a fragment', 'https://app.example.com#top'],
    ['credentials', 'https://user:pw@app.example.com'],
    ['a non-http scheme', 'ftp://app.example.com'],
    ['a javascript scheme', 'javascript:alert(1)'],
    ['no scheme', 'app.example.com'],
    ['the string null', 'null'],
    ['an empty entry', 'https://a.example.com,'],
    ['an empty value', ''],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseAllowedOrigins(raw)).toThrow();
  });
});
