import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { normalizePath, reject } from '../utils/http.utils';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-auth-request';
const CSRF_HEADER_VALUE = '1';

export interface CsrfOptions {
  allowedOrigins: readonly string[];
  bodylessPaths: readonly string[];
  multipartPaths?: readonly string[];
}

export function createCsrfMiddleware(options: CsrfOptions): RequestHandler {
  const allowedOrigins = new Set(options.allowedOrigins);
  const bodylessPaths = new Set(options.bodylessPaths.map(normalizePath));

  const multipartPaths = new Set(
    (options.multipartPaths ?? []).map(normalizePath),
  );

  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.headers.origin;
    const fetchSite = req.headers['sec-fetch-site'];
    const trusted =
      typeof origin === 'string' &&
      allowedOrigins.has(origin) &&
      req.headers[CSRF_HEADER] === CSRF_HEADER_VALUE &&
      fetchSite?.toLowerCase() !== 'cross-site';
    if (!trusted) return reject(res, 403, 'Forbidden');

    const path = normalizePath(req.path);
    if (!bodylessPaths.has(path)) {
      const mediaType = multipartPaths.has(path)
        ? 'multipart/form-data'
        : 'application/json';
      if (!req.is(mediaType)) {
        return reject(res, 415, 'Unsupported Media Type');
      }
    }
    next();
  };
}
