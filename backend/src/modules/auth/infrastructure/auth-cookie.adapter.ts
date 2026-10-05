import { Inject, Injectable } from '@nestjs/common';
import { parseCookie } from 'cookie';
import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from './auth-token.config';

export const AUTH_COOKIE_SECURE = Symbol('AUTH_COOKIE_SECURE');

function countCookies(header: string, name: string): number {
  return header
    .split(';')
    .filter((part) => part.trimStart().startsWith(`${name}=`)).length;
}

@Injectable()
export class AuthCookieAdapter {
  constructor(@Inject(AUTH_COOKIE_SECURE) private readonly secure: boolean) {}

  issue(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE_NAME, token, {
      ...this.baseOptions(),
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    this.clearLegacySession(res);
  }

  clear(res: Response): void {
    res.clearCookie(AUTH_COOKIE_NAME, this.baseOptions());
    this.clearLegacySession(res);
  }

  read(req: Request): string | null {
    const header = req.headers.cookie;
    if (!header || countCookies(header, AUTH_COOKIE_NAME) !== 1) return null;
    return parseCookie(header)[AUTH_COOKIE_NAME] || null;
  }

  private clearLegacySession(res: Response): void {
    res.clearCookie(LEGACY_SESSION_COOKIE_NAME, this.baseOptions());
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: '/',
    };
  }
}
