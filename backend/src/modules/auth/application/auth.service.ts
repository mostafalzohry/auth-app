import { randomBytes } from 'node:crypto';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { toPublicUser } from '../../users/domain/public-user';
import { USER_REPOSITORY } from '../../users/domain/user-repository.port';
import type { UserRepository } from '../../users/domain/user-repository.port';
import { User } from '../../users/domain/user.types';
import { ACCESS_TOKEN_SERVICE } from './access-token.port';
import type { AccessTokenService } from './access-token.port';
import { InvalidCredentialsError } from './auth.errors';
import { PASSWORD_HASHER } from './password-hasher.port';
import type { PasswordHasher } from './password-hasher.port';

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface SigninInput {
  email: string;
  password: string;
}

export interface SigninResult {
  user: User;
  accessToken: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_SERVICE) private readonly tokens: AccessTokenService,
  ) {}

  async onModuleInit() {
    await this.getDummyHash();
  }

  async signup(input: SignupInput): Promise<User> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    return this.users.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });
  }

  async signin(input: SigninInput): Promise<SigninResult> {
    const credentials = await this.users.findCredentialsByEmail(input.email);
    const hash = credentials?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await this.passwordHasher.verify(
      hash,
      input.password,
    );
    if (!credentials || !passwordMatches) {
      throw new InvalidCredentialsError();
    }
    const user = toPublicUser(credentials);
    const accessToken = await this.tokens.sign(user.id);
    return { user, accessToken };
  }

  async authenticate(token: string): Promise<User | null> {
    const claims = await this.tokens.verify(token);
    return claims ? this.users.findById(claims.userId) : null;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordHasher.hash(
      randomBytes(32).toString('hex'),
    );
    return this.dummyHash;
  }
}
