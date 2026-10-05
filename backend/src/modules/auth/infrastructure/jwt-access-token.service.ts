import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';
import {
  AccessTokenClaims,
  AccessTokenService,
} from '../application/access-token.port';
import {
  ACCESS_TOKEN_ALGORITHM,
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_TTL_SECONDS,
} from './auth-token.config';

const MAX_SUBJECT_LENGTH = 64;

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function toClaims(
  payload: unknown,
  nowSeconds: number,
): AccessTokenClaims | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { sub, iat, exp } = payload as Record<string, unknown>;
  const validSubject =
    typeof sub === 'string' &&
    sub.length > 0 &&
    sub.length <= MAX_SUBJECT_LENGTH;
  if (!validSubject || !isTimestamp(iat) || !isTimestamp(exp)) return null;
  if (iat > nowSeconds) return null;
  const lifetime = exp - iat;
  if (lifetime <= 0 || lifetime > ACCESS_TOKEN_TTL_SECONDS) return null;
  return { userId: sub };
}

@Injectable()
export class JwtAccessTokenService implements AccessTokenService {
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
  }

  sign(userId: string): Promise<string> {
    return this.jwt.signAsync(
      {},
      {
        secret: this.secret,
        algorithm: ACCESS_TOKEN_ALGORITHM,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        subject: userId,
      },
    );
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const payload: unknown = await this.jwt.verifyAsync(token, {
        secret: this.secret,
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        issuer: ACCESS_TOKEN_ISSUER,
        audience: ACCESS_TOKEN_AUDIENCE,
        clockTolerance: 0,
      });
      return toClaims(payload, Math.floor(Date.now() / 1000));
    } catch (error) {
      if (error instanceof JsonWebTokenError) return null;
      throw error;
    }
  }
}
