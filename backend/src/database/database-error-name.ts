const KNOWN_DATABASE_ERROR_NAMES = new Set([
  'MongooseError',
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerError',
  'MongoParseError',
  'MongoAPIError',
]);

export const GENERIC_DATABASE_ERROR_NAME = 'DatabaseConnectionError';

export function safeDatabaseErrorName(name: unknown): string {
  return typeof name === 'string' && KNOWN_DATABASE_ERROR_NAMES.has(name)
    ? name
    : GENERIC_DATABASE_ERROR_NAME;
}
