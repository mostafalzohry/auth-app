export interface AccessTokenClaims {
  userId: string;
}

export interface AccessTokenService {
  sign(userId: string): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');
